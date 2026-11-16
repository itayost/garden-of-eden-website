import "server-only";

import { readAllPages, readInChunks } from "@/lib/supabase/in-chunks";
import type { WhatsAppResult } from "@/lib/whatsapp/api";
import { sendMissedYou, sendWeeklyReport, weeklyTemplateConfigured } from "@/lib/whatsapp/plan-templates";
import { revalidateWeeklyReports } from "../cache-tags";
import { parentDelivery, type ParentDelivery, type SkipReason } from "../delivery";
import { firstNameOf } from "../fill-name";
import { buildReportUrl } from "../report-link";
import type { HoldReason } from "../fact-sheet/types";
import type { Db } from "../queries/read";
import { holdLateSensitive } from "../queries/sensitive-recheck";
import { holdReasonsOf } from "../queries/stored";
import { lastCompletedWeekStart } from "../report-week";

/**
 * A send window (Friday 12:00, Sunday to Thursday 09:00): every approved
 * Weekly report and "התגעגענו" of the current Report week goes out. The
 * player sees it from the moment its row is sent; the parent gets the
 * WhatsApp template when parentDelivery() allows it.
 *
 * Each row is claimed with one conditional update before anything is sent,
 * so a window that runs twice, or two runs that overlap, send nothing twice.
 * A row is sent at most once: a WhatsApp failure after the claim is recorded
 * on the row, never retried.
 */

type SendKind = "report" | "missed_you";

/** "absent" rows are a staff list and never go out. */
const SEND_KINDS: readonly SendKind[] = ["report", "missed_you"];

/** Enough of a WhatsApp error for the queue's skip line. */
const ERROR_TEXT_MAX = 300;

const LOG = "[weekly-reports-send]";

interface ApprovedRow {
  id: string;
  traineeId: string;
  kind: SendKind;
  holdReasons: HoldReason[];
}

interface ParentProfile {
  full_name: string | null;
  birthdate: string | null;
  guardian_phone: string | null;
  guardian_not_needed: boolean;
}

type ParentMessage = { kind: "report"; reportUrl: string } | { kind: "missed_you" };

type Delivery = { send: false; reason: SkipReason } | { send: true; phone: string; message: ParentMessage };

type RowOutcome =
  | { type: "parent_sent" }
  | { type: "parent_skipped"; reason: SkipReason }
  | { type: "taken" }
  | { type: "failed" }
  | { type: "deferred" };

export interface SendResult {
  weekStart: string;
  /** Approved rows of the week when the run read them. */
  approved: number;
  /** Rows this run claimed: sent, and shown to the player. */
  sent: number;
  /** Parent messages WhatsApp accepted. */
  parentMessages: number;
  /** Sent rows whose parent got no message, by reason. */
  skipped: Record<SkipReason, number>;
  /** Rows another run sent first, or staff held after the read. */
  taken: number;
  /**
   * Rows that hit an error, logged. One that failed before its claim (the
   * report link, the claim itself) stays approved for the next window.
   */
  failed: number;
  /** Rows left approved because the run reached its deadline. */
  deferred: number;
}

function isSendKind(kind: string): kind is SendKind {
  return kind === "report" || kind === "missed_you";
}

async function loadApprovedRows(db: Db, weekStart: string): Promise<ApprovedRow[]> {
  const { data, error } = await readAllPages(() =>
    db
      .from("weekly_reports")
      .select("id, trainee_id, kind, hold_reasons")
      .eq("week_start", weekStart)
      .eq("status", "approved")
      .in("kind", SEND_KINDS)
      .order("id"),
  );
  if (error) throw new Error(`load approved reports failed: ${error.message}`);
  return data.flatMap((row) =>
    isSendKind(row.kind)
      ? [{ id: row.id, traineeId: row.trainee_id, kind: row.kind, holdReasons: holdReasonsOf(row.hold_reasons) }]
      : [],
  );
}

async function loadParentProfiles(db: Db, traineeIds: readonly string[]): Promise<Map<string, ParentProfile>> {
  if (traineeIds.length === 0) return new Map();
  const { data, error } = await readInChunks(traineeIds, "id", () =>
    db.from("profiles").select("id, full_name, birthdate, guardian_phone, guardian_not_needed"),
  );
  if (error) throw new Error(`load profiles failed: ${error.message}`);
  return new Map(data.map((profile) => [profile.id, profile]));
}

/**
 * Takes the row for this run: approved becomes sent in one conditional
 * update. Two runs racing for a row queue on its lock, and the second finds
 * it no longer approved and gets no row back; so does a run whose row staff
 * held after the read. Only the run that gets the row back may send.
 */
async function claimRow(db: Db, reportId: string): Promise<"claimed" | "taken" | "failed"> {
  const { data, error } = await db
    .from("weekly_reports")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", reportId)
    .eq("status", "approved")
    .select("id");
  if (error) {
    console.error(`${LOG} claim failed for report ${reportId}:`, error.message);
    return "failed";
  }
  return (data ?? []).length > 0 ? "claimed" : "taken";
}

/** Records what happened to the parent message on a row this run sent. */
async function stampParent(
  db: Db,
  reportId: string,
  stamp: { parent_message_id: string | null } | { parent_skip_reason: string },
): Promise<void> {
  const { error } = await db.from("weekly_reports").update(stamp).eq("id", reportId);
  if (error) console.error(`${LOG} stamp failed for report ${reportId}:`, error.message);
}

async function sendToParent(phone: string, childName: string, message: ParentMessage): Promise<WhatsAppResult> {
  try {
    return message.kind === "report"
      ? await sendWeeklyReport(phone, { childName, reportUrl: message.reportUrl })
      : await sendMissedYou(phone, { childName });
  } catch (error) {
    // getConfig() throws when WhatsApp itself is not configured.
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function parentPlan(row: ApprovedRow, profile: ParentProfile | undefined, today: string): ParentDelivery {
  return parentDelivery({
    guardianPhone: profile?.guardian_phone ?? null,
    guardianNotNeeded: profile?.guardian_not_needed ?? false,
    birthdate: profile?.birthdate ?? null,
    today,
    templateConfigured: weeklyTemplateConfigured(row.kind),
  });
}

function parentMessage(row: ApprovedRow): ParentMessage {
  return row.kind === "report" ? { kind: "report", reportUrl: buildReportUrl(row.id) } : { kind: "missed_you" };
}

/**
 * Everything the parent part needs, worked out before the claim: a report
 * link that cannot be signed (no PLAN_RENEWAL_TOKEN_SECRET) leaves the row
 * approved for the next window instead of sending it without its link.
 */
function prepareDelivery(row: ApprovedRow, profile: ParentProfile | undefined, today: string): Delivery | "failed" {
  const plan = parentPlan(row, profile, today);
  if (!plan.send) return plan;
  try {
    return { send: true, phone: plan.phone, message: parentMessage(row) };
  } catch (error) {
    console.error(`${LOG} report link failed for report ${row.id}:`, error);
    return "failed";
  }
}

async function sendRow(db: Db, row: ApprovedRow, profile: ParentProfile | undefined, today: string): Promise<RowOutcome> {
  const delivery = prepareDelivery(row, profile, today);
  if (delivery === "failed") return { type: "failed" };

  const claim = await claimRow(db, row.id);
  if (claim !== "claimed") return { type: claim };

  if (!delivery.send) {
    await stampParent(db, row.id, { parent_skip_reason: delivery.reason });
    return { type: "parent_skipped", reason: delivery.reason };
  }

  const result = await sendToParent(delivery.phone, firstNameOf(profile?.full_name ?? null), delivery.message);
  if (!result.success) {
    const detail = (result.error ?? "unknown error").slice(0, ERROR_TEXT_MAX);
    console.error(`${LOG} WhatsApp failed for report ${row.id}:`, detail);
    await stampParent(db, row.id, { parent_skip_reason: `whatsapp_failed: ${detail}` });
    return { type: "parent_skipped", reason: "whatsapp_failed" };
  }
  await stampParent(db, row.id, { parent_message_id: result.messageId ?? null });
  return { type: "parent_sent" };
}

/** One row's error is logged and counted, never thrown, so the rows after it still go. */
async function sendRowSafely(
  db: Db,
  row: ApprovedRow,
  profile: ParentProfile | undefined,
  today: string,
): Promise<RowOutcome> {
  try {
    return await sendRow(db, row, profile, today);
  } catch (error) {
    console.error(`${LOG} unexpected error for report ${row.id}:`, error);
    return { type: "failed" };
  }
}

function tally(weekStart: string, approved: number, outcomes: readonly RowOutcome[]): SendResult {
  const count = (type: RowOutcome["type"]) => outcomes.filter((o) => o.type === type).length;
  const skippedFor = (reason: SkipReason) =>
    outcomes.filter((o) => o.type === "parent_skipped" && o.reason === reason).length;
  const parentMessages = count("parent_sent");
  const skipped: Record<SkipReason, number> = {
    no_template: skippedFor("no_template"),
    no_phone: skippedFor("no_phone"),
    adult: skippedFor("adult"),
    whatsapp_failed: skippedFor("whatsapp_failed"),
  };
  return {
    weekStart,
    approved,
    sent: parentMessages + count("parent_skipped"),
    parentMessages,
    skipped,
    taken: count("taken"),
    failed: count("failed"),
    deferred: count("deferred"),
  };
}

/** The queue and its badge; the rows are already sent, so a failure here is only logged. */
function refreshQueue(): void {
  try {
    revalidateWeeklyReports();
  } catch (error) {
    console.error(`${LOG} revalidate failed:`, error);
  }
}

/**
 * Sends the current Report week's approved rows, one at a time. A row's
 * failure is logged and counted, never thrown; only a failed read of the
 * week throws, before anything is claimed. Past `deadline` (epoch ms) no new
 * row is claimed, so a slow WhatsApp never leaves a row half sent when the
 * function is stopped; the rest go in the next window.
 */
export async function sendWeek(db: Db, today: string, deadline = Number.POSITIVE_INFINITY): Promise<SendResult> {
  const weekStart = lastCompletedWeekStart(today);
  const approvedRows = await loadApprovedRows(db, weekStart);
  // The last check before a family reads it: a caution tag or sensitive Shift
  // report entry filed after the report was approved holds it for a person.
  const late = await holdLateSensitive(
    db,
    weekStart,
    approvedRows
      .filter((row) => row.kind === "report")
      .map((row) => ({ id: row.id, traineeId: row.traineeId, status: "approved", holdReasons: row.holdReasons })),
  );
  if (late.size > 0) console.warn(`${LOG} held ${late.size} report(s) with sensitive data added after approval`);
  const rows = approvedRows.filter((row) => !late.has(row.id));
  const profiles = await loadParentProfiles(db, [...new Set(rows.map((row) => row.traineeId))]);

  let outcomes: readonly RowOutcome[] = [];
  for (const row of rows) {
    const outcome: RowOutcome =
      Date.now() >= deadline ? { type: "deferred" } : await sendRowSafely(db, row, profiles.get(row.traineeId), today);
    outcomes = [...outcomes, outcome];
  }

  const result = tally(weekStart, rows.length, outcomes);
  if (result.sent > 0 || late.size > 0) refreshQueue();
  return result;
}
