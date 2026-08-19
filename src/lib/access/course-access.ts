/**
 * Who sees the whole app, and who sees only the digital course.
 *
 * The academy sells the course in Arbox as an `item`, alongside memberships
 * sold as `plan` and session packs sold as `session`. Someone who bought the
 * course but has never paid for training gets the course and nothing else;
 * anyone who ever trained here -- even on a membership that lapsed years ago --
 * keeps the full app.
 *
 * The two Arbox facts are stored on the profile rather than the verdict, so the
 * rule can change without re-syncing, and so a support question ("why is this
 * person restricted?") has an auditable answer.
 */

export type AccessTier = "full" | "course_only";

/** A manual decision by an admin. Null means "derive it from Arbox". */
export type AccessOverride = AccessTier | null;

export interface AccessFacts {
  /** Ever held a `plan` or `session` membership -- active, expired or cancelled. */
  arboxPaidTraining: boolean;
  /** Ever bought the digital course item. */
  arboxBoughtCourse: boolean;
  accessOverride: AccessOverride;
}

/** Where a course-only trainee lands, and where they are sent back to. */
export const COURSE_ONLY_HOME = "/dashboard/course";

/**
 * Trainee routes a course-only user may still reach. They need their own
 * profile and settings to manage their account and sign out; everything else
 * under /dashboard is members-only.
 */
const COURSE_ONLY_ALLOWED = [
  "/dashboard/course",
  "/dashboard/profile",
  "/dashboard/settings",
] as const;

export function resolveAccessTier(facts: AccessFacts): AccessTier {
  // An admin's decision always wins: the sync depends on a fuzzy Arbox profile
  // link, so there has to be a way to correct it without touching Arbox.
  if (facts.accessOverride) return facts.accessOverride;

  // Restrict only on positive evidence. A profile that is unlinked, unsynced or
  // simply has no purchases recorded keeps full access.
  return facts.arboxBoughtCourse && !facts.arboxPaidTraining
    ? "course_only"
    : "full";
}

/** True when `pathname` is `base` itself or a path nested under it. */
function isUnder(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

/**
 * Whether a tier may open a path.
 *
 * Only the trainee area is this function's business -- admin routes are gated
 * by role in the middleware, so anything outside /dashboard is passed through
 * rather than claimed.
 */
export function isPathAllowedForTier(
  tier: AccessTier,
  pathname: string
): boolean {
  if (tier === "full") return true;
  if (!isUnder(pathname, "/dashboard")) return true;

  // Normalise a trailing slash so "/dashboard/course/" is not read as a child
  // path that happens to be empty.
  const path =
    pathname.length > 1 && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname;

  return COURSE_ONLY_ALLOWED.some((allowed) => isUnder(path, allowed));
}
