/**
 * An Adjustment: staff type the balance a Card should show (sessions not yet
 * used, Bookings included) and the total moves by the difference. Used
 * sessions never change; Bookings beyond a lowered balance follow the shrink
 * rule.
 */
export interface CardCounts {
  total: number;
  /** Sessions that took place. */
  used: number;
  /** Future Bookings charged to this Card. */
  booked: number;
}

export type AdjustmentPlan =
  | {
      ok: true;
      leftAfter: number;
      totalAfter: number;
      /** Bookings the new balance no longer covers. */
      bookingsOver: number;
    }
  | { ok: false; error: string };

/** The highest balance staff may type; the server schema enforces the same cap. */
export const MAX_CARD_BALANCE = 200;

export function planAdjustment(card: CardCounts, target: number): AdjustmentPlan {
  if (!Number.isInteger(target)) return { ok: false, error: "יתרה היא מספר שלם של אימונים" };
  if (target < 0) return { ok: false, error: "יתרה לא יכולה להיות שלילית" };
  if (target > MAX_CARD_BALANCE) return { ok: false, error: "יתרה גבוהה מדי" };
  const leftBefore = card.total - card.used;
  if (target === leftBefore) return { ok: false, error: "היתרה לא השתנתה" };
  // A Card holds at least one session; an unused one with nothing left is a Void or a Cancellation.
  if (card.used + target === 0) {
    return { ok: false, error: "בכרטיסייה שלא נוצל בה אימון אין יתרה של 0. לביטול: ביטול רישום או ביטול עסקה." };
  }
  return {
    ok: true,
    leftAfter: target,
    totalAfter: card.used + target,
    bookingsOver: Math.max(card.booked - target, 0),
  };
}
