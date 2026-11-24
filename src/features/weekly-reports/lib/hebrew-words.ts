/**
 * Loose Hebrew word matching for the report reader: a word with its one-letter
 * prefixes (ו, ה, ב, ל, מ, ש, כ) taken off, so "וביום" meets "יום" and
 * "ושהטכניקה" meets "טכניקה". Good enough to point a reader at the facts
 * behind a sentence; never used to decide anything. Pure.
 */

const PREFIX_LETTERS = new Set(["ו", "ה", "ב", "ל", "מ", "ש", "כ"]);
const MAX_PREFIX = 3;
const MIN_STEM = 3;

/** Small words that carry no fact: left out of a loose match. */
const STOPWORDS = new Set([
  "של", "על", "עם", "את", "זה", "זו", "גם", "כל", "לא", "יש", "הוא", "היא", "אתה", "שלו", "שלה", "שלך",
  "שבוע", "השבוע", "בשבוע", "מאוד", "עוד", "רק", "אבל", "כי", "אם", "היום", "אחרי", "לפני", "כמו",
]);

/** The words of a text, letters, digits and the geresh kept, in order. */
export function wordsOf(text: string): string[] {
  return text.match(/[\p{L}\p{N}'׳]+/gu) ?? [];
}

/** A word and the words left after taking off up to three prefix letters, each at least three letters long. */
export function stemsOf(word: string): string[] {
  const stems = [word];
  for (let k = 1; k <= MAX_PREFIX && word.length - k >= MIN_STEM; k += 1) {
    if (!PREFIX_LETTERS.has(word[k - 1])) break;
    stems.push(word.slice(k));
  }
  return stems;
}

/** True when the two words share a stem. */
export function sameWord(a: string, b: string): boolean {
  const stems = stemsOf(b);
  return stemsOf(a).some((stem) => stems.includes(stem));
}

/** A word that can carry a fact: three letters or more, not a stop word, not a number. */
export function isSignificant(word: string): boolean {
  return word.length >= MIN_STEM && !STOPWORDS.has(word) && !/^\d/.test(word);
}

/** True when the words hold the phrase as consecutive words, each loosely matched. */
export function hasPhrase(words: readonly string[], phrase: string): boolean {
  const parts = wordsOf(phrase);
  if (parts.length === 0) return false;
  return words.some((_, start) => parts.every((part, offset) => {
    const word = words[start + offset];
    return word !== undefined && sameWord(word, part);
  }));
}

/**
 * True when enough of the term's significant words are among the words: half
 * of them, at least one. "סיומות לשער" needs one of its two, "בעיטה ברגל
 * שמאל" two of its three.
 */
export function overlaps(words: readonly string[], term: string): boolean {
  const significant = wordsOf(term).filter(isSignificant);
  if (significant.length === 0) return false;
  const found = significant.filter((part) => words.some((word) => sameWord(word, part))).length;
  return found >= Math.max(1, Math.ceil(significant.length / 2));
}
