import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import type { RetentionNote } from "@/lib/actions/admin-retention";
import type { RetentionReportData } from "@/lib/arbox/retention";
import { retentionProfileMatcher } from "@/lib/arbox/retention-branches";
import { readTraineeProfiles, retentionBranchIds, toMatchableProfile } from "@/lib/arbox/retention-branches-load";
import { createAdminClient } from "@/lib/supabase/admin";
import { readAllPages } from "@/lib/supabase/in-chunks";
import { israelToday } from "@/lib/utils/tasks";
import type { NoteColor } from "@/lib/validations/churned-customers";
import { endingSoonCount, splitEnding, type EndingSplit } from "@/features/finance/lib/ending-soon";
import { loadEndingInputs, type EndingRow } from "@/features/finance/lib/queries";
import { endingReportLink, reportMonthOf, type EndingReportLink, type RetentionNoteKey } from "./note-key";
import { callerRetentionScope, loadListedTrainees } from "./scope";
import { scopeRetentionNotes, type RetentionScope } from "./visibility";

/**
 * The ending-soon tab of /admin/retention: קריית אתא Plan queues that end
 * soon or ended lately (splitEnding), each with the retention note of the row
 * the report shows that trainee on (endingNoteKey), so note, color and
 * trainer are one record in both places. חיפה runs on Arbox and is left out.
 */

export interface EndingRetentionRow extends EndingRow, EndingReportLink {
  readonly note: RetentionNote | null;
}

export type EndingRetention = EndingSplit<EndingRetentionRow>;

export type EndingRetentionResult = { success: true; data: EndingRetention } | { success: false; error: string };

const LOAD_FAILED = "לא הצלחנו לטעון את המסתיימים בקרוב. נסו לרענן את הדף";
const NONE: EndingRetention = { ending: [], expired: [] };

const keyId = (key: RetentionNoteKey) => `${key.reportMonth}|${key.phone}`;

interface NoteRow {
  report_month: string;
  trainee_phone: string;
  note: string;
  note_color: string | null;
  author_id: string;
  updated_at: string;
  assigned_trainer_id: string | null;
}

/** The notes on these keys, as the caller may read them; a month whose scope check cannot run shows none. */
async function readNotes(
  db: SupabaseClient,
  keys: readonly RetentionNoteKey[],
  scope: RetentionScope | null,
): Promise<Map<string, RetentionNote>> {
  const months = [...new Set(keys.map((k) => k.reportMonth))];
  const wanted = new Set(keys.map(keyId));
  const { data, error } = await readAllPages(() =>
    db
      .from("retention_notes")
      .select("report_month, trainee_phone, note, note_color, author_id, updated_at, assigned_trainer_id")
      .in("report_month", months)
      .order("report_month")
      .order("trainee_phone"),
  );
  if (error) throw new Error(`retention_notes read failed: ${error.message}`);

  const byMonth = new Map<string, Map<string, RetentionNote>>();
  for (const row of (data ?? []) as NoteRow[]) {
    if (!wanted.has(keyId({ reportMonth: row.report_month, phone: row.trainee_phone }))) continue;
    const month = byMonth.get(row.report_month) ?? new Map<string, RetentionNote>();
    month.set(row.trainee_phone, {
      note: row.note,
      note_color: (row.note_color ?? "none") as NoteColor,
      author_id: row.author_id,
      updated_at: row.updated_at,
      assigned_trainer_id: row.assigned_trainer_id,
    });
    byMonth.set(row.report_month, month);
  }

  const notes = new Map<string, RetentionNote>();
  for (const [month, monthNotes] of byMonth) {
    let visible: ReadonlyMap<string, RetentionNote> = monthNotes;
    if (scope !== null) {
      const listed = await loadListedTrainees(month, [...monthNotes.keys()]);
      visible = listed === null ? new Map() : scopeRetentionNotes(monthNotes, listed, scope);
    }
    for (const [phone, note] of visible) notes.set(keyId({ reportMonth: month, phone }), note);
  }
  return notes;
}

async function loadEndingRetention(scope: RetentionScope | null): Promise<EndingRetention> {
  const { kiryatId } = await retentionBranchIds();
  if (!kiryatId) return NONE;

  const all = await loadEndingInputs(kiryatId);
  const inScope = scope === null ? all : all.filter((row) => scope.profileIds.has(row.profileId));
  const split = splitEnding(inScope, israelToday());
  const shown = [...split.ending, ...split.expired];
  if (shown.length === 0) return NONE;

  const db = createAdminClient();
  const months = [...new Set(shown.map((row) => reportMonthOf(row.endsOn)))];
  const [reportRead, profiles] = await Promise.all([
    db.from("retention_reports").select("report_month, data").in("report_month", months),
    readTraineeProfiles(),
  ]);
  if (reportRead.error) throw new Error(`retention_reports read failed: ${reportRead.error.message}`);
  const reports = new Map(
    (reportRead.data ?? []).map((r) => [r.report_month as string, r.data as unknown as RetentionReportData]),
  );
  const match = retentionProfileMatcher(profiles.map(toMatchableProfile));
  const matchId = (entry: Parameters<typeof match>[0]) => match(entry)?.id;

  const linkOf = new Map(
    shown.map((row) => [
      row.profileId,
      endingReportLink(
        { profileId: row.profileId, endsOn: row.endsOn, traineeName: row.traineeName, ownPhone: row.ownPhone },
        reports.get(reportMonthOf(row.endsOn)) ?? null,
        matchId,
      ),
    ]),
  );
  const notes = await readNotes(db, [...linkOf.values()].map((link) => link.noteKey), scope);

  const keyed = <R extends EndingRow>(row: R): R & EndingReportLink & Pick<EndingRetentionRow, "note"> => {
    const link = linkOf.get(row.profileId) as EndingReportLink;
    return { ...row, ...link, note: notes.get(keyId(link.noteKey)) ?? null };
  };
  return { ending: split.ending.map(keyed), expired: split.expired.map(keyed) };
}

/** For the retention page: admins and trainers, each trainer inside their branches. */
export async function loadEndingRetentionForCaller(): Promise<EndingRetentionResult> {
  const { error } = await verifyAdminOrTrainer();
  if (error) return { success: false, error };
  const scope = await callerRetentionScope();
  if (scope !== null && "error" in scope) return { success: false, error: scope.error };
  try {
    return { success: true, data: await loadEndingRetention(scope) };
  } catch (err) {
    console.error("[RetentionEndingSoon] load failed:", err);
    return { success: false, error: LOAD_FAILED };
  }
}

/** The admin menu badge: how many queues the tab lists as ending, across קריית אתא. No auth check: the caller gates. */
export async function countEndingRetention(): Promise<number> {
  const { kiryatId } = await retentionBranchIds();
  if (!kiryatId) return 0;
  return endingSoonCount(await loadEndingInputs(kiryatId), israelToday());
}
