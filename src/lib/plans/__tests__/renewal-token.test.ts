import { describe, it, expect } from "vitest";
import { signRenewalToken, signTraineeToken, verifyRenewalToken } from "../renewal-token";

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

describe("trainee purchase token", () => {
  const TRAINEE = "22222222-2222-4222-8222-222222222222";

  it("round-trips a trainee id, for a trainee with no Plan to name", () => {
    const token = signTraineeToken(TRAINEE, 2_000_000_000, SECRET);
    expect(verifyRenewalToken(token, SECRET, 1_999_999_999)).toEqual({ profileId: TRAINEE });
  });

  it("is never read as a plan token, nor a plan token as a trainee one", () => {
    const traineeToken = signTraineeToken(TRAINEE, 2_000_000_000, SECRET);
    const planToken = signRenewalToken(TRAINEE, 2_000_000_000, SECRET);
    // Same id, different subject: the signatures differ.
    expect(traineeToken.split(".")[2]).not.toBe(planToken.split(".")[2]);
    expect(verifyRenewalToken(planToken, SECRET, 0)).toEqual({ planId: TRAINEE });
  });

  it("rejects an expired or tampered trainee token", () => {
    const token = signTraineeToken(TRAINEE, 1_000, SECRET);
    expect(verifyRenewalToken(token, SECRET, 1_001)).toBeNull();
    const live = signTraineeToken(TRAINEE, 2_000_000_000, SECRET);
    expect(verifyRenewalToken(live.slice(0, -2) + "zz", SECRET, 0)).toBeNull();
  });

  it("refuses a multibyte signature of the right length instead of throwing", () => {
    const live = signTraineeToken(TRAINEE, 2_000_000_000, SECRET);
    const forged = live.slice(0, -1) + "א";
    expect(() => verifyRenewalToken(forged, SECRET, 0)).not.toThrow();
    expect(verifyRenewalToken(forged, SECRET, 0)).toBeNull();
  });

  it("does not verify a trainee token with its prefix stripped as a plan token", () => {
    const [subject, expires, signature] = signTraineeToken(TRAINEE, 2_000_000_000, SECRET).split(".");
    const stripped = `${subject.slice(2)}.${expires}.${signature}`;
    expect(verifyRenewalToken(stripped, SECRET, 0)).toBeNull();
  });
});
