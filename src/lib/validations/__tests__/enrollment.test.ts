import { describe, it, expect } from "vitest";
import { enrollmentSchema } from "../enrollment";

const valid = {
  productId: "11111111-1111-4111-8111-111111111111",
  parentName: "דנה כהן",
  parentIdNumber: "123456782",
  payerPhone: "0501234567",
  loginPhone: "0521234567",
  email: "dana@example.com",
  childName: "יובל כהן",
  childBirthdate: "2015-04-03",
  medicalNotes: "",
  emergencyContactName: "רון כהן",
  emergencyContactPhone: "0531234567",
  declaresHealthy: true,
  acceptsTerms: true,
  authorizesPayment: true,
  photoConsent: "yes",
  signatureName: " דנה כהן ",
};

describe("enrollmentSchema", () => {
  it("accepts a complete form and normalizes phones and the signature", () => {
    const result = enrollmentSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.payerPhone).toBe("+972501234567");
    expect(result.data.loginPhone).toBe("+972521234567");
    expect(result.data.signatureName).toBe("דנה כהן");
    expect(result.data.photoConsent).toBe(true);
    expect(result.data.email).toBe("dana@example.com");
    expect(result.data.medicalNotes).toBeNull();
  });
  it("requires each declaration", () => {
    expect(enrollmentSchema.safeParse({ ...valid, declaresHealthy: false }).success).toBe(false);
    expect(enrollmentSchema.safeParse({ ...valid, acceptsTerms: false }).success).toBe(false);
    expect(enrollmentSchema.safeParse({ ...valid, authorizesPayment: false }).success).toBe(false);
  });
  it("requires the signature to match the parent name", () => {
    expect(enrollmentSchema.safeParse({ ...valid, signatureName: "מישהו אחר" }).success).toBe(false);
  });
  it("rejects a bad id number and accepts photo consent no", () => {
    expect(enrollmentSchema.safeParse({ ...valid, parentIdNumber: "123456781" }).success).toBe(false);
    const no = enrollmentSchema.safeParse({ ...valid, photoConsent: "no" });
    expect(no.success && no.data.photoConsent === false).toBe(true);
  });
  it("allows an empty email", () => {
    const result = enrollmentSchema.safeParse({ ...valid, email: "" });
    expect(result.success && result.data.email === null).toBe(true);
  });
});
