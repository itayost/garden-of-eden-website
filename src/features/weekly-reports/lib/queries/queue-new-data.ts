/**
 * What arrived for a Trainee during the Report week, with when it arrived:
 * Shift reports that name them (by `updated_at`), Quick tags (`created_at`)
 * and notes (`updated_at`) on the week's Slots. The queue compares these with
 * the text's `written_at` to show "נוספו נתונים". Service role; only the
 * columns that say who is named and when are read, never a note's text.
 */
import "server-only";

import { readAllPages, readInChunks } from "@/lib/supabase/in-chunks";
import { CATEGORY_COLUMNS } from "@/lib/utils/trainee-notes";
import { groupBy, must, type Db } from "./read";

interface DayRange {
  from: string;
  to: string;
}

/** Every category's id list and per-trainee entries, and when the report last changed. */
const SHIFT_NAMES_SELECT =
  "id, updated_at, new_trainees_ids, new_trainees_per_trainee, discipline_trainee_ids, discipline_per_trainee, injuries_trainee_ids, injuries_per_trainee, limitations_trainee_ids, limitations_per_trainee, worked_on_trainee_ids, worked_on_per_trainee, achievements_trainee_ids, achievements_per_trainee, mental_state_trainee_ids, mental_state_per_trainee, complaints_trainee_ids, complaints_per_trainee, insufficient_attention_trainee_ids, insufficient_attention_per_trainee, pro_candidates_trainee_ids, pro_candidates_per_trainee, social_skills_trainee_ids, social_skills_per_trainee, homework_trainee_ids, homework_per_trainee, video_feedback_trainee_ids, video_feedback_per_trainee, praise_trainee_ids, praise_per_trainee";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Everyone a Shift report names, in any category, by id list or per-trainee key. */
function namedIds(report: Record<string, unknown>): Set<string> {
  return new Set(
    CATEGORY_COLUMNS.flatMap((column) => {
      const ids = report[column.traineeIdsKey];
      const entries = report[column.perTraineeKey];
      return [
        ...(Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : []),
        ...(isPlainObject(entries) ? Object.keys(entries) : []),
      ];
    }),
  );
}

async function shiftReportTimes(db: Db, traineeIds: ReadonlySet<string>, range: DayRange) {
  const reports: Record<string, unknown>[] = must(
    "trainer_shift_reports",
    await readAllPages(() =>
      db
        .from("trainer_shift_reports")
        .select(SHIFT_NAMES_SELECT)
        .gte("report_date", range.from)
        .lte("report_date", range.to)
        .order("id"),
    ),
  );
  return reports.flatMap((report) => {
    const at = report.updated_at;
    if (typeof at !== "string") return [];
    return [...namedIds(report)].filter((id) => traineeIds.has(id)).map((traineeId) => ({ traineeId, at }));
  });
}

async function tagTimes(db: Db, traineeIds: readonly string[], range: DayRange) {
  const rows = must(
    "slot_trainee_tags",
    await readInChunks(traineeIds, "trainee_id", () =>
      db
        .from("slot_trainee_tags")
        .select("id, trainee_id, created_at, slot:daily_schedule_slots!inner(schedule_date)")
        .gte("slot.schedule_date", range.from)
        .lte("slot.schedule_date", range.to)
        .order("id"),
    ),
  );
  return rows.map((row) => ({ traineeId: row.trainee_id, at: row.created_at }));
}

async function noteTimes(db: Db, traineeIds: readonly string[], range: DayRange) {
  const rows = must(
    "slot_trainee_notes",
    await readInChunks(traineeIds, "trainee_id", () =>
      db
        .from("slot_trainee_notes")
        .select("slot_id, trainee_id, updated_at, slot:daily_schedule_slots!inner(schedule_date)")
        .gte("slot.schedule_date", range.from)
        .lte("slot.schedule_date", range.to)
        .order("slot_id")
        .order("trainee_id"),
    ),
  );
  return rows.map((row) => ({ traineeId: row.trainee_id, at: row.updated_at }));
}

/** When something arrived for each Trainee during the week, by Trainee. */
export async function readNewDataTimes(
  db: Db,
  traineeIds: readonly string[],
  range: DayRange,
): Promise<Map<string, string[]>> {
  if (traineeIds.length === 0) return new Map();
  const [shift, tags, notes] = await Promise.all([
    shiftReportTimes(db, new Set(traineeIds), range),
    tagTimes(db, traineeIds, range),
    noteTimes(db, traineeIds, range),
  ]);
  return new Map(
    [...groupBy([...shift, ...tags, ...notes], (event) => event.traineeId)].map(([id, events]) => [
      id,
      events.map((event) => event.at),
    ]),
  );
}
