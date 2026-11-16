/**
 * The player's side of a sent Weekly report: the dashboard card of the current
 * Report week. Read with the service role (the table has no policies) for the
 * signed-in Trainee's own id, which the dashboard got from the session.
 */
import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { BodyFacts, GoalFact } from "../fact-sheet/types";
import { fillName, firstNameOf } from "../fill-name";
import { lastCompletedWeekStart } from "../report-week";
import { storedSheetOf } from "./stored";

export type PlayerReport =
  | {
      kind: "report";
      id: string;
      weekStart: string;
      /** The player text with the first name filled in. */
      text: string;
      goals: GoalFact[];
      body: BodyFacts | null;
      /** The player opened it before: no need to stamp it again. */
      opened: boolean;
    }
  | {
      kind: "missed_you";
      id: string;
      weekStart: string;
      /** Null when the profile has no name: the card then greets without one. */
      firstName: string | null;
    };

const SHOWN_KINDS = ["report", "missed_you"];

/**
 * The Trainee's sent report or "התגעגענו" of the current Report week, or null.
 * An approved report that was not sent yet is not shown. A failed read is
 * logged and shows nothing: a missing card must never break the dashboard.
 */
export async function loadPlayerReport(userId: string, today: string): Promise<PlayerReport | null> {
  try {
    const { data: row, error } = await createAdminClient()
      .from("weekly_reports")
      .select(
        "id, kind, week_start, player_text, fact_sheet, player_first_opened_at, trainee:profiles!weekly_reports_trainee_id_fkey(full_name)",
      )
      .eq("trainee_id", userId)
      .eq("week_start", lastCompletedWeekStart(today))
      .eq("status", "sent")
      .in("kind", SHOWN_KINDS)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return null;

    const fullName = row.trainee?.full_name ?? null;
    if (row.kind === "missed_you") {
      return {
        kind: "missed_you",
        id: row.id,
        weekStart: row.week_start,
        firstName: fullName?.trim() ? firstNameOf(fullName) : null,
      };
    }

    const text = row.player_text?.trim();
    if (row.kind !== "report" || !text) return null;
    const stored = storedSheetOf(row.fact_sheet);
    return {
      kind: "report",
      id: row.id,
      weekStart: row.week_start,
      text: fillName(text, firstNameOf(fullName)),
      goals: stored?.sheet.goals ?? [],
      body: stored?.body ?? null,
      opened: row.player_first_opened_at !== null,
    };
  } catch (error) {
    console.error("[weekly-reports] player report unavailable:", error instanceof Error ? error.message : error);
    return null;
  }
}
