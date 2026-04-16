import { POSITION_FILTER_NONE } from "./position-filter";

/**
 * Narrows a Supabase filter builder to rows whose `column` matches the position filter.
 *
 * - `undefined` / empty → no filter applied.
 * - `POSITION_FILTER_NONE` → matches rows where `column IS NULL`.
 * - any other value → matches rows where `column = value`.
 *
 * The `column` argument supports dot-notation (e.g. `"profile.position"`) so the
 * same helper works on both top-level tables and inner-joined relations.
 */
export function applyPositionFilter<T>(
  query: T,
  column: string,
  position: string | undefined,
): T {
  if (!position) return query;
  const q = query as { is: (c: string, v: null) => T; eq: (c: string, v: string) => T };
  if (position === POSITION_FILTER_NONE) return q.is(column, null);
  return q.eq(column, position);
}
