import { describe, it, expect } from "vitest";
import { assessmentSchema, ASSESSMENT_FIELDS, DEFAULT_ASSESSMENT } from "../assessment";

const ENVELOPE_FIELDS = ["envelope", "envelope_ball"] as const;

describe("assessmentSchema: the envelope tests", () => {
  it.each(ENVELOPE_FIELDS)("accepts %s in seconds up to 60", (field) => {
    expect(assessmentSchema.safeParse({ [field]: 18.375 }).success).toBe(true);
    expect(assessmentSchema.safeParse({ [field]: 60 }).success).toBe(true);
  });

  it.each(ENVELOPE_FIELDS)("refuses %s above 60 seconds", (field) => {
    expect(assessmentSchema.safeParse({ [field]: 60.001 }).success).toBe(false);
  });

  it.each(ENVELOPE_FIELDS)("refuses a zero or negative %s", (field) => {
    expect(assessmentSchema.safeParse({ [field]: 0 }).success).toBe(false);
    expect(assessmentSchema.safeParse({ [field]: -1 }).success).toBe(false);
  });

  it.each(ENVELOPE_FIELDS)("leaves %s optional", (field) => {
    const parsed = assessmentSchema.safeParse({ [field]: null });
    expect(parsed.success).toBe(true);
  });

  it("keeps the envelope values when parsing", () => {
    const parsed = assessmentSchema.parse({ envelope: 17.2, envelope_ball: 21.95 });
    expect(parsed.envelope).toBe(17.2);
    expect(parsed.envelope_ball).toBe(21.95);
  });

  it("lists both envelope fields for the form and starts them empty", () => {
    for (const field of ENVELOPE_FIELDS) {
      expect(ASSESSMENT_FIELDS).toContain(field);
      expect(DEFAULT_ASSESSMENT[field]).toBeNull();
    }
  });
});
