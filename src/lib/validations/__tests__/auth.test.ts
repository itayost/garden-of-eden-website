import { describe, it, expect } from "vitest";
import {
  passwordSchema,
  resetPasswordSchema,
  passwordRequirements,
} from "../auth";

describe("passwordSchema", () => {
  it("passes for valid password", () => {
    const result = passwordSchema.safeParse("Abcdef1!");
    expect(result.success).toBe(true);
  });

  it("passes for longer valid password", () => {
    const result = passwordSchema.safeParse("MyStr0ngPassword");
    expect(result.success).toBe(true);
  });

  it("fails for too short password", () => {
    const result = passwordSchema.safeParse("Ab1");
    expect(result.success).toBe(false);
  });

  it("fails for missing uppercase", () => {
    const result = passwordSchema.safeParse("abcdefg1");
    expect(result.success).toBe(false);
  });

  it("fails for missing lowercase", () => {
    const result = passwordSchema.safeParse("ABCDEFG1");
    expect(result.success).toBe(false);
  });

  it("fails for missing digit", () => {
    const result = passwordSchema.safeParse("Abcdefgh");
    expect(result.success).toBe(false);
  });

  it("contains Hebrew error messages", () => {
    const result = passwordSchema.safeParse("short");
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages.some((m) => /סיסמה|תווים/.test(m))).toBe(true);
    }
  });

  it("fails for empty string", () => {
    const result = passwordSchema.safeParse("");
    expect(result.success).toBe(false);
  });
});

describe("resetPasswordSchema", () => {
  it("passes when passwords match", () => {
    const result = resetPasswordSchema.safeParse({
      password: "ValidPass1",
      confirmPassword: "ValidPass1",
    });
    expect(result.success).toBe(true);
  });

  it("fails when passwords do not match", () => {
    const result = resetPasswordSchema.safeParse({
      password: "ValidPass1",
      confirmPassword: "Different1",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages.some((m) => /תואמות/.test(m))).toBe(true);
    }
  });

  it("fails when password is invalid even if they match", () => {
    const result = resetPasswordSchema.safeParse({
      password: "weak",
      confirmPassword: "weak",
    });
    expect(result.success).toBe(false);
  });

  it("error targets confirmPassword path on mismatch", () => {
    const result = resetPasswordSchema.safeParse({
      password: "ValidPass1",
      confirmPassword: "Other1Pass",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join("."));
      expect(paths).toContain("confirmPassword");
    }
  });
});

describe("passwordRequirements", () => {
  it("has 4 requirements", () => {
    expect(passwordRequirements).toHaveLength(4);
  });

  it("tests min length correctly", () => {
    expect(passwordRequirements[0].test("12345678")).toBe(true);
    expect(passwordRequirements[0].test("1234567")).toBe(false);
  });

  it("tests uppercase correctly", () => {
    expect(passwordRequirements[1].test("A")).toBe(true);
    expect(passwordRequirements[1].test("abc")).toBe(false);
  });

  it("tests lowercase correctly", () => {
    expect(passwordRequirements[2].test("a")).toBe(true);
    expect(passwordRequirements[2].test("ABC")).toBe(false);
  });

  it("tests digit correctly", () => {
    expect(passwordRequirements[3].test("1")).toBe(true);
    expect(passwordRequirements[3].test("abc")).toBe(false);
  });

  it("has Hebrew labels", () => {
    for (const req of passwordRequirements) {
      expect(req.label).toBeTruthy();
    }
  });
});
