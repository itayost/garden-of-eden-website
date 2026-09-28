const BASE_LABEL = "פתיחת התפריט";

/** Accessible name for any control that closes the navigation drawer. */
export const CLOSE_MENU_LABEL = "סגירת התפריט";

/** Hebrew screen-reader phrase for an attention count, singular-aware. */
export function attentionLabel(count: number): string {
  return count === 1
    ? "פריט אחד דורש תשומת לב"
    : `${count} פריטים דורשים תשומת לב`;
}

/**
 * Accessible name for the header menu button. On phones the button is the only
 * way into the navigation, so it also carries the attention count the nav
 * items hold (for example open tasks) and has to say it out loud.
 */
export function menuTriggerLabel(attentionCount: number): string {
  if (attentionCount <= 0) return BASE_LABEL;
  return `${BASE_LABEL}, ${attentionLabel(attentionCount)}`;
}
