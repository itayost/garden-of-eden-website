import { describe, expect, it } from "vitest";
import { planAdjustment } from "../adjustment";

// 4 used, 2 booked: the screens show 4 Sessions left.
const card = { total: 10, used: 4, booked: 2 };

describe("planAdjustment", () => {
  it("sets the Sessions left the screens show: Bookings keep their sessions", () => {
    expect(planAdjustment(card, 5)).toEqual({ ok: true, leftAfter: 5, totalAfter: 11 });
  });

  it("lowers the Sessions left without touching a Booking", () => {
    expect(planAdjustment(card, 1)).toEqual({ ok: true, leftAfter: 1, totalAfter: 7 });
  });

  it("allows 0 left once sessions were used or booked", () => {
    expect(planAdjustment(card, 0)).toMatchObject({ ok: true, totalAfter: 6 });
    expect(planAdjustment({ total: 10, used: 0, booked: 1 }, 0)).toMatchObject({ ok: true, totalAfter: 1 });
  });

  it("refuses 0 left on a Card with nothing used or booked, pointing to Void or Cancellation", () => {
    expect(planAdjustment({ total: 10, used: 0, booked: 0 }, 0)).toEqual({
      ok: false,
      error: "בכרטיסייה שלא נוצל ולא נרשם בה אימון אין יתרה של 0. לביטול: ביטול רישום או ביטול עסקה.",
    });
  });

  it("refuses no change and a negative target", () => {
    expect(planAdjustment(card, 4)).toEqual({ ok: false, error: "היתרה לא השתנתה" });
    expect(planAdjustment(card, -1)).toEqual({ ok: false, error: "יתרה לא יכולה להיות שלילית" });
    expect(planAdjustment(card, 2.5)).toEqual({ ok: false, error: "יתרה היא מספר שלם של אימונים" });
    expect(planAdjustment(card, 201)).toEqual({ ok: false, error: "יתרה גבוהה מדי" });
  });
});
