"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { setLessonVideo } from "@/features/course/lib/actions/admin-course";
import { COURSE_VIDEO_BUCKET } from "@/features/course/lib/playback-config";

interface LessonVideoUploadProps {
  lessonId: string;
  chapterSlug: string;
  lessonSlug: string;
  hasVideo: boolean;
}

/**
 * Matches the bucket's own `file_size_limit`. Checked here too so an oversized
 * file is refused with a sentence Eden can act on rather than an opaque storage
 * error after a long upload.
 */
const MAX_BYTES = 250 * 1024 * 1024;

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
 * Uploads a lesson video straight from the browser to the private bucket, then
 * records the key. The file never passes through a server action -- Next's body
 * limit makes that impractical at this size, and the bucket's admin policy lets
 * the browser write directly.
 */
export function LessonVideoUpload({
  lessonId,
  chapterSlug,
  lessonSlug,
  hasVideo,
}: LessonVideoUploadProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handleFile = async (file: File) => {
    if (file.type !== "video/mp4") {
      toast.error("אפשר להעלות קובץ MP4 בלבד");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error(
        `הקובץ גדול מדי (${(file.size / 1024 ** 2).toFixed(0)} MB). המקסימום הוא 250 MB — ייצא את הסרטון ב-720p.`
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

      const path = `${chapterSlug}/${lessonSlug}.mp4`;
      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from(COURSE_VIDEO_BUCKET)
        .upload(path, file, { contentType: "video/mp4", upsert: true });

      if (uploadError) {
        console.error("lesson video upload failed:", uploadError);
        toast.error("ההעלאה נכשלה, נסה שוב");
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
        className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
      >
        {busy ? (
          <Loader2
            className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none"
            aria-label="מעלה"
          />
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
