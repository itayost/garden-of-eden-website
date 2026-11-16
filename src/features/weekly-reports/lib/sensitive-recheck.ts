/**
 * A caution Quick tag or a sensitive Shift report entry can arrive after the
 * Fact sheet was built at Friday 01:00 (tags stay open until the end of the
 * next day; Thursday's Shift reports are often filed after midnight). These
 * rules find the ones a person has not seen yet, so approving and sending can
 * hold the report first. Pure: the same functions the Fact sheet build uses,
 * so the texts match what the build stored.
 */

import type { ShiftReportForNotes } from "@/lib/utils/trainee-notes";
import { shiftReportFacts } from "./fact-sheet/shift-notes";
import { tagFacts } from "./fact-sheet/training";
import type { HoldReason, WeekTag } from "./fact-sheet/types";

/** The sensitive Holds the week's data gives one Trainee now. */
export function sensitiveHoldsNow(
  reports: readonly ShiftReportForNotes[],
  tags: readonly WeekTag[],
  traineeId: string,
): HoldReason[] {
  return [...shiftReportFacts(reports, traineeId).holds, ...tagFacts(tags, []).holds].filter(
    (hold) => hold.code === "sensitive",
  );
}

/** Those not already on the report as sensitive Holds, each once. */
export function newSensitiveHolds(stored: readonly HoldReason[], now: readonly HoldReason[]): HoldReason[] {
  const seen = new Set(stored.filter((hold) => hold.code === "sensitive").map((hold) => hold.text));
  return now.filter((hold) => {
    if (seen.has(hold.text)) return false;
    seen.add(hold.text);
    return true;
  });
}
