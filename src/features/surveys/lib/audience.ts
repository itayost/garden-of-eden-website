/**
 * Survey audience rules. Pure: a loader fills an AudienceCandidate per profile
 * from the database, and these functions decide who gets a survey and which
 * birth years the builder can offer. Nothing here touches the database.
 *
 * The age-group override and the plays-up flag are deliberately not consulted:
 * a survey goes to the trainees of its branches, by birth year only.
 */
import type { AccessTier } from "@/lib/access/course-access";

/** One profile as the audience loader sees it. */
export interface AudienceCandidate {
  profileId: string;
  fullName: string;
  role: string;
  isActive: boolean;
  deletedAt: string | null;
  birthdate: string | null;
  accessTier: AccessTier;
  branchIds: readonly string[];
}

const ISO_YEAR = /^(\d{4})-\d{2}-\d{2}/;

/** The year part of an ISO birthdate ("2014-03-02" gives 2014), or null when unknown. */
export function birthYearOf(birthdate: string | null): number | null {
  const match = birthdate ? ISO_YEAR.exec(birthdate) : null;
  return match ? Number(match[1]) : null;
}

/**
 * An active, not deleted, full-access trainee in at least one of the branches.
 * Staff and course-only profiles never receive a survey.
 */
function isEligibleTrainee(c: AudienceCandidate, branchIds: readonly string[]): boolean {
  return (
    c.role === "trainee" &&
    c.isActive &&
    c.deletedAt === null &&
    c.accessTier === "full" &&
    c.branchIds.some((id) => branchIds.includes(id))
  );
}

/**
 * Whether a candidate is in a survey's audience. No birth years named means
 * every age; a candidate with no birthdate is in only when no years are named.
 */
export function inSurveyAudience(
  c: AudienceCandidate,
  target: { branchIds: readonly string[]; birthYears: readonly number[] },
): boolean {
  if (!isEligibleTrainee(c, target.branchIds)) return false;
  if (target.birthYears.length === 0) return true;
  const year = birthYearOf(c.birthdate);
  return year !== null && target.birthYears.includes(year);
}

/**
 * How many eligible trainees were born in each year, newest year first. Ignores
 * the survey's own year filter so the builder offers every year with people in
 * it. Candidates without a birthdate are not counted.
 */
export function birthYearCounts(
  candidates: readonly AudienceCandidate[],
  branchIds: readonly string[],
): { year: number; count: number }[] {
  const years = candidates.flatMap((c) => {
    const year = birthYearOf(c.birthdate);
    return year !== null && isEligibleTrainee(c, branchIds) ? [year] : [];
  });
  const distinct = [...new Set(years)].sort((a, b) => b - a);
  return distinct.map((year) => ({
    year,
    count: years.filter((y) => y === year).length,
  }));
}
