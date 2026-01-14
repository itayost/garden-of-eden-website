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
