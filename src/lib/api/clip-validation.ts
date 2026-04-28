/**
 * Validation utilities for trainee video clip uploads.
 */

export const ALLOWED_CLIP_MIME_TYPES = [
  "video/mp4",
  "video/quicktime",
] as const;

export type AllowedClipMimeType = (typeof ALLOWED_CLIP_MIME_TYPES)[number];

export const CLIP_EXTENSION_MAP: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
};

export const MAX_CLIP_SIZE = 100 * 1024 * 1024; // 100 MB
export const CLIP_TTL_DAYS = 21;
export const CLIPS_BUCKET = "trainee-clips";

export type ClipValidationResult =
  | { valid: true }
  | { valid: false; error: string };

export function validateClipFile(
  file: File | null,
  maxSize: number = MAX_CLIP_SIZE,
): ClipValidationResult {
  if (!file || !(file instanceof File)) {
    return { valid: false, error: "לא נשלח קובץ סרטון" };
  }

  if (!ALLOWED_CLIP_MIME_TYPES.includes(file.type as AllowedClipMimeType)) {
    return {
      valid: false,
      error: "פורמט סרטון לא נתמך. יש להעלות MP4 או MOV.",
    };
  }

  if (file.size > maxSize) {
    const sizeMB = Math.round(maxSize / (1024 * 1024));
    return {
      valid: false,
      error: `הסרטון גדול מדי. הגודל המרבי הוא ${sizeMB} מגה.`,
    };
  }

  return { valid: true };
}

export function getClipExtension(mimeType: string): string {
  return CLIP_EXTENSION_MAP[mimeType] ?? "mp4";
}

export function buildClipPath(userId: string, mimeType: string): string {
  const ext = getClipExtension(mimeType);
  const random = Math.random().toString(36).substring(2, 8);
  return `${userId}/${Date.now()}-${random}.${ext}`;
}
