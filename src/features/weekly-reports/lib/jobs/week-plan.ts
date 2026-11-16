/**
 * Who gets what in one Report week, read through the service role: the
 * Trainees of the branches that take part, what they trained over the five
 * weeks up to the week's end, and their Freezes, put through
 * classifyTrainee(). Then the Fact sheets of the ones who get a report.
 *
 * Shared by the write job and the preview script, so it only reads: it never
 * writes a row and never calls the model. No next/cache here either, so the
 * script can load it outside Next.
 */
import "server-only";

import { loadAudienceCandidates } from "@/features/surveys/lib/queries";
import { readInChunks } from "@/lib/supabase/in-chunks";
import { addDays } from "@/lib/utils/iso-date";
import { reportBranches, type ReportSetting } from "../audience";
import { buildFactSheet } from "../fact-sheet/build";
import type { BuiltSheet } from "../fact-sheet/types";
import { must, unique, type Db } from "../queries/read";
import { loadArboxDays, loadFreezes, loadTrainingRows } from "../queries/training";
import { loadWeekInputs, type LoadedTraining } from "../queries/week-input";
import { reportWeekEnd } from "../report-week";
import { classifyTrainee, type ClassifiedTrainee } from "./week-rows";

/**
 * Four Report weeks before the week, the furthest back classifyWeek() looks
 * ("לא הגיעו 3 שבועות" is exactly 4 weeks back; anything older is nothing).
 */
const LOOKBACK_DAYS = 28;

export interface PlannedTrainee extends ClassifiedTrainee {
  /** For the preview's names only; never goes into a Fact sheet. */
  fullName: string;
}

export interface WeekPlan {
  weekStart: string;
  /** Every Trainee of the week's audience, each with its verdict, "nothing" included. */
  trainees: PlannedTrainee[];
  /** The five weeks of Roster rows and Arbox entrances, for the Fact sheets. */
  training: LoadedTraining;
  /** The Arbox read failed, so "התגעגענו" is off for the run. */
  arboxFailed: boolean;
}

/** The Arbox user id of each of these profiles that has one. */
async function readArboxIds(db: Db, ids: readonly string[]): Promise<Map<string, number>> {
  const rows = must(
    "profiles",
    await readInChunks(unique(ids), "id", () => db.from("profiles").select("id, arbox_user_id").order("id")),
  );
  return new Map(rows.flatMap((row) => (row.arbox_user_id === null ? [] : [[row.id, row.arbox_user_id] as const])));
}

/**
 * The week's audience and its verdicts under these settings. The write job
 * passes the stored settings; the preview script passes one branch of its own.
 */
export async function planWeek(db: Db, weekStart: string, settings: readonly ReportSetting[]): Promise<WeekPlan> {
  const onBranchIds = settings.filter((setting) => setting.mode !== "off").map((setting) => setting.branchId);
  const candidates = await loadAudienceCandidates(db, onBranchIds);
  const audience = candidates.flatMap((candidate) => {
    const branchIds = reportBranches(candidate, settings);
    return branchIds.length === 0 ? [] : [{ candidate, branchIds }];
  });
  const ids = audience.map(({ candidate }) => candidate.profileId);

  const from = addDays(weekStart, -LOOKBACK_DAYS);
  const to = reportWeekEnd(weekStart);
  const arboxIds = await readArboxIds(db, ids);
  const [roster, arbox, freezes] = await Promise.all([
    loadTrainingRows(db, ids, from, to),
    loadArboxDays(
      ids.map((id) => ({ id, arboxUserId: arboxIds.get(id) ?? null })),
      from,
      to,
    ),
    loadFreezes(db, ids, weekStart),
  ]);

  const trainees = audience.map(({ candidate, branchIds }): PlannedTrainee => {
    const traineeId = candidate.profileId;
    const kind = classifyTrainee(
      {
        traineeId,
        branchIds,
        roster: roster.get(traineeId) ?? [],
        arboxDates: (arbox.byProfile.get(traineeId) ?? []).map((entrance) => entrance.date),
        freezes: freezes.get(traineeId) ?? [],
      },
      weekStart,
      settings,
      arbox.failed,
    );
    return { traineeId, fullName: candidate.fullName, branchIds, kind };
  });

  return { weekStart, trainees, training: { roster, arbox: arbox.byProfile }, arboxFailed: arbox.failed };
}

/**
 * The Fact sheet, body and Holds of each of these Trainees for the plan's
 * week. `today` bounds the next game. A Trainee whose profile is gone gets
 * none (loadWeekInputs logs it).
 */
export async function buildSheets(
  db: Db,
  plan: WeekPlan,
  trainees: readonly ClassifiedTrainee[],
  today: string,
): Promise<Map<string, BuiltSheet>> {
  const inputs = await loadWeekInputs(
    db,
    trainees.map((trainee) => ({ id: trainee.traineeId, branchIds: [...trainee.branchIds] })),
    plan.weekStart,
    today,
    plan.training,
  );
  return new Map([...inputs].map(([id, input]) => [id, buildFactSheet(input)]));
}
