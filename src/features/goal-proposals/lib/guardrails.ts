/**
 * The guardrails on the model's Goal picks. Pure.
 *
 * A failure never blocks a proposal; it removes the model's words. A pick of
 * a metric that was not offered, a repeated metric or a fourth pick is
 * dropped; drill ids that were not offered are removed; a reason that breaks
 * a rule is stored as null with its problems, which staff see. The numbers a
 * proposal stores are the candidate's, never the model's: the model only
 * chooses metric keys, words and drill ids.
 */
import {
  allowedNumbersIn,
  foreignDigitsIn,
  numbersIn,
} from "@/features/weekly-reports/lib/fact-sheet/allowed-numbers";
import type { HoldReason } from "@/features/weekly-reports/lib/fact-sheet/types";
import { forbiddenIn } from "@/features/weekly-reports/lib/forbidden-words";
import type { CandidateFacts } from "./candidates";
import type { ProposalOutput, ProposalPick } from "./writer/output";

export const MAX_PICKS = 3;
export const MAX_PICK_DRILLS = 3;
export const REASON_MAX_WORDS = 25;

/** One kept pick: the code's candidate, its rank, and what is left of the model's words. */
export interface CheckedPick {
  candidate: CandidateFacts;
  /** 1 to MAX_PICKS, in the model's order. */
  rank: number;
  /** The trimmed reason, or null when it broke a rule (see `problems`). */
  reason: string | null;
  /** Offered drill ids, once each, at most MAX_PICK_DRILLS. */
  drillIds: string[];
  problems: HoldReason[];
}

const LINE_BREAK = /[\r\n\u2028\u2029]/;

function wordCount(text: string): number {
  return text.split(/\s+/).filter((word) => word !== "").length;
}

/** The offered drill ids the model chose, once each, at most MAX_PICK_DRILLS, and why any were removed. */
function checkDrills(candidate: CandidateFacts, chosen: readonly string[]): { drillIds: string[]; problems: HoldReason[] } {
  const offered = new Set(candidate.drills.map((drill) => drill.id));
  const valid = [...new Set(chosen.filter((id) => offered.has(id)))];
  const unoffered = chosen.some((id) => !offered.has(id));
  return {
    drillIds: valid.slice(0, MAX_PICK_DRILLS),
    problems: [
      ...(unoffered ? [{ code: "drill" as const, text: "נבחר תרגיל שלא הוצע" }] : []),
      ...(valid.length > MAX_PICK_DRILLS
        ? [{ code: "drill" as const, text: `נבחרו ${valid.length} תרגילים, מותר עד ${MAX_PICK_DRILLS}` }]
        : []),
    ],
  };
}

/** The numbers a reason may use: the candidate's own, not its drills' (a drill's name and "למה" line are the book's text). */
function numberProblems(candidate: CandidateFacts, reason: string): HoldReason[] {
  const allowed = allowedNumbersIn({ ...candidate, drills: [] });
  const invented = [...new Set(numbersIn(reason))]
    .filter((n) => !allowed.has(n))
    .map((n): HoldReason => ({ code: "number", text: `מספר שלא מופיע בנתונים: ${n}` }));
  const foreign = foreignDigitsIn(reason) ? [{ code: "number" as const, text: "ספרות שאינן 0 עד 9 בנימוק" }] : [];
  return [...invented, ...foreign];
}

/** The reason, trimmed, or null with its problems. */
function checkReason(candidate: CandidateFacts, raw: string): { reason: string | null; problems: HoldReason[] } {
  const reason = raw.trim();
  if (reason === "") return { reason: null, problems: [{ code: "length", text: "אין נימוק" }] };
  const problems: HoldReason[] = [
    ...(LINE_BREAK.test(reason) || wordCount(reason) > REASON_MAX_WORDS
      ? [{ code: "length" as const, text: "הנימוק ארוך משורה אחת" }]
      : []),
    ...numberProblems(candidate, reason),
    ...forbiddenIn(reason).map((phrase): HoldReason => ({ code: "forbidden_word", text: `מילה אסורה: ${phrase}` })),
  ];
  return { reason: problems.length === 0 ? reason : null, problems };
}

function checkedPick(candidate: CandidateFacts, rank: number, pick: ProposalPick): CheckedPick {
  const drills = checkDrills(candidate, pick.drill_ids);
  const reason = checkReason(candidate, pick.reason);
  return {
    candidate,
    rank,
    reason: reason.reason,
    drillIds: drills.drillIds,
    problems: [...drills.problems, ...reason.problems],
  };
}

/** A pick kept with its candidate, or dropped with why (for the log: the metric key, never the reason). */
type Verdict = { keep: CandidateFacts } | { drop: string };

function verdictOf(pick: ProposalPick, offered: ReadonlyMap<string, CandidateFacts>, kept: readonly CheckedPick[]): Verdict {
  const candidate = offered.get(pick.metric_key);
  if (candidate === undefined) return { drop: `${pick.metric_key}: not offered` };
  if (kept.some((done) => done.candidate.metric_key === pick.metric_key)) return { drop: `${pick.metric_key}: picked twice` };
  if (kept.length >= MAX_PICKS) return { drop: `${pick.metric_key}: after pick ${MAX_PICKS}` };
  return { keep: candidate };
}

/**
 * The model's picks in its order, checked against the candidates the code
 * offered. Each kept pick carries its candidate (whose value and target are
 * stored), a rank from 1, the offered drill ids and the reason or its
 * problems. `dropped` says why each other pick was dropped, for the log.
 */
export function checkPicks(
  candidates: readonly CandidateFacts[],
  output: ProposalOutput,
): { picks: CheckedPick[]; dropped: string[] } {
  const offered = new Map<string, CandidateFacts>(candidates.map((candidate) => [candidate.metric_key, candidate]));
  return output.picks.reduce<{ picks: CheckedPick[]; dropped: string[] }>(
    (result, pick) => {
      const verdict = verdictOf(pick, offered, result.picks);
      if ("drop" in verdict) return { picks: result.picks, dropped: [...result.dropped, verdict.drop] };
      const rank = result.picks.length + 1;
      return { picks: [...result.picks, checkedPick(verdict.keep, rank, pick)], dropped: result.dropped };
    },
    { picks: [], dropped: [] },
  );
}
