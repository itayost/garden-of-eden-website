import "server-only";

import type { RetentionReportData } from "@/lib/arbox/retention";
import { retentionProfileMatcher } from "@/lib/arbox/retention-branches";
import { readTraineeProfiles, toMatchableProfile } from "@/lib/arbox/retention-branches-load";
import { createAdminClient } from "@/lib/supabase/admin";
import { readAllPages } from "@/lib/supabase/in-chunks";
import { planNoteCarryOver } from "./note-key";

/**
 * Run after a month's report is stored: notes the ending-soon tab saved under
 * a trainee's own phone move to the Arbox row the report now lists them on
 * (planNoteCarryOver), so they stay on screen in both tabs. A move that hits a
 * note written there meanwhile is left alone and logged.
 */
export async function carryNotesToReport(reportMonth: string, report: RetentionReportData): Promise<void> {
  const db = createAdminClient();
  const { data: notes, error } = await readAllPages(() =>
    db.from("retention_notes").select("trainee_phone").eq("report_month", reportMonth).order("trainee_phone"),
  );
  if (error) throw new Error(`retention_notes read failed: ${error.message}`);
  if (notes.length === 0) return;

  const profiles = await readTraineeProfiles();
  const ownPhone = new Map(profiles.map((p) => [p.id, p.phone]));
  const match = retentionProfileMatcher(profiles.map(toMatchableProfile));
  const moves = planNoteCarryOver(
    report,
    (id) => ownPhone.get(id) ?? null,
    (entry) => match(entry)?.id,
    new Set(notes.map((n) => n.trainee_phone as string)),
  );

  for (const move of moves) {
    const { error: moveError } = await db
      .from("retention_notes")
      .update({ trainee_phone: move.to })
      .eq("report_month", reportMonth)
      .eq("trainee_phone", move.from);
    if (moveError) console.error(`[RetentionNotes] carry-over for ${reportMonth} failed:`, moveError.message);
  }
  if (moves.length > 0) console.info(`[RetentionNotes] ${moves.length} note(s) moved to their report rows for ${reportMonth}`);
}
