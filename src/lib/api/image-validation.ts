/**
 * Shared image validation utilities for API routes
 */

// UUID validation regex
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Allowed file types
export const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png"] as const;
export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

// Extension mapping
export const EXTENSION_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
};

// File size limits
export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB for original images
export const MAX_PROCESSED_SIZE = 10 * 1024 * 1024; // 10MB for processed (PNG can be larger)

// Storage bucket name
export const AVATARS_BUCKET = "avatars";

/**
 * Validate UUID format
 */
export function validateUUID(id: string | null | undefined): id is string {
  if (!id) return false;
  return UUID_REGEX.test(id);
}

/**
 * Validate image file type and size
 */
export function validateImageFile(
  file: File | null,
  maxSize: number = MAX_FILE_SIZE
): { valid: true } | { valid: false; error: string } {
  if (!file || !(file instanceof File)) {
    return { valid: false, error: "Missing image file" };
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type as AllowedMimeType)) {
    return { valid: false, error: "Invalid image format. Only JPEG and PNG are allowed" };
  }

  if (file.size > maxSize) {
    const sizeMB = Math.round(maxSize / (1024 * 1024));
    return { valid: false, error: `Image too large. Maximum size is ${sizeMB}MB` };
  }

  return { valid: true };
}

/**
 * Validate processed image (Blob from canvas)
 * Note: Canvas blobs may have empty/wrong type, so we only check for arrayBuffer method and size
 */
export function validateProcessedImage(
  blob: Blob | null,
  maxSize: number = MAX_PROCESSED_SIZE
): { valid: true } | { valid: false; error: string } {
  if (!blob || !("arrayBuffer" in blob)) {
    return { valid: false, error: "Missing processed image file" };
  }

  if (blob.size > maxSize) {
    const sizeMB = Math.round(maxSize / (1024 * 1024));
    return { valid: false, error: `Processed image too large. Maximum size is ${sizeMB}MB` };
  }

  return { valid: true };
}

/**
 * Generate unique filename with timestamp and random suffix
 */
export function generateUniqueFilename(
  userId: string,
  type: "original" | "processed",
  extension: string
): string {
  const timestamp = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  return `${userId}/${type}/${timestamp}.${extension}`;
}

/**
 * Get file extension from MIME type
 */
export function getExtensionFromMimeType(mimeType: string): string {
  return EXTENSION_MAP[mimeType] || "jpg";
}
