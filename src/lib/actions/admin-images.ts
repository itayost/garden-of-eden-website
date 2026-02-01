"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ActionResult = { success: true } | { error: string };

/**
 * Verify current user is authenticated and has admin or trainer role
 * Similar to verifyAdmin in admin-users.ts but accepts both admin and trainer
 */
async function verifyAdminOrTrainer(): Promise<
  | { authorized: true; userId: string }
  | { authorized: false }
> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { authorized: false };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "admin" && profile.role !== "trainer")) {
    return { authorized: false };
  }

  return { authorized: true, userId: user.id };
}

/**
 * Update a trainee's avatar URLs in their profile
 *
 * Updates both avatar_url (for app-wide avatars) and
 * processed_avatar_url (for FIFA card cutouts)
 *
 * @param traineeUserId - The trainee's user ID
 * @param originalUrl - URL for the original image (used for avatars)
 * @param processedUrl - URL for the processed image (used for FIFA cards)
 */
export async function updateTraineeAvatarUrls(
  traineeUserId: string,
  originalUrl: string,
  processedUrl: string
): Promise<ActionResult> {
  // 1. Verify admin/trainer role
  const authResult = await verifyAdminOrTrainer();
  if (!authResult.authorized) {
    return { error: "Unauthorized" };
  }

  // 2. Validate traineeUserId format
  if (!UUID_REGEX.test(traineeUserId)) {
    return { error: "Invalid user ID format" };
  }

  // 3. Validate URLs are provided
  if (!originalUrl || !processedUrl) {
    return { error: "Both URLs are required" };
  }

  const adminClient = createAdminClient();

  try {
    // 4. Check if trainee exists
    const { data: traineeProfile, error: fetchError } = await adminClient
      .from("profiles")
      .select("id")
      .eq("id", traineeUserId)
      .single();

    if (fetchError || !traineeProfile) {
      return { error: "User not found" };
    }

    // 5. Update profile with both avatar URLs
    const { error: updateError } = await adminClient
      .from("profiles")
      .update({
        avatar_url: originalUrl,
        processed_avatar_url: processedUrl,
      })
      .eq("id", traineeUserId);

    if (updateError) {
      console.error("Update avatar URLs error:", updateError);
      return { error: "Failed to update profile" };
    }

    // 6. Log activity
    await adminClient.from("activity_logs").insert({
      user_id: traineeUserId,
      action: "avatar_updated",
      actor_id: authResult.userId,
      metadata: {
        original_url: originalUrl,
        processed_url: processedUrl,
      },
    });

    // 7. Revalidate relevant paths
    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${traineeUserId}`);
    revalidatePath("/dashboard");

    return { success: true };

  } catch (error) {
    console.error("Update avatar URLs error:", error);
    return {
      error: error instanceof Error ? error.message : "Failed to update profile",
    };
  }
}

/**
 * Clear a trainee's avatar URLs (revert to initials default)
 *
 * Sets both avatar_url and processed_avatar_url to null
 *
 * @param traineeUserId - The trainee's user ID
 */
export async function clearTraineeAvatarUrls(
  traineeUserId: string
): Promise<ActionResult> {
  // 1. Verify admin/trainer role
  const authResult = await verifyAdminOrTrainer();
  if (!authResult.authorized) {
    return { error: "Unauthorized" };
  }

  // 2. Validate traineeUserId format
  if (!UUID_REGEX.test(traineeUserId)) {
    return { error: "Invalid user ID format" };
  }

  const adminClient = createAdminClient();

  try {
    // 3. Check if trainee exists
    const { data: traineeProfile, error: fetchError } = await adminClient
      .from("profiles")
      .select("id")
      .eq("id", traineeUserId)
      .single();

    if (fetchError || !traineeProfile) {
      return { error: "User not found" };
    }

    // 4. Clear both avatar URLs
    const { error: updateError } = await adminClient
      .from("profiles")
      .update({
        avatar_url: null,
        processed_avatar_url: null,
      })
      .eq("id", traineeUserId);

    if (updateError) {
      console.error("Clear avatar URLs error:", updateError);
      return { error: "Failed to update profile" };
    }

    // 5. Log activity
    await adminClient.from("activity_logs").insert({
      user_id: traineeUserId,
      action: "avatar_cleared",
      actor_id: authResult.userId,
    });

    // 6. Revalidate relevant paths
    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${traineeUserId}`);
    revalidatePath("/dashboard");

    return { success: true };

  } catch (error) {
    console.error("Clear avatar URLs error:", error);
    return {
      error: error instanceof Error ? error.message : "Failed to update profile",
    };
  }
}
