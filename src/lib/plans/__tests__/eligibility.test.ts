import { describe, it, expect } from "vitest";
import { isIntroPackEligible } from "../eligibility";

describe("isIntroPackEligible", () => {
  it("always allows products that are not once-per-trainee", () => {
    expect(isIntroPackEligible({ once_per_trainee: false }, 5)).toBe(true);
  });
  it("allows the intro pack only when nothing was bought before", () => {
    expect(isIntroPackEligible({ once_per_trainee: true }, 0)).toBe(true);
    expect(isIntroPackEligible({ once_per_trainee: true }, 1)).toBe(false);
  });
});
