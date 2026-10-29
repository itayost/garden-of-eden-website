import { describe, expect, test } from "vitest";
import {
  canDeleteSurvey,
  choosableBranches,
  canEditSurvey,
  canListSurvey,
  canUseSurveys,
  canViewSurvey,
  visibleSurveyBranches,
} from "../permissions";

const KA = "b-ka";
const HAIFA = "b-haifa";

describe("canEditSurvey", () => {
  test("an Admin edits any survey", () => {
    expect(canEditSurvey("admin", [], [KA, HAIFA])).toBe(true);
  });

  test("a manager edits a survey for their branch", () => {
    expect(canEditSurvey("trainer", [KA], [KA])).toBe(true);
  });

  test("a manager cannot edit a survey that also goes to another branch", () => {
    expect(canEditSurvey("trainer", [KA], [KA, HAIFA])).toBe(false);
  });

  test("a trainer who manages nothing cannot edit", () => {
    expect(canEditSurvey("trainer", [], [KA])).toBe(false);
  });

  test("a survey with no branches is Admin-only", () => {
    expect(canEditSurvey("trainer", [KA], [])).toBe(false);
  });

  test("a trainee never edits", () => {
    expect(canEditSurvey("trainee", [KA], [KA])).toBe(false);
  });
});

describe("canViewSurvey", () => {
  test("a manager views a survey that includes their branch", () => {
    expect(canViewSurvey("trainer", [KA], [KA, HAIFA])).toBe(true);
  });

  test("a manager does not view a survey that avoids their branches", () => {
    expect(canViewSurvey("trainer", [KA], [HAIFA])).toBe(false);
  });

  test("an Admin views every survey", () => {
    expect(canViewSurvey("admin", [], [HAIFA])).toBe(true);
  });
});

describe("canListSurvey", () => {
  test("a published survey is listed to anyone who may view it", () => {
    expect(canListSurvey("trainer", [KA], [KA, HAIFA], false)).toBe(true);
    expect(canListSurvey("trainer", [KA], [HAIFA], false)).toBe(false);
    expect(canListSurvey("admin", [], [HAIFA], false)).toBe(true);
  });

  test("a draft is listed only to someone who may edit it", () => {
    expect(canListSurvey("admin", [], [KA, HAIFA], true)).toBe(true);
    expect(canListSurvey("trainer", [KA], [KA], true)).toBe(true);
  });

  test("a manager does not see a draft that also goes to another branch", () => {
    expect(canListSurvey("trainer", [KA], [KA, HAIFA], true)).toBe(false);
  });

  test("a manager does not see a draft that avoids their branches", () => {
    expect(canListSurvey("trainer", [KA], [HAIFA], true)).toBe(false);
  });
});

describe("canDeleteSurvey", () => {
  test("delete: Admin always, manager only before any response", () => {
    expect(canDeleteSurvey("admin", [], [KA], 12)).toBe(true);
    expect(canDeleteSurvey("trainer", [KA], [KA], 0)).toBe(true);
    expect(canDeleteSurvey("trainer", [KA], [KA], 1)).toBe(false);
  });

  test("a manager cannot delete a survey they could not edit", () => {
    expect(canDeleteSurvey("trainer", [KA], [KA, HAIFA], 0)).toBe(false);
  });
});

describe("visibleSurveyBranches", () => {
  test("visible branches: Admin unnarrowed, manager only theirs", () => {
    expect(visibleSurveyBranches("admin", [], [KA, HAIFA])).toBeNull();
    expect(visibleSurveyBranches("trainer", [KA], [KA, HAIFA])).toEqual([KA]);
  });

  test("a manager with no matching branch sees none", () => {
    expect(visibleSurveyBranches("trainer", [KA], [HAIFA])).toEqual([]);
  });
});

describe("canUseSurveys", () => {
  test("who may open the surveys pages", () => {
    expect(canUseSurveys("admin", [])).toBe(true);
    expect(canUseSurveys("trainer", [])).toBe(false);
    expect(canUseSurveys("trainer", [KA])).toBe(true);
  });

  test("a trainee never opens the surveys pages", () => {
    expect(canUseSurveys("trainee", [KA])).toBe(false);
  });
});

describe("choosableBranches", () => {
  const options = [
    { id: KA, nameHe: "קריית אתא" },
    { id: HAIFA, nameHe: "חיפה" },
  ];

  test("an Admin may choose every branch", () => {
    expect(choosableBranches("admin", [], options)).toEqual(options);
  });

  test("a manager may choose only the branches they manage", () => {
    expect(choosableBranches("trainer", [KA], options)).toEqual([options[0]]);
  });

  test("a trainer who manages no listed branch may choose none", () => {
    expect(choosableBranches("trainer", [], options)).toEqual([]);
    expect(choosableBranches("trainer", ["b-other"], options)).toEqual([]);
  });

  test("anyone else may choose none", () => {
    expect(choosableBranches("trainee", [KA], options)).toEqual([]);
  });

  test("does not change the list it was given", () => {
    const given = [...options];
    choosableBranches("trainer", [KA], given);
    expect(given).toEqual(options);
  });
});
