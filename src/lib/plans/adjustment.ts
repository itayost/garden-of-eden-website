/**
 * An Adjustment: staff type the Sessions left a Card should show (total minus
 * used minus future Bookings, the number on every screen) and the total moves
 * by the difference. Used sessions and Bookings keep their sessions; an
 * Adjustment never cancels a Booking.
 */
export interface CardCounts {
  total: number;
  /** Sessions that took place. */
  used: number;
  /** Future Bookings charged to this Card. */
  booked: number;
}

export type AdjustmentPlan = { ok: true; leftAfter: number; totalAfter: number } | { ok: false; error: string };

/** The highest Sessions left staff may type; the server schema enforces the same cap. */
export const MAX_CARD_BALANCE = 200;

export function planAdjustment(card: CardCounts, target: number): AdjustmentPlan {
  if (!Number.isInteger(target)) return { ok: false, error: "יתרה היא מספר שלם של אימונים" };
  if (target < 0) return { ok: false, error: "יתרה לא יכולה להיות שלילית" };
  if (target > MAX_CARD_BALANCE) return { ok: false, error: "יתרה גבוהה מדי" };
  const taken = card.used + card.booked;
  if (target === card.total - taken) return { ok: false, error: "היתרה לא השתנתה" };
  // A Card holds at least one session; an untouched one with nothing left is a Void or a Cancellation.
  if (taken + target === 0) {
    return {
      ok: false,
      error: "בכרטיסייה שלא נוצל ולא נרשם בה אימון אין יתרה של 0. לביטול: ביטול רישום או ביטול עסקה.",
    };
  }
  return { ok: true, leftAfter: target, totalAfter: taken + target };
}
