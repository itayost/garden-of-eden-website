/**
 * How much a staff member changed the model's text: the Levenshtein distance
 * over characters divided by the longer length. Above SIGNIFICANT_EDIT the edit
 * counts as significant for the automatic mode bar. Pure.
 */

import type { WriterOutput } from "./writer/output";

export const SIGNIFICANT_EDIT = 0.15;

/**
 * Edit distance over code points. The two rows are scratch buffers local to
 * this call (written in place for speed on texts of a thousand characters and
 * more); nothing outside it is changed.
 */
function levenshtein(a: readonly string[], b: readonly string[]): number {
  let previous = Uint32Array.from({ length: b.length + 1 }, (_, j) => j);
  let current = new Uint32Array(b.length + 1);
  for (let i = 0; i < a.length; i++) {
    current[0] = i + 1;
    for (let j = 0; j < b.length; j++) {
      const substitution = previous[j] + (a[i] === b[j] ? 0 : 1);
      current[j + 1] = Math.min(previous[j + 1] + 1, current[j] + 1, substitution);
    }
    [previous, current] = [current, previous];
  }
  return previous[b.length];
}

/** 0 for the same text (and for two empty ones), 1 for a text changed throughout. */
export function editRatio(original: string, edited: string): number {
  const a = Array.from(original);
  const b = Array.from(edited);
  const longer = Math.max(a.length, b.length);
  if (longer === 0) return 0;
  return Math.round((levenshtein(a, b) / longer) * 1000) / 1000;
}

/** Both texts measured as one. */
export function combinedEditRatio(original: WriterOutput, player: string, parent: string): number {
  return editRatio(`${original.player_text}\n${original.parent_text}`, `${player}\n${parent}`);
}
