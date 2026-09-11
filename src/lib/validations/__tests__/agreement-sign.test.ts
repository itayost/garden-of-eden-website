import { describe, expect, it } from "vitest";
import { signAgreementSchema } from "../agreement-sign";

const UUID = "11111111-2222-4333-8444-555555555555";
const TOKEN = "a".repeat(64);

const valid = {
  agreementId: UUID,
  token: TOKEN,
  parentName: "רונית לוי",
  parentIdNumber: "123456782",
  parentEmail: "",
  childBirthdate: "2016-05-01",
  medicalNotes: "",
  emergencyContactName: "יוסי לוי",
  emergencyContactPhone: "0501234567",
  declaresHealthy: true,
  acceptsTerms: true,
  authorizesPayment: true,
  photoConsent: "no" as const,
  signatureName: "רונית לוי",
};

describe("signAgreementSchema", () => {
  it("accepts a complete signing and normalizes the output", () => {
    const parsed = signAgreementSchema.parse(valid);
    expect(parsed.photoConsent).toBe(false);
    expect(parsed.parentEmail).toBeNull();
    expect(parsed.medicalNotes).toBeNull();
    expect(parsed.emergencyContactPhone).toBe("+972501234567");
  });

  it("rejects an unchecked declaration", () => {
    expect(signAgreementSchema.safeParse({ ...valid, acceptsTerms: false }).success).toBe(false);
  });

  it("rejects an invalid ID number and a birthdate outside 4 to 25", () => {
    expect(signAgreementSchema.safeParse({ ...valid, parentIdNumber: "123456789" }).success).toBe(false);
    expect(signAgreementSchema.safeParse({ ...valid, childBirthdate: "2025-01-01" }).success).toBe(false);
  });

  it("rejects a malformed token", () => {
    expect(signAgreementSchema.safeParse({ ...valid, token: "abc" }).success).toBe(false);
  });
});
