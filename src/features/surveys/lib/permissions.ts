/**
 * Survey permission rules. Pure: the server actions load the role and the
 * managed branches, then ask these functions. The UI only hides what these
 * would refuse.
 *
 * A Branch manager is a Trainer who manages at least one branch (ADR-0009).
 * Writing needs a manager of every branch in the audience, which is stricter
 * than canManageBranches(), so this module carries its own rules.
 */

const isAdmin = (role: string): boolean => role === "admin";

const isManager = (role: string, managedBranchIds: readonly string[]): boolean =>
  role === "trainer" && managedBranchIds.length > 0;

/** Admins and Branch managers may open the surveys pages. */
export function canUseSurveys(role: string, managedBranchIds: readonly string[]): boolean {
  return isAdmin(role) || isManager(role, managedBranchIds);
}

/** An Admin, or a manager of every branch in the audience (never an empty audience). */
export function canEditSurvey(
  role: string,
  managedBranchIds: readonly string[],
  surveyBranchIds: readonly string[],
): boolean {
  if (isAdmin(role)) return true;
  if (role !== "trainer" || surveyBranchIds.length === 0) return false;
  return surveyBranchIds.every((id) => managedBranchIds.includes(id));
}

/** An Admin, or a manager of at least one branch in the audience. */
export function canViewSurvey(
  role: string,
  managedBranchIds: readonly string[],
  surveyBranchIds: readonly string[],
): boolean {
  if (isAdmin(role)) return true;
  if (role !== "trainer") return false;
  return surveyBranchIds.some((id) => managedBranchIds.includes(id));
}

/** An Admin always; a manager who may edit the survey, only before any Response. */
export function canDeleteSurvey(
  role: string,
  managedBranchIds: readonly string[],
  surveyBranchIds: readonly string[],
  responseCount: number,
): boolean {
  if (isAdmin(role)) return true;
  return canEditSurvey(role, managedBranchIds, surveyBranchIds) && responseCount === 0;
}

/** Null means no narrowing: an Admin sees every branch of the audience. */
export function visibleSurveyBranches(
  role: string,
  managedBranchIds: readonly string[],
  surveyBranchIds: readonly string[],
): string[] | null {
  if (isAdmin(role)) return null;
  return surveyBranchIds.filter((id) => managedBranchIds.includes(id));
}

/**
 * The branches the viewer may put in a Survey's audience: all of them for an
 * Admin, only the managed ones for a Branch manager, none for anyone else.
 * The save action refuses any other branch too; this keeps the picker honest.
 */
export function choosableBranches<T extends { id: string }>(
  role: string,
  managedBranchIds: readonly string[],
  branches: readonly T[],
): T[] {
  if (isAdmin(role)) return [...branches];
  if (role !== "trainer") return [];
  return branches.filter((branch) => managedBranchIds.includes(branch.id));
}
