import { getIsraelTime } from "@/lib/utils/israel-time";
import { isRecord, normalizeCode, pickStored, statusOf } from "./pelecard-mapping";

/**
 * Pure half of reconciling an order stuck in charging: the charge call's
 * answer never arrived, so Pelecard's GetCompleteTransData is asked what it
 * recorded on the terminal around that time, and the row carrying this
 * order's paramX and amount decides. Pelecard dates are Israel local time.
 */

const WINDOW_BEFORE_MS = 60 * 60 * 1000;
const WINDOW_AFTER_MS = 5 * 60 * 1000;
/** Status 510: "no data" for the requested range. */
const NO_DATA = "510";

export function pelecardDateTime(date: Date): string {
  const { dateStr, hour, minute } = getIsraelTime(date);
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year} ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** From an hour before the order was claimed until a few minutes past now. */
export function lookupWindow(chargingSince: Date, now: Date): { startDate: string; endDate: string } {
  return {
    startDate: pelecardDateTime(new Date(chargingSince.getTime() - WINDOW_BEFORE_MS)),
    endDate: pelecardDateTime(new Date(now.getTime() + WINDOW_AFTER_MS)),
  };
}

export type LookupOutcome =
  | {
      kind: "found";
      transactionId: string;
      approvalNumber: string | null;
      last4: string | null;
      installments: number;
      raw: Record<string, unknown>;
    }
  | { kind: "not_found" }
  /** Pelecard could not answer, or the answer cannot be trusted to pick one charge. */
  | { kind: "error"; reason: string };

type RowVerdict = "match" | "declined" | "ambiguous";

/**
 * One row that carries this order's paramX. Only a clean approval of the
 * exact amount matches, and only a readable non-000 result is a decline.
 * Anything else (another amount, an unreadable result or total) is
 * ambiguous: money may have moved, so a person decides.
 */
function judgeRow(row: Record<string, unknown>, totalAgorot: number): RowVerdict {
  const result = normalizeCode(row.ShvaResult);
  if (result === null) return "ambiguous";
  if (result !== "000") return "declined";
  const total = Number(row.DebitTotal);
  const hasId = String(row.PelecardTransactionId ?? "").trim() !== "";
  return Number.isInteger(total) && total === totalAgorot && hasId ? "match" : "ambiguous";
}

export function parseCompleteTransData(body: unknown, paramX: string, totalAgorot: number): LookupOutcome {
  if (!isRecord(body)) return { kind: "error", reason: "response is not a JSON object" };
  const status = statusOf(body);
  if (status === NO_DATA) return { kind: "not_found" };
  if (status !== "000") return { kind: "error", reason: `status ${status ?? "missing"}` };

  const rows = body.ResultData ?? [];
  if (!Array.isArray(rows)) return { kind: "error", reason: "ResultData is not a list" };

  const ours = rows.filter(
    (row): row is Record<string, unknown> =>
      isRecord(row) && String(row.AdditionalDetailsParamX ?? "").trim() === paramX,
  );
  const verdicts = ours.map((row) => ({ row, verdict: judgeRow(row, totalAgorot) }));
  if (verdicts.some((v) => v.verdict === "ambiguous")) {
    return { kind: "error", reason: "a row for this order is not a clean approval of the order amount; check it in Pelecard" };
  }
  const matches = verdicts.filter((v) => v.verdict === "match").map((v) => v.row);
  if (matches.length === 0) return { kind: "not_found" };
  if (matches.length > 1) {
    return { kind: "error", reason: `${matches.length} approved charges carry this order; refund all but one by hand` };
  }

  const [match] = matches;
  const approval = String(match.DebitApproveNumber ?? "").trim();
  const digits = String(match.CreditCardNumber ?? "").replace(/\D/g, "");
  const payments = Number(match.TotalPayments);
  return {
    kind: "found",
    transactionId: String(match.PelecardTransactionId).trim(),
    approvalNumber: approval && !/^0+$/.test(approval) ? approval : null,
    last4: digits.length >= 4 ? digits.slice(-4) : null,
    installments: Number.isInteger(payments) && payments > 1 ? payments : 1,
    raw: pickStored(match),
  };
}

/**
 * TrxLookUp lists the terminal's J4 charges by paramX, including ones not yet
 * transmitted to Shva: the second opinion before an order is released.
 */
export function parseTrxLookUp(body: unknown, paramX: string): "none" | "charged" | "error" {
  if (!isRecord(body)) return "error";
  const status = statusOf(body);
  if (status === NO_DATA) return "none";
  if (status !== "000") return "error";
  const rows = body.ResultData ?? [];
  if (!Array.isArray(rows)) return "error";
  return rows.some((row) => isRecord(row) && String(row.ParamX ?? "").trim() === paramX) ? "charged" : "none";
}
