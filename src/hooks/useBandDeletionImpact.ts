"use client";

import { useState } from "react";

import { bandDeletionImpactAction } from "@/lib/actions/weekly-schedule";

/**
 * null while the check is in flight, "unknown" when the check itself failed.
 * A failure is not zero: telling the admin nothing else will be deleted, and
 * then deleting future hours anyway, is the one answer worse than "we could
 * not find out".
 */
export type BandDeletionImpact = number | "unknown" | null;

/**
 * How many already-scheduled future hours a band's deletion would take with it.
 *
 * Loaded when a confirmation opens rather than with the list it sits in: one
 * query per confirmation, not one per card on a week that may show dozens.
 */
export function useBandDeletionImpact() {
  const [impact, setImpact] = useState<BandDeletionImpact>(null);

  const loadImpact = async (bandId: string) => {
    setImpact(null);
    const result = await bandDeletionImpactAction(bandId);
    setImpact("success" in result ? result.data.futureSlots : "unknown");
  };

  return { impact, loadImpact };
}

/** The sentence both band-deletion confirmations show about what else goes. */
export function bandImpactSentence(impact: BandDeletionImpact): string {
  if (impact === null) return " בודק כמה אימונים עתידיים כבר נקבעו...";
  if (impact === "unknown")
    return " לא הצלחנו לבדוק כמה אימונים עתידיים כבר נקבעו, וגם הם יימחקו.";
  if (impact > 0) return ` יימחקו גם ${impact} אימונים עתידיים שכבר נקבעו.`;
  return " אין אימונים עתידיים שכבר נקבעו.";
}
