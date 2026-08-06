import { describe, expect, test } from "vitest";

import {
  duplicateDaySchema,
  slotSchema,
} from "@/lib/validations/schedule";

const TRAINER = "11111111-1111-4111-8111-111111111111";
const TRAINEE = "22222222-2222-4222-8222-222222222222";

function validSlot(overrides: Record<string, unknown> = {}) {
  return {
    scheduleDate: "2026-08-06",
    startTime: "15:00",
    trainerId: TRAINER,
    focus: "זריזות מהירות",
    location: "",
    trainees: [{ traineeId: TRAINEE, name: "נועם חלבי" }],
    ...overrides,
  };
}

describe("slotSchema", () => {
  test("accepts a valid slot", () => {
    expect(slotSchema.safeParse(validSlot()).success).toBe(true);
  });

  test("accepts a free-text roster entry with no traineeId", () => {
    const result = slotSchema.parse(
      validSlot({ trainees: [{ name: "אורח חדש" }] }),
    );

    expect(result.trainees[0]).toEqual({ traineeId: null, name: "אורח חדש" });
  });

  test("accepts a trainer-less slot and normalizes to null", () => {
    const result = slotSchema.parse(validSlot({ trainerId: undefined }));

    expect(result.trainerId).toBe(null);
  });

  test("empty focus and location become null, not empty string", () => {
    const result = slotSchema.parse(validSlot({ focus: "  ", location: "" }));

    expect(result.focus).toBe(null);
    expect(result.location).toBe(null);
  });

  test("requires at least one roster entry", () => {
    expect(slotSchema.safeParse(validSlot({ trainees: [] })).success).toBe(false);
  });

  test("rejects a whitespace-only roster name", () => {
    expect(
      slotSchema.safeParse(validSlot({ trainees: [{ name: "   " }] })).success,
    ).toBe(false);
  });

  test("rejects the same linked trainee twice in one roster", () => {
    const result = slotSchema.safeParse(
      validSlot({
        trainees: [
          { traineeId: TRAINEE, name: "נועם" },
          { traineeId: TRAINEE, name: "נועם חלבי" },
        ],
      }),
    );

    expect(result.success).toBe(false);
  });

  test("allows duplicate free-text names across entries with no traineeId", () => {
    // Two different kids can share a first name; free-text rows are not deduped.
    const result = slotSchema.safeParse(
      validSlot({ trainees: [{ name: "נועם" }, { name: "נועם" }] }),
    );

    expect(result.success).toBe(true);
  });

  test("validates the time as 24h HH:MM", () => {
    expect(slotSchema.safeParse(validSlot({ startTime: "9:00" })).success).toBe(false);
    expect(slotSchema.safeParse(validSlot({ startTime: "24:00" })).success).toBe(false);
    expect(slotSchema.safeParse(validSlot({ startTime: "15:60" })).success).toBe(false);
    expect(slotSchema.safeParse(validSlot({ startTime: "09:30" })).success).toBe(true);
  });

  test("rejects an invalid date", () => {
    expect(
      slotSchema.safeParse(validSlot({ scheduleDate: "2026-02-30" })).success,
    ).toBe(false);
  });
});

describe("duplicateDaySchema", () => {
  test("accepts two different valid dates", () => {
    expect(
      duplicateDaySchema.safeParse({ fromDate: "2026-08-05", toDate: "2026-08-06" })
        .success,
    ).toBe(true);
  });

  test("rejects duplicating a day onto itself", () => {
    expect(
      duplicateDaySchema.safeParse({ fromDate: "2026-08-06", toDate: "2026-08-06" })
        .success,
    ).toBe(false);
  });
});
