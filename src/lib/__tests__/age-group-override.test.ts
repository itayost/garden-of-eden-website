import { describe, it, expect } from "vitest";
import { nextBirthday, resolveAgeGroup, isAgeGroupId, isAgeGroupOverrideActive } from "../age-group-override";

describe("nextBirthday", () => {
  it("returns this year's birthday when it is still ahead", () => {
    expect(nextBirthday("2014-02-27", "2026-01-10")).toBe("2026-02-27");
  });

  it("returns next year's birthday when this year's has passed", () => {
    expect(nextBirthday("2014-02-27", "2026-09-30")).toBe("2027-02-27");
  });

  it("returns next year's birthday on the birthday itself", () => {
    expect(nextBirthday("2014-02-27", "2026-02-27")).toBe("2027-02-27");
  });

  it("ends a 29 February birthday on 28 February in a non-leap year", () => {
    expect(nextBirthday("2012-02-29", "2026-09-30")).toBe("2027-02-28");
  });

  it("keeps 29 February in a leap year", () => {
    expect(nextBirthday("2012-02-29", "2027-09-30")).toBe("2028-02-29");
  });
});

describe("resolveAgeGroup", () => {
  // Born 2014-02-27: 12 on 2026-09-30, so U15 by age.
  const yarin = { birthdate: "2014-02-27", age_group_override: null, age_group_override_until: null };
  const overridden = { ...yarin, age_group_override: "u12", age_group_override_until: "2027-02-27" };

  it("uses the birthdate when there is no override", () => {
    expect(resolveAgeGroup(yarin, "2026-09-30")?.id).toBe("u15");
  });

  it("uses the override before its end date", () => {
    expect(resolveAgeGroup(overridden, "2026-09-30")?.id).toBe("u12");
    expect(resolveAgeGroup(overridden, "2027-02-26")?.id).toBe("u12");
  });

  it("goes back to the birthdate group on the end date", () => {
    expect(resolveAgeGroup(overridden, "2027-02-27")?.id).toBe("u15");
  });

  it("applies to an earlier assessment date too", () => {
    expect(resolveAgeGroup(overridden, "2026-03-01")?.id).toBe("u12");
  });

  it("accepts a Date as the as-of date", () => {
    expect(resolveAgeGroup(overridden, new Date(2026, 8, 30))?.id).toBe("u12");
  });

  it("ignores an unknown override value", () => {
    expect(resolveAgeGroup({ ...overridden, age_group_override: "u13" }, "2026-09-30")?.id).toBe("u15");
  });

  it("ignores an override without an end date", () => {
    expect(resolveAgeGroup({ ...overridden, age_group_override_until: null }, "2026-09-30")?.id).toBe("u15");
  });

  it("returns null without a birthdate or override", () => {
    expect(resolveAgeGroup({ ...yarin, birthdate: null }, "2026-09-30")).toBeNull();
  });
});

describe("isAgeGroupId", () => {
  it("accepts the five group ids and nothing else", () => {
    expect(["u10", "u12", "u15", "u18", "senior"].every(isAgeGroupId)).toBe(true);
    expect(isAgeGroupId("u13")).toBe(false);
    expect(isAgeGroupId(null)).toBe(false);
  });
});

describe("isAgeGroupOverrideActive", () => {
  const profile = { birthdate: "2014-02-27", age_group_override: "u12", age_group_override_until: "2027-02-27" };

  it("is active before the end date and not from it on", () => {
    expect(isAgeGroupOverrideActive(profile, "2026-09-30")).toBe(true);
    expect(isAgeGroupOverrideActive(profile, "2027-02-27")).toBe(false);
  });

  it("is not active without an override", () => {
    expect(
      isAgeGroupOverrideActive({ ...profile, age_group_override: null, age_group_override_until: null }, "2026-09-30")
    ).toBe(false);
  });
});
