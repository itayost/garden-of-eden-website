import { describe, expect, test } from "vitest";

import { isSharedAccount, SHARED_ACCOUNT_HOLD } from "../shared-account";

describe("isSharedAccount", () => {
  test("two names joined by a plus are one account for two children", () => {
    expect(isSharedAccount("ינאל אנעים + מוחמד")).toBe(true);
    expect(isSharedAccount("מוחמד + אדם אחסאן")).toBe(true);
    expect(isSharedAccount("דני+יוסי כהן")).toBe(true);
  });

  test("one child's name is not, whatever else it carries", () => {
    expect(isSharedAccount("ג'וליאן בולוס (קריות)")).toBe(false);
    expect(isSharedAccount("עדי גדז׳")).toBe(false);
    expect(isSharedAccount("רז יחיאל ")).toBe(false);
  });

  test("a plus with no name on one side is not two children", () => {
    expect(isSharedAccount("+ יוסי")).toBe(false);
    expect(isSharedAccount("יוסי +")).toBe(false);
    expect(isSharedAccount("+")).toBe(false);
  });

  test("no name is not a shared account", () => {
    expect(isSharedAccount(null)).toBe(false);
    expect(isSharedAccount("")).toBe(false);
  });
});

describe("SHARED_ACCOUNT_HOLD", () => {
  test("is a manual Hold, so a person must open the report, and says why", () => {
    expect(SHARED_ACCOUNT_HOLD.code).toBe("manual");
    expect(SHARED_ACCOUNT_HOLD.text).toContain("שני ילדים");
  });
});
