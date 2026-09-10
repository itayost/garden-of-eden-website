import { describe, it, expect } from "vitest";
import { signRenewalToken, verifyRenewalToken } from "../renewal-token";

const SECRET = "test-secret";
const PLAN = "11111111-1111-4111-8111-111111111111";

describe("renewal token", () => {
  it("round-trips a plan id before expiry", () => {
    const token = signRenewalToken(PLAN, 2_000_000_000, SECRET);
    expect(verifyRenewalToken(token, SECRET, 1_999_999_999)).toEqual({ planId: PLAN });
  });
  it("rejects an expired token", () => {
    const token = signRenewalToken(PLAN, 1_000, SECRET);
    expect(verifyRenewalToken(token, SECRET, 1_001)).toBeNull();
  });
  it("rejects a tampered token and a wrong secret", () => {
    const token = signRenewalToken(PLAN, 2_000_000_000, SECRET);
    expect(verifyRenewalToken(token.slice(0, -2) + "zz", SECRET, 0)).toBeNull();
    expect(verifyRenewalToken(token, "other", 0)).toBeNull();
    expect(verifyRenewalToken("garbage", SECRET, 0)).toBeNull();
  });
});
