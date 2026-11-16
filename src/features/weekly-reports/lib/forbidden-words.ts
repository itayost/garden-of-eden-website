/**
 * Words a Weekly report may not use: diagnosis, injury, diet and weight-loss
 * words. A starter list for staff to extend. Pure.
 *
 * A phrase matches at a word start, after up to three Hebrew prefix letters
 * (ו, ה, ב, ל, מ, ש, כ), with any ending after it, so "ופציעה" and "כאבים"
 * match while "ירופא" does not hold "רופא". A phrase ending in ה also matches
 * its ות and ת forms ("לפציעות", "פציעתו"), but not other words that share the
 * stem ("הדיאטנית" is not "דיאטה"). Niqqud is ignored, final letters match
 * their regular forms ("שומנים" holds "שומן"), and a double yod may be written
 * single ("עליה במשקל").
 *
 * "משקל" alone is not on the list: "משקלות" is a training word.
 */

export const FORBIDDEN_PHRASES: readonly string[] = [
  "פציעה",
  "פצוע",
  "נפצע",
  "כאב",
  "כואב",
  "אבחנה",
  "אבחון",
  "רופא",
  "תרופה",
  "פיזיותרפיה",
  "דיאטה",
  "הרזיה",
  "לרזות",
  "ירידה במשקל",
  "עלייה במשקל",
  "משקל גוף",
  "שומן",
  "קלוריות",
  "השמנה",
  "דיכאון",
  "חרדה",
  "הפרעה",
];

const PREFIX = "[והבלמשכ]{0,3}";

const FINAL_LETTERS: Readonly<Record<string, string>> = { ך: "כ", ם: "מ", ן: "נ", ף: "פ", ץ: "צ" };

/** Niqqud and other marks removed, final letters written as regular ones. */
function normalizeHebrew(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[ךםןףץ]/g, (letter) => FINAL_LETTERS[letter] ?? letter);
}

function wordPattern(word: string): string {
  return word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/יי/g, "יי?");
}

function phrasePattern(phrase: string): RegExp {
  const words = normalizeHebrew(phrase).trim().split(/\s+/).map(wordPattern);
  const last = words[words.length - 1] ?? "";
  const ending = last.endsWith("ה") ? `${last.slice(0, -1)}(?:ה|ות|ת)` : last;
  const body = [...words.slice(0, -1), ending].join("\\s+");
  return new RegExp(`(?<!\\p{L})${PREFIX}${body}`, "u");
}

const PATTERNS = FORBIDDEN_PHRASES.map((phrase) => ({ phrase, pattern: phrasePattern(phrase) }));

/** The forbidden phrases found in the text, each once, in list order. */
export function forbiddenIn(text: string): string[] {
  const normalized = normalizeHebrew(text);
  return PATTERNS.filter(({ pattern }) => pattern.test(normalized)).map(({ phrase }) => phrase);
}
