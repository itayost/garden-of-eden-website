import { describe, expect, it } from "vitest";
import { checkinSchema } from "../checkins";

const VALID = { sleepHours: 7.5, energy: 4, soreness: false };

describe("checkinSchema", () => {
  it("accepts a full answer", () => {
    expect(checkinSchema.parse(VALID)).toEqual(VALID);
  });

  it("refuses energy outside 1 to 5 or between levels", () => {
    for (const energy of [0, 6, 2.5]) {
      expect(checkinSchema.safeParse({ ...VALID, energy }).success).toBe(false);
    }
  });

  it("refuses sleep between half hours", () => {
    const result = checkinSchema.safeParse({ ...VALID, sleepHours: 7.25 });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.message).toBe("שעות שינה לא תקינות");
  });

  it("refuses a missing soreness answer", () => {
    expect(checkinSchema.safeParse({ sleepHours: 8, energy: 3 }).success).toBe(false);
  });
});
