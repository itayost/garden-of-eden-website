import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { loadBranchIdsByProfile } from "@/features/branches/lib/memberships";
import { loadPlanQueues } from "@/features/plans/lib/queries";
import { fetchTrainingNowUserIds, type TrainingNow } from "@/lib/arbox/training-now";
import { createAdminClient } from "@/lib/supabase/admin";
import { chunk, readAllPages } from "@/lib/supabase/in-chunks";
import { israelDateStr } from "@/lib/utils/israel-time";
import { isValidDateString, isValidUUID } from "@/lib/validations/common";
import {
  arboxReadProblem,
  planActivityStamps,
  queueIsTraining,
  wouldLockAfterSweep,
  type SweptTrainee,
} from "./activity";

/**
 * The nightly course-access sweep. Who trains now, by Arbox (training-now.ts)
 * and by the app's Plan queues, gets `profiles.course_seen_training_on = today`;
 * then today's `course_access_sweeps` row is written. The newest row is the
 * last good sweep the course gate counts its grace period back from, so it is
 * written last, only after every read worked and every stamp landed. A failed
 * read, an empty memberships or cards report, or an implausibly small Arbox
 * list (`arboxReadProblem`) writes nothing at all: the gate stays on the
 * previous good sweep and nobody is locked by a bad night.
 *
 * Stamps only move forward, in the database too (`earlierStampFilter`), so a
 * rerun or a fulfillment stamp on the same day never moves one back.
 */

type Db = ReturnType<typeof createAdminClient>;

export interface ActivitySweepResult {
  good: boolean;
  reason: string | null;
  rows: TrainingNow["rows"];
  arboxIds: number;
  planTrainees: number;
  stamped: number;
  wouldLock: { id: string; fullName: string; branches: string[]; linkedToArbox: boolean }[];
}

interface LiveTrainee extends SweptTrainee {
  readonly fullName: string;
}

interface SweepInputs {
  readonly arbox: TrainingNow;
  readonly planTrainingIds: ReadonlySet<string>;
  readonly trainees: readonly LiveTrainee[];
  readonly lastArboxIds: number | null;
}

type SweepCounts = Pick<ActivitySweepResult, "rows" | "arboxIds" | "planTrainees">;

const NOT_READ: SweepCounts = { rows: { memberships: 0, cards: 0, onHold: 0 }, arboxIds: 0, planTrainees: 0 };

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** The rows a stamp may touch: no stamp yet, or one earlier than `day`. */
const earlierStampFilter = (day: string): string =>
  `course_seen_training_on.is.null,course_seen_training_on.lt.${day}`;

/**
 * Trainees whose Plan queue is running, waiting or frozen today. The queue
 * loaders throw here: a failed slice of Plans would leave its holders
 * unstamped, and a failed slice of rosters would make used-up Cards look live.
 */
async function readPlanTrainingIds(db: Db, today: string): Promise<Set<string>> {
  const { data, error } = await readAllPages(() => db.from("trainee_plans").select("profile_id").order("id"));
  if (error) throw new Error(`trainee_plans: ${error.message}`);
  const holders = [...new Set(data.map((row) => row.profile_id))];
  const queues = await Promise.all(
    chunk(holders).map((slice) => loadPlanQueues(db, slice, today, { onError: "throw" })),
  );
  const views = queues.flatMap((byProfile) => [...byProfile]);
  return new Set(views.filter(([, view]) => queueIsTraining(view)).map(([profileId]) => profileId));
}

async function readLiveTrainees(db: Db): Promise<LiveTrainee[]> {
  const { data, error } = await readAllPages(() =>
    db
      .from("profiles")
      .select("id, full_name, arbox_user_id, course_seen_training_on, course_access_until")
      .eq("role", "trainee")
      .is("deleted_at", null)
      .order("id"),
  );
  if (error) throw new Error(`profiles: ${error.message}`);
  return data.map((row) => ({
    id: row.id,
    fullName: row.full_name ?? "",
    arboxUserId: row.arbox_user_id,
    seenOn: row.course_seen_training_on,
    accessUntil: row.course_access_until,
  }));
}

/** The Arbox id count of the newest sweep row, or null before the first one. */
async function readLastArboxIds(db: Db): Promise<number | null> {
  const { data, error } = await db
    .from("course_access_sweeps")
    .select("arbox_ids")
    .order("swept_on", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`course_access_sweeps: ${error.message}`);
  return data?.arbox_ids ?? null;
}

async function readSweepInputs(db: Db, today: string): Promise<SweepInputs> {
  const [arbox, planTrainingIds, trainees, lastArboxIds] = await Promise.all([
    fetchTrainingNowUserIds(),
    readPlanTrainingIds(db, today),
    readLiveTrainees(db),
    readLastArboxIds(db),
  ]);
  return { arbox, planTrainingIds, trainees, lastArboxIds };
}

/** Branch id to Hebrew name. Only the locked list uses it, so a failed read shows ids rather than failing the sweep. */
async function readBranchNames(db: Db): Promise<Map<string, string>> {
  const { data, error } = await db.from("branches").select("id, name_he");
  if (error) {
    console.error("[Course Activity] branch names read failed:", error.message);
    return new Map();
  }
  return new Map((data ?? []).map((branch) => [branch.id, branch.name_he]));
}

async function describeLocked(db: Db, locked: readonly LiveTrainee[]): Promise<ActivitySweepResult["wouldLock"]> {
  if (locked.length === 0) return [];
  const [memberships, names] = await Promise.all([
    loadBranchIdsByProfile(db, locked.map((trainee) => trainee.id)),
    readBranchNames(db),
  ]);
  return locked.map((trainee) => ({
    id: trainee.id,
    fullName: trainee.fullName,
    branches: (memberships.get(trainee.id) ?? []).map((branchId) => names.get(branchId) ?? branchId),
    linkedToArbox: trainee.arboxUserId !== null,
  }));
}

/** Stamps `today` on the ids, 200 per request; stops at the first error. */
async function writeStamps(db: Db, ids: readonly string[], today: string): Promise<{ stamped: number; error: string | null }> {
  let stamped = 0;
  for (const slice of chunk(ids)) {
    const { data, error } = await db
      .from("profiles")
      .update({ course_seen_training_on: today })
      .in("id", slice)
      .or(earlierStampFilter(today))
      .select("id");
    if (error) return { stamped, error: error.message };
    stamped += data?.length ?? 0;
  }
  return { stamped, error: null };
}

async function writeSweepRow(db: Db, today: string, counts: SweepCounts, stamped: number): Promise<string | null> {
  const { error } = await db
    .from("course_access_sweeps")
    .upsert(
      { swept_on: today, arbox_ids: counts.arboxIds, plan_trainees: counts.planTrainees, stamped },
      { onConflict: "swept_on" },
    );
  return error ? error.message : null;
}

function notGood(reason: string, counts: SweepCounts, stamped = 0, wouldLock: ActivitySweepResult["wouldLock"] = []): ActivitySweepResult {
  console.error(`[Course Activity] sweep not good, no sweep row written: ${reason}`);
  return { good: false, reason, ...counts, stamped, wouldLock };
}

async function sweep(db: Db, inputs: SweepInputs, today: string, dryRun: boolean): Promise<ActivitySweepResult> {
  const { arbox, planTrainingIds, trainees, lastArboxIds } = inputs;
  const counts: SweepCounts = { rows: arbox.rows, arboxIds: arbox.ids.size, planTrainees: planTrainingIds.size };
  const arboxProblem = arboxReadProblem({ rows: counts.rows, arboxIds: counts.arboxIds, lastGoodArboxIds: lastArboxIds });
  if (arboxProblem) return notGood(arboxProblem, counts);

  const toStamp = planActivityStamps({ profiles: trainees, arboxTrainingIds: arbox.ids, planTrainingIds, today });
  const locked = wouldLockAfterSweep({ profiles: trainees, stampedIds: new Set(toStamp), today });
  const wouldLock = await describeLocked(db, locked);
  if (dryRun) return { good: true, reason: null, ...counts, stamped: toStamp.length, wouldLock };

  const { stamped, error } = await writeStamps(db, toStamp, today);
  if (error) return notGood(`stamp_failed: ${error}`, counts, stamped, wouldLock);
  const rowError = await writeSweepRow(db, today, counts, stamped);
  if (rowError) return notGood(`sweep_row_failed: ${rowError}`, counts, stamped, wouldLock);
  return { good: true, reason: null, ...counts, stamped, wouldLock };
}

/**
 * Runs the sweep. Never throws: anything that goes wrong comes back as
 * `good: false` with its reason. A dry run reads everything and writes nothing.
 */
export async function syncCourseActivity(opts: { dryRun: boolean; today?: string }): Promise<ActivitySweepResult> {
  const today = opts.today ?? israelDateStr(new Date());
  if (!isValidDateString(today)) return notGood("bad_day", NOT_READ);
  try {
    const db = createAdminClient();
    const inputs = await readSweepInputs(db, today);
    return await sweep(db, inputs, today, opts.dryRun);
  } catch (error) {
    return notGood(`failed: ${messageOf(error)}`, NOT_READ);
  }
}

/**
 * Stamps one trainee as seen training today, as fulfillment does after a sale:
 * only when he has no stamp or an earlier one. Logs and never throws, so it
 * can never fail the sale it follows.
 */
export async function stampSeenTraining(db: SupabaseClient, profileId: string, today: string): Promise<void> {
  if (!isValidUUID(profileId) || !isValidDateString(today)) {
    console.error("[Course Activity] stampSeenTraining refused a bad profile id or day");
    return;
  }
  try {
    const { error } = await db
      .from("profiles")
      .update({ course_seen_training_on: today })
      .eq("id", profileId)
      .or(earlierStampFilter(today));
    if (error) console.error(`[Course Activity] stamp ${profileId} failed:`, error.message);
  } catch (error) {
    console.error(`[Course Activity] stamp ${profileId} failed:`, messageOf(error));
  }
}
