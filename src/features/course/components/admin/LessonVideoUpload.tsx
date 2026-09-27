"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import * as tus from "tus-js-client";
import { createClient } from "@/lib/supabase/client";
import { pickResumableUpload } from "@/features/course/lib/resume-upload";
import { setLessonVideo } from "@/features/course/lib/actions/admin-course";
import {
  COURSE_VIDEO_BUCKET,
  MAX_LESSON_VIDEO_BYTES,
  cmsVideoPath,
} from "@/features/course/lib/playback-config";

interface LessonVideoUploadProps {
  lessonId: string;
  hasVideo: boolean;
}

const HTTP_PAYLOAD_TOO_LARGE = 413;

/** Read a video's duration from the file itself, without uploading it first. */
function readDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const probe = document.createElement("video");
    probe.preload = "metadata";
    probe.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(probe.duration);
    };
    probe.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("unreadable"));
    };
    probe.src = url;
  });
}

/**
 * TUS resumable upload into the private bucket as the signed-in admin. A Zoom
 * recording runs to hundreds of megabytes; a dropped connection resumes from
 * the last chunk instead of starting over.
 */
function uploadResumable(
  file: File,
  path: string,
  onProgress: (percent: number) => void,
): Promise<void> {
  const supabase = createClient();
  return new Promise((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/upload/resumable`,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: { "x-upsert": "true" },
      // A fresh token on every request: a long recording can outlive the one
      // that was current when the upload started (tokens last about an hour).
      onBeforeRequest: async (req) => {
        const { data } = await supabase.auth.getSession();
        req.setHeader("authorization", `Bearer ${data.session?.access_token ?? ""}`);
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      // Supabase's TUS endpoint requires 6 MB chunks.
      chunkSize: 6 * 1024 * 1024,
      metadata: {
        bucketName: COURSE_VIDEO_BUCKET,
        objectName: path,
        contentType: "video/mp4",
        cacheControl: "3600",
      },
      onError: reject,
      onProgress: (sent, total) => onProgress(Math.round((sent / total) * 100)),
      onSuccess: () => resolve(),
    });
    upload
      .findPreviousUploads()
      .then((previous) => {
        const resumable = pickResumableUpload(previous, path);
        if (resumable) upload.resumeFromPreviousUpload(resumable);
        upload.start();
      })
      .catch(reject);
  });
}

/**
 * Uploads a lesson video straight from the browser to the private bucket, then
 * records the key. The file never passes through a server action -- Next's body
 * limit makes that impractical at this size, and the bucket's admin policy lets
 * the browser write directly.
 */
export function LessonVideoUpload({ lessonId, hasVideo }: LessonVideoUploadProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);

  const handleFile = async (file: File) => {
    if (file.type !== "video/mp4") {
      toast.error("אפשר להעלות קובץ MP4 בלבד");
      return;
    }
    // Checked here too so an oversized file is refused with a sentence that
    // can be acted on, rather than an opaque storage error after a long upload.
    if (file.size > MAX_LESSON_VIDEO_BYTES) {
      toast.error(
        `הקובץ גדול מדי (${(file.size / 1024 ** 2).toFixed(0)} MB). המקסימום הוא 2 GB.`
      );
      return;
    }

    setBusy(true);
    try {
      let durationSec: number;
      try {
        durationSec = await readDuration(file);
      } catch {
        toast.error("לא הצלחנו לקרוא את הקובץ. ודא שזה MP4 תקין.");
        return;
      }

      if (!Number.isFinite(durationSec) || durationSec < 1) {
        toast.error("לא הצלחנו לקרוא את אורך הסרטון");
        return;
      }

      const path = cmsVideoPath(lessonId);
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        toast.error("פג תוקף ההתחברות, התחבר מחדש");
        return;
      }

      try {
        await uploadResumable(file, path, setProgress);
      } catch (uploadError) {
        console.error("lesson video upload failed:", uploadError);
        // A 413 is the storage size limit refusing the file: retrying will not
        // help, so do not promise a resume.
        const status =
          uploadError instanceof tus.DetailedError
            ? uploadError.originalResponse?.getStatus()
            : undefined;
        toast.error(
          status === HTTP_PAYLOAD_TOO_LARGE
            ? "הקובץ חורג ממגבלת האחסון של השרת"
            : "ההעלאה נכשלה, נסה שוב. ההעלאה תמשיך מהמקום שבו נעצרה."
        );
        return;
      }

      const result = await setLessonVideo(lessonId, path, durationSec);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success("הווידאו הועלה");
      router.refresh();
    } finally {
      setBusy(false);
      setProgress(null);
      // Clear the input so picking the same file again still fires onChange.
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        title={hasVideo ? "החלפת הווידאו" : "העלאת וידאו"}
        className="grid h-7 min-w-7 shrink-0 place-items-center rounded-md px-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
      >
        {busy ? (
          progress !== null ? (
            <span className="text-[10px] tabular-nums" aria-label={`מעלה ${progress}%`}>
              {progress}%
            </span>
          ) : (
            <Loader2
              className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none"
              aria-label="מעלה"
            />
          )
        ) : (
          <Upload className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        <span className="sr-only">
          {hasVideo ? "החלפת הווידאו" : "העלאת וידאו"}
        </span>
      </button>
    </>
  );
}
