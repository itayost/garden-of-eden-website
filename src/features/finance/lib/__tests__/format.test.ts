import { describe, expect, test } from "vitest";
import { longDay, rangeLabel, safeReceiptUrl, shortDay, timeOf } from "../format";

describe("timeOf", () => {
  test("reads the time in Israel, summer and winter", () => {
    expect(timeOf("2026-10-12T05:12:00Z")).toBe("08:12");
    expect(timeOf("2026-12-01T06:12:00Z")).toBe("08:12");
  });
});

describe("day labels", () => {
  test("long and short forms", () => {
    expect(longDay("2026-10-12")).toBe("יום שני, 12 באוקטובר 2026");
    expect(shortDay("2026-10-12")).toBe("ב׳ 12.10");
  });
  test("a range label names both ends", () => {
    expect(rangeLabel({ from: "2026-10-12", to: "2026-10-12", preset: "day", clipped: false })).toBe("יום שני, 12 באוקטובר 2026");
    expect(rangeLabel({ from: "2026-10-06", to: "2026-10-12", preset: "week", clipped: false })).toBe("6.10 עד 12.10.2026");
  });
});

describe("safeReceiptUrl", () => {
  test("keeps https links", () => {
    expect(safeReceiptUrl("https://morning.co/doc/1")).toBe("https://morning.co/doc/1");
  });
  test("drops javascript:, http: and null", () => {
    expect(safeReceiptUrl("javascript:alert(1)")).toBeNull();
    expect(safeReceiptUrl("http://morning.co/doc/1")).toBeNull();
    expect(safeReceiptUrl(null)).toBeNull();
  });
});
