import { describe, expect, it } from "vitest";
import { acceptProposalSchema, rejectProposalSchema } from "../goal-proposals";

const PROPOSAL = "11111111-1111-4111-8111-111111111111";
const VERSION = "2026-11-17T04:15:42.123456+00:00";

/** The first issue's message, or null when the input parsed. */
function firstMessage(result: { success: boolean; error?: { issues: { message: string }[] } }) {
  return result.success ? null : (result.error?.issues[0]?.message ?? null);
}

describe("acceptProposalSchema", () => {
  it("accepts no target: the proposal's own target is used", () => {
    const parsed = acceptProposalSchema.parse({ proposalId: PROPOSAL, version: VERSION });
    expect(parsed).toEqual({ proposalId: PROPOSAL, version: VERSION });
    expect(parsed.target).toBeUndefined();
  });

  it("accepts a target staff typed, up to 3 decimals and up to 9999", () => {
    expect(acceptProposalSchema.parse({ proposalId: PROPOSAL, version: VERSION, target: 2.02 }).target).toBe(2.02);
    expect(acceptProposalSchema.safeParse({ proposalId: PROPOSAL, version: VERSION, target: 1.234 }).success).toBe(
      true,
    );
    expect(acceptProposalSchema.safeParse({ proposalId: PROPOSAL, version: VERSION, target: 9999 }).success).toBe(true);
  });

  it("refuses a target of 0 or below", () => {
    const zero = acceptProposalSchema.safeParse({ proposalId: PROPOSAL, version: VERSION, target: 0 });
    expect(firstMessage(zero)).toBe("היעד חייב להיות מספר חיובי");
    const negative = acceptProposalSchema.safeParse({ proposalId: PROPOSAL, version: VERSION, target: -1 });
    expect(firstMessage(negative)).toBe("היעד חייב להיות מספר חיובי");
  });

  it("refuses a target with more than 3 decimals", () => {
    const result = acceptProposalSchema.safeParse({ proposalId: PROPOSAL, version: VERSION, target: 1.2345 });
    expect(firstMessage(result)).toBe("עד 3 ספרות אחרי הנקודה");
    expect(acceptProposalSchema.safeParse({ proposalId: PROPOSAL, version: VERSION, target: 1e-7 }).success).toBe(
      false,
    );
  });

  it("refuses a target above 9999", () => {
    expect(acceptProposalSchema.safeParse({ proposalId: PROPOSAL, version: VERSION, target: 10000 }).success).toBe(
      false,
    );
  });

  it("refuses a target that is not a finite number", () => {
    for (const target of [Number.NaN, Number.POSITIVE_INFINITY, "2"]) {
      const result = acceptProposalSchema.safeParse({ proposalId: PROPOSAL, version: VERSION, target });
      expect(firstMessage(result)).toBe("היעד חייב להיות מספר חיובי");
    }
  });

  it("refuses a malformed id", () => {
    const result = acceptProposalSchema.safeParse({ proposalId: "x", version: VERSION });
    expect(firstMessage(result)).toBe("מזהה הצעה לא תקין");
  });

  it("refuses a request without the version the screen showed", () => {
    expect(firstMessage(acceptProposalSchema.safeParse({ proposalId: PROPOSAL }))).toBe("גרסה לא תקינה");
    expect(firstMessage(acceptProposalSchema.safeParse({ proposalId: PROPOSAL, version: "" }))).toBe("גרסה לא תקינה");
    expect(acceptProposalSchema.safeParse({ proposalId: PROPOSAL, version: "1".repeat(65) }).success).toBe(false);
  });
});

describe("rejectProposalSchema", () => {
  it("accepts no reason, as null", () => {
    expect(rejectProposalSchema.parse({ proposalId: PROPOSAL, version: VERSION })).toEqual({
      proposalId: PROPOSAL,
      version: VERSION,
      reason: null,
    });
  });

  it("trims the reason and turns blank into null", () => {
    expect(rejectProposalSchema.parse({ proposalId: PROPOSAL, version: VERSION, reason: "  " }).reason).toBeNull();
    expect(rejectProposalSchema.parse({ proposalId: PROPOSAL, version: VERSION, reason: " כבר עובד על זה " }).reason).toBe(
      "כבר עובד על זה",
    );
  });

  it("refuses a reason over 200 characters", () => {
    const result = rejectProposalSchema.safeParse({ proposalId: PROPOSAL, version: VERSION, reason: "א".repeat(201) });
    expect(firstMessage(result)).toBe("הסיבה ארוכה מדי (מקסימום 200 תווים)");
    expect(
      rejectProposalSchema.safeParse({ proposalId: PROPOSAL, version: VERSION, reason: "א".repeat(200) }).success,
    ).toBe(true);
  });

  it("refuses a missing version and a malformed id", () => {
    expect(firstMessage(rejectProposalSchema.safeParse({ proposalId: PROPOSAL }))).toBe("גרסה לא תקינה");
    expect(firstMessage(rejectProposalSchema.safeParse({ proposalId: "x", version: VERSION }))).toBe(
      "מזהה הצעה לא תקין",
    );
  });
});
