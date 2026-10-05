import { describe, expect, it } from "vitest";
import type { Profile } from "@/types/database";
import {
  getFieldChanges,
  getUserEditDefaults,
  userEditSchema,
} from "../user-edit";

const PROFILE = {
  id: "11111111-1111-4111-8111-111111111111",
  full_name: "יוסי כהן",
  phone: "972501234567",
  birthdate: "2014-05-03",
  club: null,
  role: "trainee",
  is_active: true,
} as Profile;

/** Every non-admin now needs a branch, so the phone cases carry one. */
const A_BRANCH = "3f5b2c1a-9d4e-4f2b-8a7c-1e2d3f4a5b6c";

describe("userEditSchema phone handling", () => {
  it("shows a stored bare Auth phone as a local phone in form defaults", () => {
    expect(getUserEditDefaults(PROFILE).phone).toBe("0501234567");
  });

  it("accepts every existing stored spelling and returns canonical E.164", () => {
    for (const phone of ["0501234567", "+972501234567", "972501234567"]) {
      const result = userEditSchema.safeParse({
        ...getUserEditDefaults(PROFILE, [A_BRANCH]),
        phone,
      });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.phone).toBe("+972501234567");
    }
  });

  it("does not record a phone change when only the spelling changed", () => {
    const parsed = userEditSchema.parse(getUserEditDefaults(PROFILE, [A_BRANCH]));
    expect(getFieldChanges(PROFILE, parsed).some((change) => change.field === "phone")).toBe(false);
  });
});

describe("userEditSchema branch membership", () => {
  const BRANCH = "3f5b2c1a-9d4e-4f2b-8a7c-1e2d3f4a5b6c";
  const BASE = {
    full_name: "יוסי כהן",
    phone: "0501234567",
    birthdate: "",
    club: "",
    role: "trainee" as const,
    is_active: true,
    branch_ids: [BRANCH],
    managed_branch_ids: [] as string[],
  };

  it("refuses to strip a trainee's last branch", () => {
    const result = userEditSchema.safeParse({ ...BASE, branch_ids: [] });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.branch_ids).toBeDefined();
    }
  });

  it("refuses to strip a trainer's last branch", () => {
    expect(userEditSchema.safeParse({ ...BASE, role: "trainer", branch_ids: [] }).success).toBe(false);
  });

  it("lets an admin have no branch at all", () => {
    expect(userEditSchema.safeParse({ ...BASE, role: "admin", branch_ids: [] }).success).toBe(true);
  });

  it("keeps an ordinary edit working", () => {
    expect(userEditSchema.safeParse(BASE).success).toBe(true);
  });

  it("lets a trainer manage a branch they belong to", () => {
    expect(
      userEditSchema.safeParse({ ...BASE, role: "trainer", managed_branch_ids: [BRANCH] }).success,
    ).toBe(true);
  });

  it("refuses managing a branch the user does not belong to", () => {
    const other = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";
    expect(
      userEditSchema.safeParse({ ...BASE, role: "trainer", managed_branch_ids: [other] }).success,
    ).toBe(false);
  });

  it("refuses a branch manager who is not a trainer", () => {
    expect(userEditSchema.safeParse({ ...BASE, managed_branch_ids: [BRANCH] }).success).toBe(false);
  });

  it("starts the form with the branches the user manages", () => {
    expect(getUserEditDefaults(PROFILE, [BRANCH], [BRANCH]).managed_branch_ids).toEqual([BRANCH]);
    expect(getUserEditDefaults(PROFILE, [BRANCH]).managed_branch_ids).toEqual([]);
  });
});
