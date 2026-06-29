"use server";

import { createClient } from "@/lib/supabase/server";
import { verifyUserAccess } from "@/lib/actions/shared/verify-user-access";
import { typedFrom } from "@/lib/supabase/helpers";
import { isValidUUID } from "@/lib/validations/common";
import { grantBadge } from "@/features/achievements/lib/actions/grant-badge";

/**
 * Toggle a drill's done state for the current user.
 * If a progress row exists -> delete it (un-done).
 * If no row exists -> insert it (done), then award badges best-effort.
 */
export async function toggleDrillDone(
  drillId: string
): Promise<{ success: boolean; done: boolean; error?: string }> {
  if (!isValidUUID(drillId)) {
    return { success: false, done: false, error: "מזהה תרגיל לא תקין" };
  }

  // Get current user id
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    return { success: false, done: false, error: "לא מחובר" };
  }

  const userId = user.id;

  const { authorized, supabase } = await verifyUserAccess(userId);
  if (!authorized) {
    return { success: false, done: false, error: "אין הרשאה" };
  }

  // Check for existing progress row
  const { data: existing } = await typedFrom(supabase, "book_drill_progress")
    .select("id")
    .eq("user_id", userId)
    .eq("drill_id", drillId)
    .maybeSingle();

  if (existing) {
    // Un-mark: delete the row
    const { error: deleteError } = await typedFrom(supabase, "book_drill_progress")
      .delete()
      .eq("id", existing.id);
    if (deleteError) {
      return { success: false, done: true, error: "ביטול הסימון נכשל" };
    }
    return { success: true, done: false };
  }

  // Mark done: insert row
  const { error: insertError } = await typedFrom(supabase, "book_drill_progress").insert({
    user_id: userId,
    drill_id: drillId,
    status: "done",
  });

  if (insertError) {
    console.error("toggleDrillDone insert failed:", insertError);
    return { success: false, done: false, error: "שמירה נכשלה, נסה שוב" };
  }

  // Award badges — idempotent and best-effort: never propagate errors
  try {
    const { data: doneRows } = await typedFrom(supabase, "book_drill_progress")
      .select("drill_id")
      .eq("user_id", userId);

    const doneCount: number = doneRows?.length ?? 0;

    // First drill ever
    await grantBadge(supabase, userId, "book_first_drill");

    // Ten drills milestone
    if (doneCount >= 10) {
      await grantBadge(supabase, userId, "book_ten_drills");
    }

    // Category complete: check if every drill across ALL parameters in the drill's category is done
    try {
      // 1. Look up the drill's parameter_id
      const { data: drillRow } = await typedFrom(supabase, "book_drills")
        .select("parameter_id")
        .eq("id", drillId)
        .maybeSingle();

      if (drillRow?.parameter_id) {
        const parameterId: string = drillRow.parameter_id;

        // 2. Look up that parameter's category_id
        const { data: paramRow } = await typedFrom(supabase, "book_parameters")
          .select("category_id")
          .eq("id", parameterId)
          .maybeSingle();

        if (paramRow?.category_id) {
          const categoryId: string = paramRow.category_id;

          // 3. Gather all parameter ids in that category
          const { data: categoryParams } = await typedFrom(supabase, "book_parameters")
            .select("id")
            .eq("category_id", categoryId);

          const categoryParamIds: string[] = (categoryParams ?? []).map(
            (p: { id: string }) => p.id
          );

          if (categoryParamIds.length > 0) {
            // 4. Count all drills across those parameters
            const { data: categoryDrills } = await typedFrom(supabase, "book_drills")
              .select("id")
              .in("parameter_id", categoryParamIds);

            const categoryTotal: number = categoryDrills?.length ?? 0;

            if (categoryTotal > 0) {
              const categoryDrillIds: string[] = (categoryDrills ?? []).map(
                (d: { id: string }) => d.id
              );

              // 5. Count how many of those drills the user has done
              const { data: categoryDoneRows } = await typedFrom(supabase, "book_drill_progress")
                .select("drill_id")
                .eq("user_id", userId)
                .in("drill_id", categoryDrillIds);

              const categoryDoneCount: number = categoryDoneRows?.length ?? 0;

              // 6. Award badge only when every drill in the full category is done
              if (categoryDoneCount === categoryTotal) {
                await grantBadge(supabase, userId, "book_category_complete");
              }
            }
          }
        }
      }
    } catch (categoryErr) {
      console.error("toggleDrillDone category badge check failed:", categoryErr);
    }

    // All drills complete
    try {
      const { data: allDrills } = await typedFrom(supabase, "book_drills")
        .select("id");

      const totalCount: number = allDrills?.length ?? 0;
      if (totalCount > 0 && doneCount === totalCount) {
        await grantBadge(supabase, userId, "book_all_drills");
      }
    } catch (allErr) {
      console.error("toggleDrillDone all-drills badge check failed:", allErr);
    }
  } catch (badgeErr) {
    // Badge logic must never fail the toggle
    console.error("toggleDrillDone badge grants failed:", badgeErr);
  }

  return { success: true, done: true };
}
