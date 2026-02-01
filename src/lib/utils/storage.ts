import { createClient } from "@/lib/supabase/client";

const AVATARS_BUCKET = "avatars";

// Allowed file types and extensions
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const EXTENSION_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const MAX_TRAINEE_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB for trainee images

// Allowed types for trainee uploads (JPG/PNG only per CONTEXT.md)
const TRAINEE_ALLOWED_MIME_TYPES = ["image/jpeg", "image/png"];

/**
 * Upload a profile photo to Supabase Storage
 * @param userId - The user's ID (used as folder name)
 * @param file - The image file to upload
 * @returns The public URL of the uploaded image, or an error message
 */
export async function uploadProfilePhoto(
  userId: string,
  file: File
): Promise<{ url: string; path: string } | { error: string }> {
  const supabase = createClient();

  // Server-side validation
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return { error: "פורמט לא נתמך. נא להעלות JPEG, PNG או WebP" };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { error: "הקובץ גדול מדי. מקסימום 2MB" };
  }

  // Sanitized extension from MIME type (prevents path traversal)
  const extension = EXTENSION_MAP[file.type] || "jpg";
  // Add random string for uniqueness (prevents timestamp collisions)
  const timestamp = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  const filePath = `${userId}/${timestamp}.${extension}`;

  try {
    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from(AVATARS_BUCKET)
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return { error: "שגיאה בהעלאת התמונה. נסה שוב." };
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(AVATARS_BUCKET)
      .getPublicUrl(filePath);

    return {
      url: urlData.publicUrl,
      path: filePath,
    };
  } catch (err) {
    console.error("Storage error:", err);
    return { error: "שגיאה בהעלאת התמונה. נסה שוב." };
  }
}

/**
 * Delete a profile photo from Supabase Storage
 * @param path - The file path to delete
 */
export async function deleteProfilePhoto(
  path: string
): Promise<{ success: boolean } | { error: string }> {
  const supabase = createClient();

  try {
    const { error } = await supabase.storage
      .from(AVATARS_BUCKET)
      .remove([path]);

    if (error) {
      console.error("Delete error:", error);
      return { error: "שגיאה במחיקת התמונה" };
    }

    return { success: true };
  } catch (err) {
    console.error("Storage delete error:", err);
    return { error: "שגיאה במחיקת התמונה" };
  }
}

/**
 * Get avatar URL from path (for signed URLs if bucket is private)
 * @param path - The file path in the avatars bucket
 */
export function getAvatarUrl(path: string | null): string | null {
  if (!path) return null;

  const supabase = createClient();
  const { data } = supabase.storage
    .from(AVATARS_BUCKET)
    .getPublicUrl(path);

  return data.publicUrl;
}

// ============================================
// TRAINEE IMAGE MANAGEMENT FUNCTIONS
// ============================================

/**
 * Upload a trainee's original image to Supabase Storage
 * Used by admins/trainers to upload photos for trainees
 * @param traineeUserId - The trainee's user ID (used as folder name)
 * @param file - The image file to upload
 * @returns The public URL and path of the uploaded image, or an error message
 */
export async function uploadTraineeImage(
  traineeUserId: string,
  file: File
): Promise<{ url: string; path: string } | { error: string }> {
  const supabase = createClient();

  // Validate file type (JPG/PNG only per CONTEXT.md)
  if (!TRAINEE_ALLOWED_MIME_TYPES.includes(file.type)) {
    return { error: "פורמט לא נתמך. נא להעלות JPEG או PNG בלבד" };
  }

  // Validate file size (5MB max per CONTEXT.md)
  if (file.size > MAX_TRAINEE_IMAGE_SIZE) {
    return { error: "הקובץ גדול מדי. מקסימום 5MB" };
  }

  // Sanitized extension from MIME type
  const extension = EXTENSION_MAP[file.type] || "jpg";
  // Add random string for uniqueness
  const timestamp = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  const filePath = `${traineeUserId}/original/${timestamp}.${extension}`;

  try {
    const { error: uploadError } = await supabase.storage
      .from(AVATARS_BUCKET)
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      console.error("Trainee image upload error:", uploadError);
      return { error: "שגיאה בהעלאת התמונה. נסה שוב." };
    }

    const { data: urlData } = supabase.storage
      .from(AVATARS_BUCKET)
      .getPublicUrl(filePath);

    return {
      url: urlData.publicUrl,
      path: filePath,
    };
  } catch (err) {
    console.error("Trainee image storage error:", err);
    return { error: "שגיאה בהעלאת התמונה. נסה שוב." };
  }
}

/**
 * Upload a processed (background-removed) image to Supabase Storage
 * Used after remove.bg processing for FIFA card cutouts
 * @param traineeUserId - The trainee's user ID (used as folder name)
 * @param imageBuffer - The processed image data (PNG format)
 * @param format - The image format (always 'png' for transparency)
 * @returns The public URL and path of the uploaded image, or an error message
 */
export async function uploadProcessedImage(
  traineeUserId: string,
  imageBuffer: Buffer | Blob,
  format: "png" = "png"
): Promise<{ url: string; path: string } | { error: string }> {
  const supabase = createClient();

  // Add random string for uniqueness
  const timestamp = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  const filePath = `${traineeUserId}/processed/${timestamp}.${format}`;

  try {
    const { error: uploadError } = await supabase.storage
      .from(AVATARS_BUCKET)
      .upload(filePath, imageBuffer, {
        cacheControl: "3600",
        upsert: false,
        contentType: "image/png",
      });

    if (uploadError) {
      console.error("Processed image upload error:", uploadError);
      return { error: "שגיאה בהעלאת התמונה המעובדת. נסה שוב." };
    }

    const { data: urlData } = supabase.storage
      .from(AVATARS_BUCKET)
      .getPublicUrl(filePath);

    return {
      url: urlData.publicUrl,
      path: filePath,
    };
  } catch (err) {
    console.error("Processed image storage error:", err);
    return { error: "שגיאה בהעלאת התמונה המעובדת. נסה שוב." };
  }
}

/**
 * Delete trainee images from Supabase Storage
 * Deletes both original and processed images if both paths provided
 * @param originalPath - The path to the original image
 * @param processedPath - Optional path to the processed image
 * @returns Success status or an error message
 */
export async function deleteTraineeImage(
  originalPath: string,
  processedPath?: string
): Promise<{ success: boolean } | { error: string }> {
  const supabase = createClient();

  const pathsToDelete = [originalPath];
  if (processedPath) {
    pathsToDelete.push(processedPath);
  }

  try {
    const { error } = await supabase.storage
      .from(AVATARS_BUCKET)
      .remove(pathsToDelete);

    if (error) {
      console.error("Trainee image delete error:", error);
      return { error: "שגיאה במחיקת התמונות" };
    }

    return { success: true };
  } catch (err) {
    console.error("Trainee image storage delete error:", err);
    return { error: "שגיאה במחיקת התמונות" };
  }
}

/**
 * Get processed avatar URL from path (for FIFA card cutouts)
 * @param path - The file path in the avatars bucket
 * @returns The public URL or null if no path provided
 */
export function getProcessedAvatarUrl(path: string | null): string | null {
  if (!path) return null;

  const supabase = createClient();
  const { data } = supabase.storage
    .from(AVATARS_BUCKET)
    .getPublicUrl(path);

  return data.publicUrl;
}
