/**
 * Utilities for parsing free-text muscle strings into structured tokens.
 * Used during seeding/migration of book_drill_muscles from book_drills.muscle_he.
 */

export interface MuscleToken {
  nameHe: string;
  emoji: string | null;
}

/**
 * Regex that matches a leading run of emoji characters (Extended_Pictographic)
 * including optional variation selectors (U+FE0F) and ZWJ sequences (U+200D),
 * followed by optional trailing whitespace.
 *
 * The `u` flag is required for \p{} Unicode property escapes.
 */
const LEADING_EMOJI_RE =
  /^(?:\p{Extended_Pictographic}(?:️)?(?:‍\p{Extended_Pictographic}(?:️)?)*\s*)+/u;

/**
 * Splits a free-text muscle string (e.g. from book_drills.muscle_he) into
 * structured tokens for seeding book_muscles / book_drill_muscles.
 *
 * Rules:
 * - Returns [] for null / empty / whitespace-only input.
 * - Splits on "+".
 * - For each token, extracts a leading emoji run into `emoji` (or null if none).
 * - The remaining text (trimmed) becomes `nameHe`.
 * - Drops tokens that are empty after trimming.
 * - If a token is emoji-only (no remaining name text), sets nameHe to the raw
 *   token and emoji to null — the data is not lost.
 */
export function parseMuscleTokens(muscleHe: string | null): MuscleToken[] {
  if (muscleHe === null || muscleHe.trim() === "") {
    return [];
  }

  return muscleHe
    .split("+")
    .map((raw): MuscleToken | null => {
      const trimmed = raw.trim();
      if (trimmed === "") {
        return null;
      }

      const emojiMatch = trimmed.match(LEADING_EMOJI_RE);
      if (emojiMatch === null) {
        return { nameHe: trimmed, emoji: null };
      }

      const emojiPart = emojiMatch[0].trimEnd();
      const remainder = trimmed.slice(emojiMatch[0].length).trim();

      if (remainder === "") {
        // Token is emoji-only — preserve as nameHe, no emoji field
        return { nameHe: emojiPart, emoji: null };
      }

      return { nameHe: remainder, emoji: emojiPart };
    })
    .filter((token): token is MuscleToken => token !== null);
}
