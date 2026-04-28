"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { typedFrom } from "@/lib/supabase/helpers";
import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { cleanupUploadedFiles } from "@/lib/api/storage";
import { CLIPS_BUCKET } from "@/lib/api/clip-validation";

export interface ClipRow {
  readonly id: string;
  readonly user_id: string;
  readonly storage_path: string;
  readonly mime_type: string;
  readonly size_bytes: number;
  readonly uploaded_at: string;
}

export interface ClipWithSignedUrl {
  readonly clip: ClipRow;
  readonly signedUrl: string | null;
}

export type ActionResult =
  | { success: true; error?: never }
  | { success: false; error: string };

const SIGNED_URL_TTL_SECONDS = 300;

const CLIP_COLUMNS = "id, user_id, storage_path, mime_type, size_bytes, uploaded_at";

async function signClipUrl(
  supabase: Awaited<ReturnType<typeof createClient>>,
  storagePath: string,
): Promise<string | null> {
  const { data } = await supabase.storage
    .from(CLIPS_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
  return data?.signedUrl ?? null;
}

export async function getOwnClipWithSignedUrl(): Promise<ClipWithSignedUrl | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await typedFrom(supabase, "trainee_clips")
    .select(CLIP_COLUMNS)
    .eq("user_id", user.id)
    .maybeSingle();

  const clip = data as ClipRow | null;
  if (!clip) return null;

  return { clip, signedUrl: await signClipUrl(supabase, clip.storage_path) };
}

export async function getClipWithSignedUrlForAdmin(
  userId: string,
): Promise<ClipWithSignedUrl | null> {
  const { error } = await verifyAdminOrTrainer();
  if (error) return null;

  const supabase = await createClient();
  const { data } = await typedFrom(supabase, "trainee_clips")
    .select(CLIP_COLUMNS)
    .eq("user_id", userId)
    .maybeSingle();

  const clip = data as ClipRow | null;
  if (!clip) return null;

  return { clip, signedUrl: await signClipUrl(supabase, clip.storage_path) };
}

export async function deleteOwnClip(): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "לא מחובר" };

  const { data: existing } = await typedFrom(supabase, "trainee_clips")
    .select("storage_path")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing?.storage_path) {
    await cleanupUploadedFiles(supabase, CLIPS_BUCKET, [
      existing.storage_path as string,
    ]);
  }

  const { error } = await typedFrom(supabase, "trainee_clips")
    .delete()
    .eq("user_id", user.id);

  if (error) {
    console.error("[deleteOwnClip] db error:", error);
    return { success: false, error: "שגיאה במחיקת הסרטון" };
  }

  revalidatePath("/dashboard");
  return { success: true };
}
