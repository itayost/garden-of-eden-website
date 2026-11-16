import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Checkin, EnergyLevel } from "./checkin";

type AdminClient = ReturnType<typeof createAdminClient>;

type CheckinRow = { checkin_date: string; sleep_hours: number; energy: number; soreness: boolean };

const CHECKIN_COLUMNS = "checkin_date, sleep_hours, energy, soreness";

function toCheckin(row: CheckinRow): Checkin {
  return {
    date: row.checkin_date,
    sleepHours: Number(row.sleep_hours),
    energy: row.energy as EnergyLevel,
    soreness: row.soreness,
  };
}

/**
 * The dashboard card's read: whether the viewer is a Trainee, and today's
 * answer. A failed read shows no card rather than breaking the dashboard.
 */
export async function loadTodayCheckin(
  userId: string,
  today: string,
): Promise<{ isTrainee: boolean; today: Checkin | null }> {
  try {
    const db = createAdminClient();
    const [{ data: profile, error: profileError }, { data: row, error: rowError }] = await Promise.all([
      db.from("profiles").select("role").eq("id", userId).maybeSingle(),
      db.from("trainee_checkins").select(CHECKIN_COLUMNS).eq("trainee_id", userId).eq("checkin_date", today).maybeSingle(),
    ]);
    if (profileError) throw new Error(profileError.message);
    if (rowError) throw new Error(rowError.message);
    return { isTrainee: profile?.role === "trainee", today: row ? toCheckin(row) : null };
  } catch (error) {
    console.error("[checkins] today unavailable:", error instanceof Error ? error.message : error);
    return { isTrainee: false, today: null };
  }
}

/** One Trainee's Check-ins from `fromDate` on, newest first. */
export async function loadRecentCheckins(db: AdminClient, traineeId: string, fromDate: string): Promise<Checkin[]> {
  const { data, error } = await db
    .from("trainee_checkins")
    .select(CHECKIN_COLUMNS)
    .eq("trainee_id", traineeId)
    .gte("checkin_date", fromDate)
    .order("checkin_date", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(toCheckin);
}
