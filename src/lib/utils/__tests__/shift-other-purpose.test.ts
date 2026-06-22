import { describe, it, expect } from "vitest";
import { splitShiftMinutes, validateOtherPurpose } from "../shift-other-purpose";

const FIXED_NOW = new Date("2026-06-22T12:00:00Z").getTime();

describe("splitShiftMinutes", () => {
  it("splits an ended shift into training and other", () => {
    expect(
      splitShiftMinutes({
        start_time: "2026-06-22T08:00:00Z",
        end_time: "2026-06-22T12:00:00Z",
        other_purpose_minutes: 30,
      }),
    ).toEqual({ grossMinutes: 240, otherMinutes: 30, trainingMinutes: 210 });
  });

  it("clamps other to gross when it exceeds the shift", () => {
    expect(
      splitShiftMinutes({
        start_time: "2026-06-22T08:00:00Z",
        end_time: "2026-06-22T09:00:00Z",
        other_purpose_minutes: 120,
      }),
    ).toEqual({ grossMinutes: 60, otherMinutes: 60, trainingMinutes: 0 });
  });

  it("uses now for an open shift", () => {
    const r = splitShiftMinutes(
      { start_time: "2026-06-22T11:00:00Z", end_time: null, other_purpose_minutes: 0 },
      FIXED_NOW,
    );
    expect(r.grossMinutes).toBe(60);
    expect(r.trainingMinutes).toBe(60);
  });
});

describe("validateOtherPurpose", () => {
  it("accepts valid minutes + preset category within the shift", () => {
    expect(validateOtherPurpose(30, "תזונה", 240)).toEqual({
      ok: true,
      minutes: 30,
      category: "תזונה",
    });
  });

  it("treats zero as a clear (no category)", () => {
    expect(validateOtherPurpose(0, "תזונה", 240)).toEqual({
      ok: true,
      minutes: 0,
      category: null,
    });
  });

  it("rejects minutes over the shift duration", () => {
    expect(validateOtherPurpose(300, "תזונה", 240)).toMatchObject({ ok: false });
  });

  it("rejects an unknown category", () => {
    expect(validateOtherPurpose(30, "משהו אחר", 240)).toMatchObject({ ok: false });
  });

  it("rejects minutes > 0 with no category", () => {
    expect(validateOtherPurpose(30, null, 240)).toMatchObject({ ok: false });
  });

  it("rejects non-integer minutes", () => {
    expect(validateOtherPurpose(30.5, "תזונה", 240)).toMatchObject({ ok: false });
  });

  it("rejects a negative non-integer instead of silently clearing", () => {
    expect(validateOtherPurpose(-0.5, null, 240)).toMatchObject({ ok: false });
  });

  it("rejects a negative integer instead of silently clearing", () => {
    // A negative integer with a category must not be coerced into a clear.
    expect(validateOtherPurpose(-1, "תזונה", 240)).toMatchObject({ ok: false });
  });

  it("rejects NaN minutes", () => {
    expect(validateOtherPurpose(Number.NaN, "תזונה", 240)).toMatchObject({ ok: false });
  });
});
