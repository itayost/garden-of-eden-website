import "server-only";

import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhoneIL } from "@/lib/validations/common";
import { israelMinutesOfDay } from "@/lib/utils/israel-time";
import { israelToday } from "@/lib/utils/tasks";
import { HAIFA_BRANCH, KIRYAT_ATA_BRANCH } from "@/lib/branches/arbox-branch-match";
import { historyStatus } from "@/lib/schedule/training-history";
import { loadAllBranches } from "@/features/branches/lib/memberships";
import { loadEndingInputs } from "@/features/finance/lib/queries";
import { getAttendanceMonthKeys, getAttendanceMonthRanges, type RetentionReportData } from "./retention";
import {
  calendarMonthCounts,
  withBranchAttendance,
  type BranchAttendanceInput,
  type CalendarPlanEnd,
  type CalendarSession,
  type MatchableProfile,
  type RetentionProfile,
  type RetentionViewData,
} from "./retention-branches";

/**
 * Reads behind the retention report's branch split, through the service role:
 * profile_branches and the roster tables are not readable by trainers under
 * RLS. Callers gate with verifyAdminOrTrainer and scope the result by phone.
 */

const PAGE = 1000;

type PageResult<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

async function readAll<T>(page: (from: number, to: number) => PageResult<T>): Promise<T[]> {
  for (let from = 0, rows: T[] = []; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const next = rows.concat(data ?? []);
    if ((data ?? []).length < PAGE) return next;
    rows = next;
  }
}

interface SessionRow {
  trainee_id: string;
  trainee_name: string;
  cancelled_at: string | null;
  late_cancel: boolean;
  removed_at: string | null;
  slot: { schedule_date: string; start_time: string; called_off_at: string | null } | null;
}

/** Sessions used at a branch between two dates: attended or cancelled late, as the plan queue counts them. */
async function loadBranchSessions(
  db: SupabaseClient,
  branchId: string,
  from: string,
  to: string,
): Promise<CalendarSession[]> {
  const rows = await readAll<SessionRow>((lo, hi) =>
    db
      .from("daily_schedule_slot_trainees")
      .select(
        "trainee_id, trainee_name, cancelled_at, late_cancel, removed_at, slot:daily_schedule_slots!inner(schedule_date, start_time, called_off_at)",
      )
      .not("trainee_id", "is", null)
      .eq("slot.branch_id", branchId)
      .gte("slot.schedule_date", from)
      .lte("slot.schedule_date", to)
      .order("id")
      .range(lo, hi) as unknown as PageResult<SessionRow>,
  );
  const now = { date: israelToday(), minutes: israelMinutesOfDay(new Date()) };
  return rows.flatMap((row): CalendarSession[] => {
    if (!row.slot) return [];
    const status = historyStatus(
      {
        id: "",
        trainee_name: row.trainee_name,
        schedule_date: row.slot.schedule_date,
        start_time: row.slot.start_time,
        branch_id: branchId,
        location_he: null,
        trainer_names: [],
        cancelled_at: row.cancelled_at,
        late_cancel: row.late_cancel,
        removed_at: row.removed_at,
        called_off: row.slot.called_off_at !== null,
      },
      now,
    );
    return status === "attended" || status === "late_cancel"
      ? [{ traineeId: row.trainee_id, date: row.slot.schedule_date }]
      : [];
  });
}

interface TraineeProfileRow {
  id: string;
  phone: string | null;
  arbox_user_id: number | null;
}

/** Every trainee profile, read once per request: the report view and the ending-soon tab both match against it. */
export const readTraineeProfiles = cache(
  async (): Promise<TraineeProfileRow[]> => {
    const db = createAdminClient();
    return readAll<TraineeProfileRow>((lo, hi) =>
      db.from("profiles").select("id, phone, arbox_user_id").eq("role", "trainee").order("id").range(lo, hi),
    );
  },
);

export function toMatchableProfile(row: TraineeProfileRow): MatchableProfile {
  return { id: row.id, phone: normalizePhoneIL(row.phone), arboxUserId: row.arbox_user_id };
}

/** The חיפה and קריית אתא branch ids, by name; null where a branch is missing. */
export const retentionBranchIds = cache(async (): Promise<{ haifaId: string | null; kiryatId: string | null }> => {
  const branches = await loadAllBranches(createAdminClient());
  return {
    haifaId: branches.find((b) => b.name_he.trim() === HAIFA_BRANCH)?.id ?? null,
    kiryatId: branches.find((b) => b.name_he.trim() === KIRYAT_ATA_BRANCH)?.id ?? null,
  };
});

async function loadInput(reportMonth: string): Promise<BranchAttendanceInput | null> {
  const db = createAdminClient();
  const { haifaId, kiryatId } = await retentionBranchIds();
  if (!kiryatId) {
    console.warn("[RetentionBranches] No קריית אתא branch; the split is skipped.");
    return null;
  }

  const monthKeys = getAttendanceMonthKeys(reportMonth);
  const ranges = getAttendanceMonthRanges(reportMonth);
  const from = ranges[ranges.length - 1].from;
  const to = ranges[0].to;
  const branchIds = haifaId ? [haifaId, kiryatId] : [kiryatId];

  const [profileRows, memberships, sessions, ending] = await Promise.all([
    readTraineeProfiles(),
    readAll<{ profile_id: string; branch_id: string }>((lo, hi) =>
      db
        .from("profile_branches")
        .select("profile_id, branch_id")
        .in("branch_id", branchIds)
        .order("profile_id")
        .range(lo, hi),
    ),
    loadBranchSessions(db, kiryatId, from, to),
    loadEndingInputs(kiryatId),
  ]);

  const inBranch = (branchId: string | null) =>
    new Set(memberships.filter((m) => m.branch_id === branchId).map((m) => m.profile_id));
  const haifa = inBranch(haifaId);
  const kiryat = inBranch(kiryatId);

  const profiles: RetentionProfile[] = profileRows.map((row) => ({
    ...toMatchableProfile(row),
    haifa: haifa.has(row.id),
    kiryat: kiryat.has(row.id),
  }));
  const ownPhone = new Map(profileRows.map((row) => [row.id, row.phone]));

  // Only trainees assigned to קריית אתא: a Plan sold there to someone since
  // moved to חיפה is not that branch's retention.
  const calendarPlanEnds: CalendarPlanEnd[] = ending
    .filter((row) => kiryat.has(row.profileId))
    .map((row) => ({
      profileId: row.profileId,
      name: row.traineeName,
      phone: ownPhone.get(row.profileId) ?? null,
      endsOn: row.endsOn,
      planName: row.planName,
      cardsOnly: row.cardsOnly,
    }));

  return {
    reportMonth,
    monthKeys,
    profiles,
    calendarCounts: calendarMonthCounts(sessions, monthKeys),
    calendarPlanEnds,
  };
}

/**
 * The report with its חיפה / קריית אתא columns and the קריית אתא trainees
 * whose plans end this month. If a read fails, the Arbox report is still
 * shown, with its numbers under חיפה and nothing from the calendar.
 */
export async function loadRetentionView(report: RetentionReportData, reportMonth: string): Promise<RetentionViewData> {
  let input: BranchAttendanceInput | null = null;
  try {
    input = await loadInput(reportMonth);
  } catch (err) {
    console.error("[RetentionBranches] Calendar split failed:", err);
  }
  return withBranchAttendance(
    report,
    input ?? {
      reportMonth,
      monthKeys: getAttendanceMonthKeys(reportMonth),
      profiles: [],
      calendarCounts: new Map(),
      calendarPlanEnds: [],
    },
  );
}
