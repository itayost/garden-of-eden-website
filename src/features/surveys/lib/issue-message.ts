/**
 * The text a failed schema parse is answered with. The schemas word their own
 * rules in Hebrew, but a shape failure (a missing field, a wrong type) carries
 * Zod's English default, which must never reach the screen.
 */

const HEBREW_LETTER = /[א-ת]/;

/**
 * The first issue's message when it is written in Hebrew, otherwise `fallback`.
 * Only the first issue is judged: it is the one the person is told about.
 */
export function hebrewIssueMessage(
  issues: readonly { readonly message: string }[],
  fallback: string,
): string {
  const [first] = issues;
  return first !== undefined && HEBREW_LETTER.test(first.message) ? first.message : fallback;
}
