import { describe, expect, test } from "vitest";

import {
  bandSchema,
  exceptionSchema,
} from "@/lib/validations/weekly-schedule";

const TRAINER = "11111111-1111-4111-8111-111111111111";

function validBand(overrides: Record<string, unknown> = {}) {
  return {
    weekday: 0,
    startTime: "15:00",
    endTime: "18:00",
    trainerId: TRAINER,
    location: "סטודיו",
    label: "",
    isStandby: false,
    ...overrides,
  };
}

function validException(overrides: Record<string, unknown> = {}) {
  return {
    exceptionDate: "2026-08-16",
    trainerId: TRAINER,
    kind: "absent",
    startTime: "",
    endTime: "",
    location: "",
    label: "",
    note: "חופשה",
    ...overrides,
  };
}

describe("bandSchema", () => {
  test("accepts a valid band", () => {
    expect(bandSchema.safeParse(validBand()).success).toBe(true);
  });

  test("accepts an open-ended band and normalizes the empty end to null", () => {
    const result = bandSchema.parse(validBand({ endTime: "" }));

    expect(result.endTime).toBe(null);
  });

  test("treats a missing end time as open-ended", () => {
    const result = bandSchema.parse(validBand({ endTime: undefined }));

    expect(result.endTime).toBe(null);
  });

  test("empty location and label become null, not empty string", () => {
    const result = bandSchema.parse(validBand({ location: "  ", label: "" }));

    expect(result.location).toBe(null);
    expect(result.label).toBe(null);
  });

  test("requires a trainer", () => {
    // Unlike a slot, which may be written before anyone knows who takes it.
    expect(bandSchema.safeParse(validBand({ trainerId: undefined })).success).toBe(
      false,
    );
  });

  test("rejects an end time at or before the start", () => {
    expect(bandSchema.safeParse(validBand({ endTime: "15:00" })).success).toBe(false);
    expect(bandSchema.safeParse(validBand({ endTime: "14:00" })).success).toBe(false);
  });

  test("validates the weekday range", () => {
    expect(bandSchema.safeParse(validBand({ weekday: -1 })).success).toBe(false);
    expect(bandSchema.safeParse(validBand({ weekday: 7 })).success).toBe(false);
    expect(bandSchema.safeParse(validBand({ weekday: 6 })).success).toBe(true);
  });

  test("validates times as 24h HH:MM", () => {
    expect(bandSchema.safeParse(validBand({ startTime: "9:00" })).success).toBe(false);
    expect(bandSchema.safeParse(validBand({ startTime: "24:00" })).success).toBe(false);
    expect(bandSchema.safeParse(validBand({ startTime: "09:30" })).success).toBe(true);
  });

  test("defaults isStandby to false when omitted", () => {
    const result = bandSchema.parse(validBand({ isStandby: undefined }));

    expect(result.isStandby).toBe(false);
  });
});

describe("exceptionSchema", () => {
  test("accepts an absence with no times", () => {
    expect(exceptionSchema.safeParse(validException()).success).toBe(true);
  });

  test("rejects an absence carrying times", () => {
    // An absence covers the whole day; times would read as a partial absence
    // the derivation does not implement.
    expect(
      exceptionSchema.safeParse(validException({ startTime: "15:00" })).success,
    ).toBe(false);
  });

  test("accepts an extra with a start time", () => {
    const result = exceptionSchema.safeParse(
      validException({ kind: "extra", startTime: "16:00", endTime: "17:00" }),
    );

    expect(result.success).toBe(true);
  });

  test("accepts an open-ended extra", () => {
    const result = exceptionSchema.parse(
      validException({ kind: "extra", startTime: "18:00", endTime: "" }),
    );

    expect(result.endTime).toBe(null);
  });

  test("rejects an extra with no start time", () => {
    expect(
      exceptionSchema.safeParse(validException({ kind: "extra" })).success,
    ).toBe(false);
  });

  test("rejects an extra whose end is at or before its start", () => {
    expect(
      exceptionSchema.safeParse(
        validException({ kind: "extra", startTime: "16:00", endTime: "16:00" }),
      ).success,
    ).toBe(false);
  });

  test("rejects an unknown kind", () => {
    expect(
      exceptionSchema.safeParse(validException({ kind: "swap" })).success,
    ).toBe(false);
  });

  test("rejects an invalid date", () => {
    expect(
      exceptionSchema.safeParse(validException({ exceptionDate: "2026-02-30" }))
        .success,
    ).toBe(false);
  });
});
