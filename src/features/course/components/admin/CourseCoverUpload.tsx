"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import imageCompression from "browser-image-compression";
import { setCourseCover } from "@/features/course/lib/actions/admin-course-structure";
import {
  coverFileProblem,
  COVER_MIME_TYPES,
  coverTypeProblem,
} from "@/features/course/lib/course-cover-rules";

interface CourseCoverUploadProps {
  courseId: string;
  coverUrl: string | null;
}

type UploadResponse =
  | { success: true; url: string }
  | { success: false; error: string };

/**
 * A phone photo is several MB and thousands of pixels wide; a cover is shown at
 * most screen-wide, so it is shrunk in the browser first. The type is kept
 * (JPEG, PNG or WebP). No web worker: it would load the library from a CDN,
 * which the site's Content-Security-Policy (worker-src 'self') does not allow.
 */
const COMPRESSION = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1600,
  useWebWorker: false,
} as const;

const PAYLOAD_TOO_LARGE = 413;
const UPLOAD_FAILED = "שגיאה בהעלאת התמונה. נסה שוב.";

/** The compressed cover, or null when the browser could not read the image. */
async function compressCover(file: File): Promise<File | null> {
  try {
    return await imageCompression(file, COMPRESSION);
  } catch (error) {
    console.error("[Course cover] Compression failed:", error);
    return null;
  }
}

/**
 * What to tell the admin when the upload was refused. Vercel answers 413 in
 * plain text before the route runs; the route itself answers JSON in Hebrew.
 */
async function uploadErrorMessage(response: Response): Promise<string> {
  if (response.status === PAYLOAD_TOO_LARGE) {
    return "התמונה גדולה מדי להעלאה. נסו תמונה קטנה יותר.";
  }
  try {
    const body = (await response.json()) as { error?: unknown };
    return typeof body.error === "string" && body.error ? body.error : UPLOAD_FAILED;
  } catch {
    return UPLOAD_FAILED;
  }
}

/** Preview, replace and remove a course's cover image. */
export function CourseCoverUpload({ courseId, coverUrl }: CourseCoverUploadProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [removePending, startRemove] = useTransition();
  const busy = uploading || removePending;

  const handleFile = async (file: File) => {
    const typeProblem = coverTypeProblem(file.type);
    if (typeProblem) {
      toast.error(typeProblem);
      return;
    }
    setUploading(true);
    try {
      const compressed = await compressCover(file);
      if (!compressed) {
        toast.error("לא הצלחנו לקרוא את התמונה. נסו תמונה אחרת.");
        return;
      }
      const problem = coverFileProblem(compressed);
      if (problem) {
        toast.error(problem);
        return;
      }
      const body = new FormData();
      body.append("file", compressed);
      body.append("courseId", courseId);
      const response = await fetch("/api/images/course-cover", {
        method: "POST",
        body,
      });
      if (!response.ok) {
        toast.error(await uploadErrorMessage(response));
        return;
      }
      const uploaded = (await response.json()) as UploadResponse;
      if (!uploaded.success) {
        toast.error(uploaded.error);
        return;
      }
      const saved = await setCourseCover(courseId, uploaded.url);
      if ("error" in saved) {
        toast.error(saved.error);
        return;
      }
      toast.success("התמונה נשמרה");
      router.refresh();
    } catch {
      toast.error(UPLOAD_FAILED);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleRemove = () => {
    startRemove(async () => {
      const result = await setCourseCover(courseId, null);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("התמונה הוסרה");
      router.refresh();
    });
  };

  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
        תמונת הקורס
      </Label>

      {coverUrl && (
        <div className="relative h-28 w-full max-w-xs overflow-hidden rounded-lg border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={coverUrl}
            alt=""
            aria-hidden="true"
            className="size-full object-cover"
          />
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={COVER_MIME_TYPES.join(",")}
        className="hidden"
        aria-label="בחירת תמונת קורס"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          <ImagePlus className="h-4 w-4 me-1.5" aria-hidden="true" />
          {uploading ? "מעלה..." : coverUrl ? "החלף תמונה" : "הוסף תמונה"}
        </Button>
        {coverUrl && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={handleRemove}
          >
            <Trash2 className="h-4 w-4 me-1.5" aria-hidden="true" />
            הסר תמונה
          </Button>
        )}
      </div>
    </div>
  );
}
