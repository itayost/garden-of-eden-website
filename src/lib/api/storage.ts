/**
 * Shared storage utilities for API routes
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { AVATARS_BUCKET } from "./image-validation";

type UploadResult =
  | { success: true; url: string; path: string }
  | { success: false; error: string };

interface UploadOptions {
  cacheControl?: string;
  upsert?: boolean;
  contentType?: string;
}

/**
 * Upload file to Supabase storage and return public URL
 */
export async function uploadToStorage(
  supabase: SupabaseClient,
  bucket: string,
  path: string,
  data: File | ArrayBuffer | Blob | Buffer,
  options: UploadOptions = {}
): Promise<UploadResult> {
  const { cacheControl = "3600", upsert = false, contentType } = options;

  // Convert Blob/Buffer to ArrayBuffer for reliable upload
  let uploadData: File | ArrayBuffer;
  if (Buffer.isBuffer(data)) {
    uploadData = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
  } else if (data instanceof Blob && !(data instanceof File)) {
    uploadData = await data.arrayBuffer();
  } else {
    uploadData = data as File | ArrayBuffer;
  }

  const uploadOptions: { cacheControl: string; upsert: boolean; contentType?: string } = {
    cacheControl,
    upsert,
  };

  if (contentType) {
    uploadOptions.contentType = contentType;
  }

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(path, uploadData, uploadOptions);

  if (uploadError) {
    return { success: false, error: uploadError.message };
  }

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);

  return {
    success: true,
    url: urlData.publicUrl,
    path,
  };
}

/**
 * Upload image to avatars bucket
 */
export async function uploadAvatarImage(
  supabase: SupabaseClient,
  path: string,
  data: File | ArrayBuffer | Blob | Buffer,
  contentType?: string
): Promise<UploadResult> {
  return uploadToStorage(supabase, AVATARS_BUCKET, path, data, { contentType });
}

/**
 * Delete file from storage
 */
export async function deleteFromStorage(
  supabase: SupabaseClient,
  bucket: string,
  paths: string[]
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.storage.from(bucket).remove(paths);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Clean up uploaded files on failure (for rollback)
 */
export async function cleanupUploadedFiles(
  supabase: SupabaseClient,
  bucket: string,
  paths: string[]
): Promise<void> {
  try {
    await supabase.storage.from(bucket).remove(paths);
  } catch (error) {
    // Silent fail - cleanup is best effort
    console.error("[Storage Cleanup] Failed to clean up files:", error);
  }
}
