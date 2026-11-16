/**
 * The model never sees a name: it writes `{שם}` and code puts the first name
 * in before a person reads the text. Pure.
 */

/** What the model writes where the player's first name goes. */
export const NAME_PLACEHOLDER = "{שם}";

/** Said instead of a name when the profile has none. */
const NAMELESS = "השחקן";

/** Every `{שם}` in the text replaced by the first name; other braces stay. */
export function fillName(text: string, firstName: string): string {
  return text.replaceAll(NAME_PLACEHOLDER, firstName);
}

/** The first word of the full name, or "השחקן" when there is none. */
export function firstNameOf(fullName: string | null): string {
  const first = fullName?.trim().split(/\s+/)[0];
  return first ? first : NAMELESS;
}
