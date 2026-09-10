/**
 * Sentinel for "rank the whole academy". Lives outside the server action
 * module because a "use server" file may only export async functions, and
 * the client-side filter needs this value too.
 */
export const ALL_BRANCHES = "all";
