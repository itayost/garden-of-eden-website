"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { videoSchema, type VideoInput } from "@/lib/validations/video";
import { verifyAdmin } from "@/lib/actions/shared";
import { isValidUUID } from "@/lib/validations/common";

type ActionResult =
  | { success: true; videoId?: string }
  | { error: string; fieldErrors?: Record<string, string[]> };

/**
 * Create a new workout video
 *
 * - Verifies admin authentication
 * - Validates input with videoSchema
 * - Auto-calculates order_index if not provided
 * - Inserts to workout_videos table
 * - Revalidates admin videos page
 */
export async function createVideoAction(input: VideoInput): Promise<ActionResult> {
  // 1. Verify admin
  const { error: authError } = await verifyAdmin();
  if (authError) return { error: authError };

  // 2. Validate input
  const validated = videoSchema.safeParse(input);
  if (!validated.success) {
    return {
      error: "אימות נתונים נכשל",
      fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const adminClient = createAdminClient();

  try {
    // 3. Calculate order_index if not provided
    let orderIndex = validated.data.order_index;
    if (orderIndex === undefined) {
      const { data: maxOrder } = await adminClient
        .from("workout_videos")
        .select("order_index")
        .eq("day_number", validated.data.day_number)
        .order("order_index", { ascending: false })
        .limit(1)
        .single();

      orderIndex = (maxOrder?.order_index ?? 0) + 1;
    }

    // 4. Insert video
    const { data: video, error: insertError } = await adminClient
      .from("workout_videos")
      .insert({
        title: validated.data.title,
        youtube_url: validated.data.youtube_url,
        day_number: validated.data.day_number,
        day_topic: validated.data.day_topic,
        duration_minutes: validated.data.duration_minutes,
        description: validated.data.description || null,
        order_index: orderIndex,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert video error:", insertError);
      return { error: insertError.message || "שגיאה בהוספת סרטון" };
    }

    // 5. Revalidate
    revalidatePath("/admin/videos");

    return { success: true, videoId: video.id };

  } catch (error) {
    console.error("Create video error:", error);
    return {
      error: error instanceof Error ? error.message : "שגיאה בהוספת סרטון",
    };
  }
}

/**
 * Update an existing workout video
 *
 * - Verifies admin authentication
 * - Validates videoId format
 * - Validates input with videoSchema
 * - Updates workout_videos where id matches
 * - Revalidates admin videos page
 */
export async function updateVideoAction(
  videoId: string,
  input: VideoInput
): Promise<ActionResult> {
  // 1. Verify admin
  const { error: authError } = await verifyAdmin();
  if (authError) return { error: authError };

  // 2. Validate videoId format
  if (!isValidUUID(videoId)) {
    return { error: "מזהה סרטון לא תקין" };
  }

  // 3. Validate input
  const validated = videoSchema.safeParse(input);
  if (!validated.success) {
    return {
      error: "אימות נתונים נכשל",
      fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const adminClient = createAdminClient();

  try {
    // 4. Update video
    const { error: updateError } = await adminClient
      .from("workout_videos")
      .update({
        title: validated.data.title,
        youtube_url: validated.data.youtube_url,
        day_number: validated.data.day_number,
        day_topic: validated.data.day_topic,
        duration_minutes: validated.data.duration_minutes,
        description: validated.data.description || null,
        order_index: validated.data.order_index,
      })
      .eq("id", videoId);

    if (updateError) {
      console.error("Update video error:", updateError);
      return { error: updateError.message || "שגיאה בעדכון סרטון" };
    }

    // 5. Revalidate
    revalidatePath("/admin/videos");

    return { success: true, videoId };

  } catch (error) {
    console.error("Update video error:", error);
    return {
      error: error instanceof Error ? error.message : "שגיאה בעדכון סרטון",
    };
  }
}

/**
 * Delete a workout video (hard delete)
 *
 * - Verifies admin authentication
 * - Validates videoId format
 * - Hard deletes from workout_videos
 * - Note: video_progress entries will cascade delete
 * - Revalidates admin videos page
 */
export async function deleteVideoAction(videoId: string): Promise<ActionResult> {
  // 1. Verify admin
  const { error: authError } = await verifyAdmin();
  if (authError) return { error: authError };

  // 2. Validate videoId format
  if (!isValidUUID(videoId)) {
    return { error: "מזהה סרטון לא תקין" };
  }

  const adminClient = createAdminClient();

  try {
    // 3. Hard delete video
    // Note: workout_videos don't have deleted_at - this is a hard delete
    // video_progress entries will cascade delete via foreign key
    const { error: deleteError } = await adminClient
      .from("workout_videos")
      .delete()
      .eq("id", videoId);

    if (deleteError) {
      console.error("Delete video error:", deleteError);
      return { error: deleteError.message || "שגיאה במחיקת סרטון" };
    }

    // 4. Revalidate
    revalidatePath("/admin/videos");

    return { success: true };

  } catch (error) {
    console.error("Delete video error:", error);
    return {
      error: error instanceof Error ? error.message : "שגיאה במחיקת סרטון",
    };
  }
}
