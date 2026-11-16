import { describe, expect, it } from "vitest";
import { quickTagNoteSchema, quickTagToggleSchema } from "../quick-tags";

const IDS = {
  slotId: "11111111-1111-4111-8111-111111111111",
  traineeId: "22222222-2222-4222-8222-222222222222",
};

describe("quickTagToggleSchema", () => {
  it("accepts a known tag", () => {
    expect(quickTagToggleSchema.safeParse({ ...IDS, tag: "effort", on: true }).success).toBe(true);
  });

  it("refuses an unknown tag or a bad id", () => {
    expect(quickTagToggleSchema.safeParse({ ...IDS, tag: "dancing", on: true }).success).toBe(false);
    expect(quickTagToggleSchema.safeParse({ ...IDS, slotId: "x", tag: "effort", on: true }).success).toBe(false);
  });
});

describe("quickTagNoteSchema", () => {
  it("trims, and spaces alone mean delete", () => {
    expect(quickTagNoteSchema.parse({ ...IDS, note: "  ריכוז  " }).note).toBe("ריכוז");
    expect(quickTagNoteSchema.parse({ ...IDS, note: "   " }).note).toBe("");
  });

  it("refuses more than 80 characters", () => {
    const result = quickTagNoteSchema.safeParse({ ...IDS, note: "א".repeat(81) });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.message).toBe("עד 80 תווים");
  });
});
