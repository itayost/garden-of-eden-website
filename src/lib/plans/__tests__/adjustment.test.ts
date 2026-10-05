import { describe, expect, it } from "vitest";
import { planAdjustment } from "../adjustment";

const card = { total: 10, used: 4, booked: 2 };

describe("planAdjustment", () => {
  it("raises the balance from one target: total moves by the difference", () => {
    expect(planAdjustment(card, 9)).toEqual({ ok: true, leftAfter: 9, totalAfter: 13, bookingsOver: 0 });
  });

  it("lowers the balance; Bookings beyond it are reported for the shrink rule", () => {
    expect(planAdjustment(card, 1)).toMatchObject({ ok: true, totalAfter: 5, bookingsOver: 1 });
  });

  it("allows 0 left once sessions were used", () => {
    expect(planAdjustment(card, 0)).toMatchObject({ ok: true, totalAfter: 4, bookingsOver: 2 });
  });

  it("refuses 0 left on an unused Card, pointing to Void or Cancellation", () => {
    expect(planAdjustment({ total: 10, used: 0, booked: 0 }, 0)).toEqual({
      ok: false,
      error: "בכרטיסייה שלא נוצל בה אימון אין יתרה של 0. לביטול: ביטול רישום או ביטול עסקה.",
    });
  });

  it("refuses no change and a negative target", () => {
    expect(planAdjustment(card, 6)).toEqual({ ok: false, error: "היתרה לא השתנתה" });
    expect(planAdjustment(card, -1)).toEqual({ ok: false, error: "יתרה לא יכולה להיות שלילית" });
    expect(planAdjustment(card, 2.5)).toEqual({ ok: false, error: "יתרה היא מספר שלם של אימונים" });
    expect(planAdjustment(card, 201)).toEqual({ ok: false, error: "יתרה גבוהה מדי" });
  });
});
