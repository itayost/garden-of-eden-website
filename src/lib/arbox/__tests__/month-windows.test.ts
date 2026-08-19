import { describe, test, expect } from "vitest";
import { monthWindows } from "../access";

describe("monthWindows", () => {
  test("the final window stops at today, not at the end of the month", () => {
    // Asking Arbox for a range ending in the future risks a validation error,
    // and one of those would take down the whole nightly sweep.
    expect(monthWindows("2026-08-01", new Date("2026-08-19T00:00:00Z"))).toEqual([
      { from: "2026-08-01", to: "2026-08-19" },
    ]);
  });

  test("earlier months keep their full range", () => {
    expect(monthWindows("2026-06-01", new Date("2026-08-19T00:00:00Z"))).toEqual([
      { from: "2026-06-01", to: "2026-06-30" },
      { from: "2026-07-01", to: "2026-07-31" },
      { from: "2026-08-01", to: "2026-08-19" },
    ]);
  });

  test("crosses a year boundary", () => {
    expect(monthWindows("2025-11-01", new Date("2026-01-15T00:00:00Z"))).toEqual([
      { from: "2025-11-01", to: "2025-11-30" },
      { from: "2025-12-01", to: "2025-12-31" },
      { from: "2026-01-01", to: "2026-01-15" },
    ]);
  });

  test("gets February right in a leap year and a common year", () => {
    expect(monthWindows("2024-02-01", new Date("2024-03-10T00:00:00Z"))).toEqual([
      { from: "2024-02-01", to: "2024-02-29" },
      { from: "2024-03-01", to: "2024-03-10" },
    ]);
    expect(monthWindows("2025-02-01", new Date("2025-03-10T00:00:00Z"))).toEqual([
      { from: "2025-02-01", to: "2025-02-28" },
      { from: "2025-03-01", to: "2025-03-10" },
    ]);
  });

  test("snaps a mid-month start back to the first", () => {
    // Otherwise the first window would miss everything earlier in that month.
    expect(monthWindows("2026-03-17", new Date("2026-03-20T00:00:00Z"))).toEqual([
      { from: "2026-03-01", to: "2026-03-20" },
    ]);
  });

  test("never returns a window ending after today", () => {
    const today = new Date("2026-08-19T00:00:00Z");
    for (const w of monthWindows("2023-01-01", today)) {
      expect(Date.parse(`${w.to}T00:00:00Z`)).toBeLessThanOrEqual(today.getTime());
    }
  });

  test("no window ever exceeds Arbox's 31-day cap", () => {
    for (const w of monthWindows("2023-01-01", new Date("2026-08-19T00:00:00Z"))) {
      const days =
        (Date.parse(`${w.to}T00:00:00Z`) - Date.parse(`${w.from}T00:00:00Z`)) /
          86_400_000 +
        1;
      expect(days).toBeLessThanOrEqual(31);
    }
  });

  test("returns nothing when the start is in the future", () => {
    expect(monthWindows("2030-01-01", new Date("2026-08-19T00:00:00Z"))).toEqual(
      []
    );
  });
});
