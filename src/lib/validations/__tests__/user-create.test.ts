import { describe, expect, it } from "vitest";
import { userCreateSchema } from "../user-create";

const BRANCH = "3f5b2c1a-9d4e-4f2b-8a7c-1e2d3f4a5b6c";

const BASE = {
  full_name: "יוסי כהן",
  role: "trainee" as const,
  branch_ids: [BRANCH],
};

describe("userCreateSchema phone handling", () => {
  it("accepts local, E.164, bare Auth, and punctuated phones as canonical E.164", () => {
    for (const phone of [
      "0501234567",
      "+972501234567",
      "972501234567",
      "050-123-4567",
    ]) {
      const result = userCreateSchema.safeParse({ ...BASE, phone });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.phone).toBe("+972501234567");
    }
  });
});

describe("userCreateSchema branch membership", () => {
  const withPhone = { ...BASE, phone: "0501234567" };

  it("refuses a trainee with no branch", () => {
    const result = userCreateSchema.safeParse({ ...withPhone, branch_ids: [] });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.branch_ids).toBeDefined();
    }
  });

  it("refuses a trainer with no branch, who would otherwise see nothing", () => {
    const result = userCreateSchema.safeParse({ ...withPhone, role: "trainer", branch_ids: [] });

    expect(result.success).toBe(false);
  });

  it("accepts an admin with no branch, because an admin sees every branch", () => {
    const result = userCreateSchema.safeParse({ ...withPhone, role: "admin", branch_ids: [] });

    expect(result.success).toBe(true);
  });

  it("accepts a trainee with one branch", () => {
    expect(userCreateSchema.safeParse(withPhone).success).toBe(true);
  });

  it("accepts a trainee in both branches", () => {
    const both = { ...withPhone, branch_ids: [BRANCH, "7a1b2c3d-4e5f-4a6b-8c9d-0e1f2a3b4c5d"] };

    expect(userCreateSchema.safeParse(both).success).toBe(true);
  });
});
