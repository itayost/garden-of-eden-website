"use server";

import { createClient } from "@/lib/supabase/server";
import { updateInTable, insertAndSelect, insertIntoTable } from "@/lib/supabase/helpers";
import { verifyAdminOrTrainer } from "@/lib/actions/shared/verify-admin";
import { isValidUUID } from "@/lib/validations/common";
import type { PlayerStatsFormData } from "@/lib/validations/player-stats";

export async function savePlayerStatsAction(
  userId: string,
  data: PlayerStatsFormData,
  existingStatsId: string | null
) {
  if (!isValidUUID(userId)) return { error: "מזהה משתמש לא תקין" };
  if (existingStatsId && !isValidUUID(existingStatsId)) return { error: "מזהה לא תקין" };

  const { error: authError, user } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  const supabase = await createClient();
  const overall_rating = Math.round(
    (data.pace + data.shooting + data.passing + data.dribbling + data.defending + data.physical) / 6
  );

  const statsData = {
    user_id: userId,
    ...data,
    overall_rating,
    last_updated_by: user!.id,
    updated_at: new Date().toISOString(),
  };

  const historyData = {
    user_id: userId,
    overall_rating,
    pace: data.pace,
    shooting: data.shooting,
    passing: data.passing,
    dribbling: data.dribbling,
    defending: data.defending,
    physical: data.physical,
    updated_by: user!.id,
  };

  if (existingStatsId) {
    const { error } = await updateInTable(supabase, "player_stats", statsData, "id", existingStatsId);
    if (error) return { error: "שגיאה בעדכון סטטיסטיקות" };

    await insertIntoTable(supabase, "player_stats_history", {
      player_stats_id: existingStatsId,
      ...historyData,
      update_reason: "עדכון סטטיסטיקות",
    });
  } else {
    const { data: newStats, error } = await insertAndSelect<{ id: string }>(supabase, "player_stats", statsData);
    if (error || !newStats) return { error: "שגיאה ביצירת כרטיס" };

    await insertIntoTable(supabase, "player_stats_history", {
      player_stats_id: newStats.id,
      ...historyData,
      update_reason: "יצירת כרטיס ראשוני",
    });
  }

  return { success: true };
}
