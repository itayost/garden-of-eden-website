import { describe, expect, test } from "vitest";
import type { AudienceCandidate } from "@/features/surveys/lib/audience";
import {
  type FreezeSpan,
  type ReportSetting,
  classifyWeek,
  freezeTouchesWeek,
  missedYouAllowed,
  reportBranches,
  trainingDays,
} from "../audience";

const kid = (over: Partial<AudienceCandidate> = {}): AudienceCandidate => ({
  profileId: "p1",
  fullName: "יונתן לוי",
  role: "trainee",
  isActive: true,
  deletedAt: null,
  birthdate: "2014-03-02",
  accessTier: "full",
  branchIds: ["b-ka"],
  ...over,
});

const setting = (over: Partial<ReportSetting> = {}): ReportSetting => ({
  branchId: "b-ka",
  mode: "approval",
  birthYears: null,
  missedYou: true,
  ...over,
});

describe("reportBranches", () => {
  test("a branch that is off gives no report", () => {
    expect(reportBranches(kid(), [setting({ mode: "off" })])).toEqual([]);
  });

  test("a birth year outside the list is left out", () => {
    expect(reportBranches(kid(), [setting({ birthYears: [2012, 2013] })])).toEqual([]);
  });

  test("a birth year in the list is in", () => {
    expect(reportBranches(kid(), [setting({ birthYears: [2014] })])).toEqual(["b-ka"]);
  });

  test("a list of null takes every year", () => {
    expect(reportBranches(kid({ birthdate: "2009-01-01" }), [setting()])).toEqual(["b-ka"]);
  });

  test("course-only, inactive, deleted and staff are left out", () => {
    const settings = [setting()];
    expect(reportBranches(kid({ accessTier: "course_only" }), settings)).toEqual([]);
    expect(reportBranches(kid({ isActive: false }), settings)).toEqual([]);
    expect(reportBranches(kid({ deletedAt: "2026-01-01T00:00:00Z" }), settings)).toEqual([]);
    expect(reportBranches(kid({ role: "trainer" }), settings)).toEqual([]);
  });

  test("a branch the trainee is not in is left out", () => {
    expect(reportBranches(kid(), [setting({ branchId: "b-haifa" })])).toEqual([]);
  });

  test("two approval branches give both ids", () => {
    const both = kid({ branchIds: ["b-ka", "b-haifa"] });
    const settings = [setting(), setting({ branchId: "b-haifa" })];
    expect(reportBranches(both, settings)).toEqual(["b-ka", "b-haifa"]);
  });

  test("automatic counts as taking part", () => {
    expect(reportBranches(kid(), [setting({ mode: "automatic" })])).toEqual(["b-ka"]);
  });

  test("each branch applies its own birth years", () => {
    const both = kid({ branchIds: ["b-ka", "b-haifa"] });
    const settings = [setting({ birthYears: [2012] }), setting({ branchId: "b-haifa" })];
    expect(reportBranches(both, settings)).toEqual(["b-haifa"]);
  });
});

describe("trainingDays", () => {
  test("a late cancel is not a day trained, though it is charged", () => {
    const roster = [
      { date: "2026-11-15", counts: true, lateCancel: true },
      { date: "2026-11-16", counts: true, lateCancel: false },
    ];
    expect(trainingDays(roster, [])).toEqual(["2026-11-16"]);
  });

  test("drops rows that do not count", () => {
    const roster = [
      { date: "2026-11-15", counts: true },
      { date: "2026-11-17", counts: false },
    ];
    expect(trainingDays(roster, [])).toEqual(["2026-11-15"]);
  });

  test("a Roster day and an Arbox entrance on the same date count once", () => {
    const roster = [{ date: "2026-11-17", counts: true }];
    expect(trainingDays(roster, ["2026-11-17", "2026-11-14"])).toEqual([
      "2026-11-14",
      "2026-11-17",
    ]);
  });

  test("two rows on one day count once, sorted", () => {
    const roster = [
      { date: "2026-11-18", counts: true },
      { date: "2026-11-13", counts: true },
      { date: "2026-11-18", counts: true },
    ];
    expect(trainingDays(roster, [])).toEqual(["2026-11-13", "2026-11-18"]);
  });

  test("no rows and no entrances give no days", () => {
    expect(trainingDays([], [])).toEqual([]);
  });
});

describe("freezeTouchesWeek", () => {
  const WEEK = "2026-11-13";
  const freeze = (over: Partial<FreezeSpan> = {}): FreezeSpan => ({
    startsOn: "2026-11-01",
    endsOn: null,
    endedOn: null,
    ...over,
  });

  test("a Freeze that ended the Thursday before does not touch it", () => {
    expect(freezeTouchesWeek(freeze({ endsOn: "2026-11-12" }), WEEK)).toBe(false);
  });

  test("a Freeze that ends on the Friday touches it", () => {
    expect(freezeTouchesWeek(freeze({ endsOn: "2026-11-13" }), WEEK)).toBe(true);
  });

  test("a Freeze that starts on the Thursday touches it", () => {
    expect(freezeTouchesWeek(freeze({ startsOn: "2026-11-19" }), WEEK)).toBe(true);
  });

  test("a Freeze that starts after the week does not touch it", () => {
    expect(freezeTouchesWeek(freeze({ startsOn: "2026-11-20" }), WEEK)).toBe(false);
  });

  test("an open-ended Freeze started earlier touches it", () => {
    expect(freezeTouchesWeek(freeze(), WEEK)).toBe(true);
  });

  test("a Freeze ended early on the Wednesday before does not touch it", () => {
    const ended = freeze({ endsOn: "2026-12-01", endedOn: "2026-11-11" });
    expect(freezeTouchesWeek(ended, WEEK)).toBe(false);
  });

  test("a Freeze ended early inside the week touches it", () => {
    const ended = freeze({ endsOn: "2026-12-01", endedOn: "2026-11-15" });
    expect(freezeTouchesWeek(ended, WEEK)).toBe(true);
  });
});

describe("classifyWeek", () => {
  const WEEK = "2026-11-13";
  const week = (days: string[], over: { frozen?: boolean; missedYouOn?: boolean } = {}) =>
    classifyWeek({ weekStart: WEEK, days, frozen: false, missedYouOn: true, ...over });

  test("trained on the Thursday gives a report", () => {
    expect(week(["2026-11-19"])).toBe("report");
  });

  test("trained on the Friday the week starts gives a report", () => {
    expect(week(["2026-10-01", "2026-11-13"])).toBe("report");
  });

  test("last trained 1, 2 and 3 weeks back gives missed you", () => {
    expect(week(["2026-11-12"])).toBe("missed_you");
    expect(week(["2026-10-30"])).toBe("missed_you");
    expect(week(["2026-10-23"])).toBe("missed_you");
  });

  test("the latest earlier day decides", () => {
    expect(week(["2026-09-01", "2026-11-06"])).toBe("missed_you");
  });

  test("last trained 4 weeks back gives absent", () => {
    expect(week(["2026-10-16"])).toBe("absent");
    expect(week(["2026-10-22"])).toBe("absent");
  });

  test("last trained 5 weeks back gives nothing", () => {
    expect(week(["2026-10-15"])).toBe("nothing");
  });

  test("frozen gives nothing", () => {
    expect(week(["2026-11-06"], { frozen: true })).toBe("nothing");
  });

  test("missed you off gives nothing even at 2 weeks", () => {
    expect(week(["2026-10-30"], { missedYouOn: false })).toBe("nothing");
  });

  test("never trained gives nothing", () => {
    expect(week([])).toBe("nothing");
  });

  test("a day after the week is not an earlier day", () => {
    expect(week(["2026-11-20"])).toBe("nothing");
  });
});

describe("missedYouAllowed", () => {
  const settings = [setting({ missedYou: false }), setting({ branchId: "b-haifa" })];

  test("false when the Arbox read failed", () => {
    expect(missedYouAllowed(["b-ka", "b-haifa"], settings, true)).toBe(false);
  });

  test("true when one of two branches has it on", () => {
    expect(missedYouAllowed(["b-ka", "b-haifa"], settings, false)).toBe(true);
  });

  test("false when none of the trainee's branches has it on", () => {
    expect(missedYouAllowed(["b-ka"], settings, false)).toBe(false);
  });

  test("false with no report branches", () => {
    expect(missedYouAllowed([], settings, false)).toBe(false);
  });
});
