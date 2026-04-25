import type { SupabaseClient } from "@supabase/supabase-js";
import type { AchievementBadgeType } from "../../types";

interface GrantOptions {
  /** When true, the badge is silently inserted as already-celebrated (used by backfill). */
  preCelebrated?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Idempotent badge grant. UNIQUE (user_id, badge_type) at the DB layer
 * means re-grants are no-ops.
 *
 * Best-effort: errors are logged but swallowed.
 */
export async function grantBadge(
  supabase: SupabaseClient,
  userId: string,
  badgeType: AchievementBadgeType,
  options: GrantOptions = {}
): Promise<{ ok: boolean; reason?: string }> {
  try {
    const { error } = await supabase
      .from("user_achievements")
      .insert({
        user_id: userId,
        badge_type: badgeType,
        celebrated: options.preCelebrated ?? false,
        metadata: options.metadata ?? null,
      });
    if (error) {
      // 23505 = unique_violation — expected and benign.
      if (error.code === "23505") return { ok: true };
      console.error(`grantBadge ${badgeType} failed for user ${userId}:`, error.message);
      return { ok: false, reason: error.message };
    }
    return { ok: true };
  } catch (e) {
    console.error("grantBadge threw:", e);
    return { ok: false, reason: String(e) };
  }
}
