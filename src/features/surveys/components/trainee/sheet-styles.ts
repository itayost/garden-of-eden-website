/**
 * Class strings shared by the Survey sheet and the dashboard card. Tailwind
 * reads them from here, so each one is a complete literal. The sheet is forest
 * green; raised surfaces are forest-light; secondary text keeps 0.65 opacity or
 * more of the near-white for contrast.
 */

/** Near-white text on the forest sheet. */
export const SHEET_TEXT = "text-[#F2F5EA]";

/** Secondary text: intros, hints, counters. */
export const SOFT_TEXT = "text-[#F2F5EA]/75";

/** Captions and meta lines. */
export const FAINT_TEXT = "text-[#F2F5EA]/65";

/** A raised surface with the lime hairline: option rows, rating tiles, chips. */
export const RAISED = "border border-brand-lime/15 bg-forest-light";

/** The same surface as a thumb target: hover brightens the hairline. */
export const RAISED_TARGET = `${RAISED} hover:border-brand-lime/40`;

/** A chosen answer: lime outline over a faint lime wash. */
export const CHOSEN = "border border-brand-lime bg-brand-lime/10";

/** Neutral shadow under the lime primary button: black, low opacity, offset. */
export const BUTTON_SHADOW = "shadow-[0_10px_20px_-12px_rgb(0_0_0/0.5)]";
