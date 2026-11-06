import "server-only";

import type { createAdminClient } from "@/lib/supabase/admin";
import {
  CALL_REMINDER_WINDOW_MS,
  targetKey,
  type AttemptRow,
  type CallTarget,
  type DocumentationRow,
} from "./rules";

type AdminDb = ReturnType<typeof createAdminClient>;

/** Enough for any real day of calling; the window is 7 days. */
const MAX_OPEN_ATTEMPTS = 200;

interface AttemptRecord {
  readonly id: string;
  readonly lead_id: string | null;
  readonly report_month: string | null;
  readonly trainee_phone: string | null;
  readonly contact_name: string;
  readonly started_at: string;
  readonly dismissed_at: string | null;
}

function toAttemptRow(record: AttemptRecord): AttemptRow | null {
  const target: CallTarget | null = record.lead_id
    ? { kind: "lead", leadId: record.lead_id }
    : record.report_month && record.trainee_phone
      ? { kind: "retention", reportMonth: record.report_month, phone: record.trainee_phone }
      : null;
  if (!target) return null;
  return {
    id: record.id,
    target,
    contactName: record.contact_name,
    startedAt: record.started_at,
    dismissedAt: record.dismissed_at,
  };
}

export interface CallerAttempts {
  readonly attempts: readonly AttemptRow[];
  readonly docs: readonly DocumentationRow[];
}

/**
 * The caller's open attempts inside the reminder window (optionally for one
 * person) and the caller's own log entries that could document them.
 */
export async function loadCallerAttempts(
  db: AdminDb,
  callerId: string,
  nowMs: number,
  target?: CallTarget,
): Promise<CallerAttempts | { error: string }> {
  const windowStart = new Date(nowMs - CALL_REMINDER_WINDOW_MS).toISOString();

  let query = db
    .from("call_attempts")
    .select("id, lead_id, report_month, trainee_phone, contact_name, started_at, dismissed_at")
    .eq("caller_id", callerId)
    .is("dismissed_at", null)
    .gte("started_at", windowStart)
    // Newest first: documented attempts stay in this set for the whole
    // window, so a busy caller's cap must drop the oldest, not today's.
    .order("started_at", { ascending: false })
    .limit(MAX_OPEN_ATTEMPTS);
  if (target?.kind === "lead") query = query.eq("lead_id", target.leadId);
  if (target?.kind === "retention") query = query.eq("trainee_phone", target.phone);

  const { data, error } = await query;
  if (error) {
    console.error("[calls] load attempts failed:", error.message);
    return { error: error.message };
  }

  const attempts = (data ?? [])
    .map(toAttemptRow)
    .filter((a): a is AttemptRow => a !== null);
  if (attempts.length === 0) return { attempts, docs: [] };

  const docs = await loadCallerDocumentation(db, callerId, attempts);
  if ("error" in docs) return docs;
  return { attempts, docs: docs.rows };
}

async function loadCallerDocumentation(
  db: AdminDb,
  callerId: string,
  attempts: readonly AttemptRow[],
): Promise<{ rows: readonly DocumentationRow[] } | { error: string }> {
  const since = new Date(
    Math.min(...attempts.map((a) => Date.parse(a.startedAt))),
  ).toISOString();
  const leadIds = [
    ...new Set(attempts.flatMap((a) => (a.target.kind === "lead" ? [a.target.leadId] : []))),
  ];
  const phones = [
    ...new Set(attempts.flatMap((a) => (a.target.kind === "retention" ? [a.target.phone] : []))),
  ];

  const [leadLogs, retentionLogs] = await Promise.all([
    leadIds.length === 0
      ? Promise.resolve({ data: [], error: null })
      : db
          .from("lead_contact_log")
          .select("lead_id, created_at")
          .eq("author_id", callerId)
          // Sending a WhatsApp logs a message_sent entry by itself
          // (logWhatsAppMessage); that is not documenting a call.
          .neq("contact_type", "message_sent")
          .in("lead_id", leadIds)
          .gte("created_at", since),
    phones.length === 0
      ? Promise.resolve({ data: [], error: null })
      : db
          .from("retention_call_log")
          .select("trainee_phone, created_at")
          .eq("author_id", callerId)
          .in("trainee_phone", phones)
          .gte("created_at", since),
  ]);

  const failure = leadLogs.error ?? retentionLogs.error;
  if (failure) {
    console.error("[calls] load documentation failed:", failure.message);
    return { error: failure.message };
  }

  const rows: readonly DocumentationRow[] = [
    ...(leadLogs.data ?? []).map((r) => ({
      targetKey: targetKey({ kind: "lead", leadId: r.lead_id }),
      createdAt: r.created_at,
    })),
    ...(retentionLogs.data ?? []).map((r) => ({
      targetKey: targetKey({ kind: "retention", reportMonth: "", phone: r.trainee_phone }),
      createdAt: r.created_at,
    })),
  ];
  return { rows };
}
