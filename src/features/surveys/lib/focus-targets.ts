/**
 * Where keyboard focus goes after the builder moves or deletes a row. Pure: it
 * names the controls (by the id each one carries in `data-focus-id`) and the
 * component puts focus on the first that can take it.
 *
 * Ids are built from a row's place in its list, never from its key: keys are
 * random per render pass, so a key in the HTML would differ between the server
 * and the browser and React would report a hydration mismatch. A place is the
 * same on both, and after a move or a delete it is known without the key.
 */

/** The lists that have rows with tools. A Question's options sit inside the Question's own row. */
export type FocusRow = "question" | "option";

/** The controls of a row that focus can come back to. */
export type FocusPart = "up" | "down" | "remove" | "summary";

/** The "add" controls, which a list falls back to when no row is left after a deleted one. */
export const ADD_QUESTION_FOCUS = "add-question";
export const ADD_OPTION_FOCUS = "add-option";

/** `index` is the row's 0-based place. The kind keeps a Question's ids apart from its options'. */
export const focusId = (row: FocusRow, index: number, part: FocusPart): string =>
  `${row}-${index}:${part}`;

/**
 * After a row moved one place (`direction`) to `newIndex` of `count` rows: the
 * arrow that was pressed, or, when the row has reached that end and the arrow
 * is now disabled, the other one.
 */
export function focusAfterMove(
  row: FocusRow,
  newIndex: number,
  direction: -1 | 1,
  count: number,
): string[] {
  const reachedEnd = direction === -1 ? newIndex === 0 : newIndex === count - 1;
  const pressed: FocusPart = direction === -1 ? "up" : "down";
  const other: FocusPart = direction === -1 ? "down" : "up";
  return [focusId(row, newIndex, reachedEnd ? other : pressed)];
}

/**
 * After the row at `index` of `count` rows is deleted: the row that takes its
 * place (it has the same index now), trying its `nextParts` in order since a
 * folded row on a phone cannot take focus on some of them, and the add control
 * after those. The last row has no successor, so it goes to the add control.
 */
export function focusAfterRemove(
  row: FocusRow,
  index: number,
  count: number,
  nextParts: readonly FocusPart[],
  addControl: string,
): string[] {
  if (index + 1 >= count) return [addControl];
  return [...nextParts.map((part) => focusId(row, index, part)), addControl];
}
