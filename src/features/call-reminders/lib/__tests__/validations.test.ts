import { describe, it, expect } from "vitest";
import { callTargetSchema, retentionCallLogSchema } from "../validations";

const LEAD_ID = "11111111-1111-4111-8111-111111111111";

describe("callTargetSchema", () => {
  it("accepts a lead by id and refuses a bad id", () => {
    expect(callTargetSchema.safeParse({ kind: "lead", leadId: LEAD_ID }).success).toBe(true);
    expect(callTargetSchema.safeParse({ kind: "lead", leadId: "x" }).success).toBe(false);
  });

  it("stores a retention phone in E.164 whatever format Arbox gave", () => {
    const parsed = callTargetSchema.parse({
      kind: "retention",
      reportMonth: "2026-11-01",
      phone: "050-123-4567",
    });
    expect(parsed).toEqual({
      kind: "retention",
      reportMonth: "2026-11-01",
      phone: "+972501234567",
    });
  });

  it("refuses a month that is not the first of the month, and an unreadable phone", () => {
    const base = { kind: "retention", reportMonth: "2026-11-01", phone: "0501234567" };
    expect(callTargetSchema.safeParse({ ...base, reportMonth: "2026-11-15" }).success).toBe(false);
    expect(callTargetSchema.safeParse({ ...base, phone: "123" }).success).toBe(false);
  });
});

describe("retentionCallLogSchema", () => {
  const valid = {
    reportMonth: "2026-11-01",
    phone: "0501234567",
    traineeName: "דני",
    outcome: "no_answer",
    notes: "",
  };

  it("accepts one of the four lead outcomes and normalizes the phone", () => {
    const parsed = retentionCallLogSchema.parse(valid);
    expect(parsed.phone).toBe("+972501234567");
    expect(parsed.outcome).toBe("no_answer");
  });

  it("requires an outcome", () => {
    expect(retentionCallLogSchema.safeParse({ ...valid, outcome: undefined }).success).toBe(false);
    expect(retentionCallLogSchema.safeParse({ ...valid, outcome: "maybe" }).success).toBe(false);
  });

  it("refuses notes over 2000 characters", () => {
    const long = "א".repeat(2001);
    expect(retentionCallLogSchema.safeParse({ ...valid, notes: long }).success).toBe(false);
    expect(retentionCallLogSchema.safeParse({ ...valid, notes: "א".repeat(2000) }).success).toBe(true);
  });
});
