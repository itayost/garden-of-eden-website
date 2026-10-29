/**
 * Where keyboard focus goes after the builder moves or deletes a row. Pure:
 * it names the controls (by the id each one carries in `data-focus-id`) and
 * the component puts focus on the first that can take it.
 */

/** The controls of a row that focus can come back to. */
export type FocusPart = "up" | "down" | "remove" | "summary";

/** The "add" controls, which a list falls back to when no row is left after a deleted one. */
export const ADD_QUESTION_FOCUS = "add-question";
export const ADD_OPTION_FOCUS = "add-option";

export const focusId = (key: string, part: FocusPart): string => `${key}:${part}`;

/**
 * After a row moved one place (`direction`) to `newIndex` of `count` rows: the
 * arrow that was pressed, or, when the row has reached that end and the arrow
 * is now disabled, the other one.
 */
export function focusAfterMove(
  key: string,
  direction: -1 | 1,
  newIndex: number,
  count: number,
): string[] {
  const reachedEnd = direction === -1 ? newIndex === 0 : newIndex === count - 1;
  const pressed: FocusPart = direction === -1 ? "up" : "down";
  const other: FocusPart = direction === -1 ? "down" : "up";
  return [focusId(key, reachedEnd ? other : pressed)];
}

/**
 * After the row at `index` of `keys` is deleted: the row that takes its place
 * (its `nextParts`, in order of preference, since a folded row on a phone
 * cannot take focus on some of them), and the add control after those.
 */
export function focusAfterRemove(
  keys: readonly string[],
  index: number,
  nextParts: readonly FocusPart[],
  addControl: string,
): string[] {
  const next = keys[index + 1];
  if (next === undefined) return [addControl];
  return [...nextParts.map((part) => focusId(next, part)), addControl];
}
