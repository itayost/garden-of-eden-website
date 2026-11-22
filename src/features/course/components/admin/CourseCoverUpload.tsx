"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { setCourseCover } from "@/features/course/lib/actions/admin-course-structure";
import {
  coverFileProblem,
  COVER_MIME_TYPES,
} from "@/features/course/lib/course-cover-rules";

interface CourseCoverUploadProps {
  courseId: string;
  coverUrl: string | null;
}

type UploadResponse =
  | { success: true; url: string }
  | { success: false; error: string };

/** Preview, replace and remove a course's cover image. */
export function CourseCoverUpload({ courseId, coverUrl }: CourseCoverUploadProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [removePending, startRemove] = useTransition();
  const busy = uploading || removePending;

  const handleFile = async (file: File) => {
    const problem = coverFileProblem(file);
    if (problem) {
      toast.error(problem);
      return;
    }
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("courseId", courseId);
      const response = await fetch("/api/images/course-cover", {
        method: "POST",
        body,
      });
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
      toast.error("שגיאה בהעלאת התמונה. נסה שוב.");
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
