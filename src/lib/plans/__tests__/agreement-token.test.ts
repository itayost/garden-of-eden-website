import { describe, it, expect } from "vitest";
import { signAgreementToken, verifyAgreementToken } from "../agreement-token";

const ID = "11111111-1111-4111-8111-111111111111";

describe("agreement token", () => {
  it("verifies its own signature and rejects others", () => {
    const token = signAgreementToken(ID, "s");
    expect(verifyAgreementToken(ID, token, "s")).toBe(true);
    expect(verifyAgreementToken(ID, token, "other")).toBe(false);
    expect(verifyAgreementToken("22222222-2222-4222-8222-222222222222", token, "s")).toBe(false);
    expect(verifyAgreementToken(ID, "nope", "s")).toBe(false);
  });
});
