/**
 * Writing one report again from the queue (כתוב מחדש, and בן / בת), and
 * rebuilding its Fact sheet once its gender is known. Server-only helpers of
 * the staff actions; the model is called with a direct request, as the write
 * job does after 07:30.
 */
import "server-only";

import type { TablesUpdate } from "@/types/database";
import { buildFactSheet } from "../fact-sheet/build";
import type { ArboxEntrance, BuiltSheet, FactSheet, HoldReason } from "../fact-sheet/types";
import { replaceTextProblems, reportProblems } from "../guardrails";
import type { Db } from "../queries/read";
import { offeredDrillIds, toJson, type StoredSheet } from "../queries/stored";
import { loadTrainingRows } from "../queries/training";
import { loadWeekInputs } from "../queries/week-input";
import { reportWeekEnd } from "../report-week";
import { anthropicClient, QUEUE_LIMITS } from "../writer/client";
import { writeDirect } from "../writer/direct";
import { writerModel } from "../writer/request";
import { PROMPT_VERSION } from "../writer/style-guide";

export type WrittenValues =
  | { ok: true; held: boolean; values: TablesUpdate<"weekly_reports"> }
  | { ok: false; error: string };

export const NO_WRITER = "הכתיבה לא זמינה כרגע: לא הוגדר מפתח למודל";
export const WRITING_FAILED_TEXT = "הכתיבה נכשלה, נסו שוב";

/**
 * Writes the texts for a sheet and gives the row's new values: the texts,
 * the model's original output, the guardrails' problems in place of the old
 * text problems (sensitive and manual Holds stay), and a fresh start for the
 * edit fields. Nothing is saved here.
 */
export async function writeTextValues(sheet: FactSheet, holds: readonly HoldReason[]): Promise<WrittenValues> {
  const client = anthropicClient(QUEUE_LIMITS);
  if (client === null) return { ok: false, error: NO_WRITER };
  const outcome = await writeDirect(client, sheet, writerModel());
  if (!outcome.ok) {
    console.error(`[weekly-reports] rewrite failed: ${outcome.reason}`);
    return { ok: false, error: WRITING_FAILED_TEXT };
  }
  const next = replaceTextProblems(holds, reportProblems(sheet, outcome.output));
  return {
    ok: true,
    held: next.length > 0,
    values: {
      player_text: outcome.output.player_text,
      parent_text: outcome.output.parent_text,
      drill_ids: offeredDrillIds(sheet, outcome.output.drill_ids),
      original_output: toJson(outcome.output),
      model: outcome.model,
      prompt_version: PROMPT_VERSION,
      usage: toJson(outcome.usage),
      written_at: new Date().toISOString(),
      edited_by: null,
      edited_at: null,
      edit_ratio: null,
      hold_reasons: toJson(next),
      status: next.length > 0 ? "held" : "pending",
    },
  };
}

/** The Arbox days the stored sheet counted: the job's own read of the week. */
function storedArboxDays(stored: StoredSheet | null): ArboxEntrance[] {
  return (stored?.sheet.attendance.days ?? [])
    .filter((day) => day.source === "ארבוקס")
    .map((day) => ({ date: day.date, className: day.focus }));
}

export interface RebuildTarget {
  traineeId: string;
  weekStart: string;
  branchIds: readonly string[];
  stored: StoredSheet | null;
}

/**
 * The row's Fact sheet built again from the week's data, for one Trainee.
 * The Arbox entrances are the ones the stored sheet already counted, so a
 * click in the queue never reads the whole Arbox report again. Null when the
 * Trainee's profile is gone.
 */
export async function rebuildSheet(db: Db, target: RebuildTarget, today: string): Promise<BuiltSheet | null> {
  const roster = await loadTrainingRows(db, [target.traineeId], target.weekStart, reportWeekEnd(target.weekStart));
  const inputs = await loadWeekInputs(
    db,
    [{ id: target.traineeId, branchIds: [...target.branchIds] }],
    target.weekStart,
    today,
    { roster, arbox: new Map([[target.traineeId, storedArboxDays(target.stored)]]) },
  );
  const input = inputs.get(target.traineeId);
  return input ? buildFactSheet(input) : null;
}
