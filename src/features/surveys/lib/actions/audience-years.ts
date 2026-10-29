"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { isValidUUID } from "@/lib/validations/common";
import { birthYearCounts, inSurveyAudience } from "../audience";
import { loadAudienceCandidates } from "../queries";
import { STAFF_MESSAGES } from "../staff-messages";
import { readOrFail, requireSurveyStaff, type ActionFailure } from "./staff-access";

export interface AudienceYears {
  /** Birth years of the eligible Trainees, newest first, with their head counts. */
  years: { year: number; count: number }[];
  /** Every eligible Trainee in these branches, those without a birthdate included. */
  totalAllYears: number;
}

export type AudienceYearsResult = { success: true; data: AudienceYears } | ActionFailure;

/**
 * The birth years the builder can offer for the chosen branches. Branches the
 * viewer may not choose (a manager's unmanaged ones) are left out, not refused.
 */
export async function audienceYearsAction(branchIds: string[]): Promise<AudienceYearsResult> {
  const staff = await requireSurveyStaff();
  if ("error" in staff) return staff;
  const { viewer } = staff;

  if (!Array.isArray(branchIds) || !branchIds.every(isValidUUID)) {
    return { error: STAFF_MESSAGES.invalidId };
  }
  const choosable = [...new Set(branchIds)].filter(
    (id) => viewer.role === "admin" || viewer.managedBranchIds.includes(id),
  );

  const read = await readOrFail("audience read", () =>
    loadAudienceCandidates(createAdminClient(), choosable),
  );
  if ("error" in read) return read;

  const candidates = read.value;
  const everyYear = { branchIds: choosable, birthYears: [] };
  return {
    success: true,
    data: {
      years: birthYearCounts(candidates, choosable),
      totalAllYears: candidates.filter((candidate) => inSurveyAudience(candidate, everyYear)).length,
    },
  };
}
