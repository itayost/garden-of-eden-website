"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Film, Upload, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DeleteConfirmDialog } from "@/components/admin/DeleteConfirmDialog";
import { deleteOwnClip } from "@/features/clips/lib/actions/clips";
import {
  ALLOWED_CLIP_MIME_TYPES,
  MAX_CLIP_SIZE,
  validateClipFile,
} from "@/lib/api/clip-validation";
import { clipDaysRemaining } from "@/features/clips/lib/clip-time";

interface ClipUploadCardProps {
  clip: {
    uploaded_at: string;
    signedUrl: string | null;
    mime_type: string;
  } | null;
}

const MAX_MB = Math.round(MAX_CLIP_SIZE / (1024 * 1024));

export function ClipUploadCard({ clip }: ClipUploadCardProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [, startTransition] = useTransition();

  const handleFileSelected = async (file: File) => {
    const v = validateClipFile(file);
    if (!v.valid) {
      toast.error(v.error);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/clips/upload", {
        method: "POST",
        body: formData,
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(json.error ?? "שגיאה בהעלאת הסרטון");
        return;
      }
      toast.success("הסרטון הועלה בהצלחה");
      startTransition(() => router.refresh());
    } catch (err) {
      console.error(err);
      toast.error("שגיאה בהעלאת הסרטון");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 py-5">
        <div className="flex items-start gap-4">
          <div className="bg-purple-500 rounded-full p-2 shrink-0">
            <Film className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold">הסרטון שלי</h3>
            <p className="text-sm text-muted-foreground">
              העלו סרטון קצר לסקירת המאמן. נמחק אוטומטית לאחר 21 ימים.
            </p>
          </div>
        </div>

        {clip ? (
          <>
            {clip.signedUrl ? (
              <video
                controls
                preload="metadata"
                className="w-full rounded-lg bg-black"
                src={clip.signedUrl}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                לא ניתן לטעון את הסרטון כעת
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">
                נותרו {clipDaysRemaining(clip.uploaded_at)} ימים
              </Badge>
              <span className="text-xs text-muted-foreground">
                הועלה ב-{new Date(clip.uploaded_at).toLocaleDateString("he-IL")}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 ml-1 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 ml-1" />
                )}
                החלפת הסרטון
              </Button>
              <DeleteConfirmDialog
                title="מחיקת הסרטון?"
                description="הקובץ יימחק לצמיתות. ניתן יהיה להעלות סרטון חדש."
                confirmLabel="מחיקה"
                loadingLabel="מוחק..."
                successMessage="הסרטון נמחק"
                errorMessage="שגיאה במחיקת הסרטון"
                onDelete={async () => {
                  const result = await deleteOwnClip();
                  if (result.success) return { success: true };
                  return { error: result.error ?? "שגיאה במחיקת הסרטון" };
                }}
                onSuccess={() => router.refresh()}
                trigger={
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 ml-1" />
                    מחיקה
                  </Button>
                }
              />
            </div>
          </>
        ) : (
          <Button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="self-start"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                מעלה...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 ml-2" />
                העלאת סרטון
              </>
            )}
          </Button>
        )}

        <p className="text-xs text-muted-foreground">
          פורמטים נתמכים: MP4, MOV · גודל מרבי: {MAX_MB} מגה
        </p>

        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_CLIP_MIME_TYPES.join(",")}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFileSelected(file);
          }}
        />
      </CardContent>
    </Card>
  );
}
