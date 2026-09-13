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

describe("userEditSchema phone handling", () => {
  it("shows a stored bare Auth phone as a local phone in form defaults", () => {
    expect(getUserEditDefaults(PROFILE).phone).toBe("0501234567");
  });

  it("accepts every existing stored spelling and returns canonical E.164", () => {
    for (const phone of ["0501234567", "+972501234567", "972501234567"]) {
      const result = userEditSchema.safeParse({
        ...getUserEditDefaults(PROFILE),
        phone,
      });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.phone).toBe("+972501234567");
    }
  });

  it("does not record a phone change when only the spelling changed", () => {
    const parsed = userEditSchema.parse(getUserEditDefaults(PROFILE));
    expect(getFieldChanges(PROFILE, parsed).some((change) => change.field === "phone")).toBe(false);
  });
});
