import { describe, expect, it } from "vitest";
import { normalizePhoneIL } from "@/lib/validations/common";
import type { RetentionEntry, RetentionReportData } from "../retention";
import {
  branchAttendance,
  calendarMonthCounts,
  calendarRetentionCategory,
  withBranchAttendance,
  type CalendarPlanEnd,
  type RetentionProfile,
} from "../retention-branches";

const MONTHS = ["2026-10", "2026-09", "2026-08", "2026-07"] as const;

const entry = (overrides: Partial<RetentionEntry>): RetentionEntry => ({
  user_id: null,
  name: "שחקן",
  phone: null,
  end_date: "2026-10-20",
  membership_type_name: "מנוי מתקדמים",
  attendance: [null, null, null, null],
  ...overrides,
});

const profile = (overrides: Partial<RetentionProfile>): RetentionProfile => ({
  id: "p1",
  phone: null,
  arboxUserId: null,
  haifa: false,
  kiryat: false,
  ...overrides,
});

const report = (monthly: RetentionEntry[], extra: Partial<RetentionReportData> = {}): RetentionReportData => ({
  monthly,
  pro: [],
  training_card: [],
  ...extra,
});

describe("calendarMonthCounts", () => {
  it("counts each trainee's sessions per report month, newest month first", () => {
    const counts = calendarMonthCounts(
      [
        { traineeId: "a", date: "2026-10-02" },
        { traineeId: "a", date: "2026-10-09" },
        { traineeId: "a", date: "2026-08-30" },
        { traineeId: "b", date: "2026-09-01" },
        { traineeId: "b", date: "2026-03-01" },
      ],
      MONTHS,
    );
    expect(counts.get("a")).toEqual([2, 0, 1, 0]);
    expect(counts.get("b")).toEqual([0, 1, 0, 0]);
  });
});

describe("branchAttendance", () => {
  it("shows 0 where the player is assigned and nothing happened, a dash elsewhere", () => {
    expect(branchAttendance([3, null, null, null], undefined, { haifa: true, kiryat: false }, 4)).toEqual({
      haifa: [3, 0, 0, 0],
      kiryat: [null, null, null, null],
    });
    expect(branchAttendance([null, null, null, null], [0, 2, 0, 0], { haifa: false, kiryat: true }, 4)).toEqual({
      haifa: [null, null, null, null],
      kiryat: [0, 2, 0, 0],
    });
  });

  it("shows sessions at a branch the player is not assigned to", () => {
    expect(branchAttendance([null, 1, null, null], [2, 0, 0, 0], { haifa: false, kiryat: false }, 4)).toEqual({
      haifa: [null, 1, null, null],
      kiryat: [2, null, null, null],
    });
  });
});

describe("calendarRetentionCategory", () => {
  it("follows the Arbox naming first, then the queue's kind", () => {
    expect(calendarRetentionCategory("מנוי פרו", false)).toBe("pro");
    expect(calendarRetentionCategory("כרטיסיית 10", false)).toBe("training_card");
    expect(calendarRetentionCategory("מנוי חודשי", true)).toBe("training_card");
    expect(calendarRetentionCategory("מנוי חודשי", false)).toBe("monthly");
  });
});

describe("withBranchAttendance", () => {
  const calendarEnd = (overrides: Partial<CalendarPlanEnd>): CalendarPlanEnd => ({
    profileId: "k1",
    name: "ילד קריות",
    phone: "0501111111",
    endsOn: "2026-10-25",
    planName: "מנוי חודשי",
    cardsOnly: false,
    ...overrides,
  });

  it("matches an Arbox row to its profile by Arbox id, then by phone", () => {
    const view = withBranchAttendance(
      report([entry({ user_id: 7, attendance: [1, null, null, null] }), entry({ phone: "050-222-2222" })]),
      {
        monthKeys: MONTHS,
        profiles: [
          profile({ id: "a", arboxUserId: 7, haifa: true }),
          profile({ id: "b", phone: normalizePhoneIL("0502222222"), kiryat: true }),
        ],
        calendarCounts: new Map([["b", [4, 0, 0, 0]]]),
        calendarPlanEnds: [],
        reportMonth: "2026-10-01",
      },
    );
    expect(view.monthly[0].branch_attendance).toEqual({ haifa: [1, 0, 0, 0], kiryat: [null, null, null, null] });
    expect(view.monthly[1].branch_attendance).toEqual({ haifa: [null, null, null, null], kiryat: [4, 0, 0, 0] });
    expect(view.monthly.every((e) => e.source === "arbox")).toBe(true);
  });

  it("adds a Kiryat Ata trainee whose plan ends this month, even with no sessions", () => {
    const view = withBranchAttendance(report([]), {
      monthKeys: MONTHS,
      profiles: [profile({ id: "k1", phone: "0501111111", kiryat: true })],
      calendarCounts: new Map(),
      calendarPlanEnds: [calendarEnd({})],
      reportMonth: "2026-10-01",
    });
    expect(view.monthly).toHaveLength(1);
    expect(view.monthly[0]).toMatchObject({
      name: "ילד קריות",
      phone: "0501111111",
      end_date: "2026-10-25",
      membership_type_name: "מנוי חודשי",
      source: "calendar",
      branch_attendance: { haifa: [null, null, null, null], kiryat: [0, 0, 0, 0] },
    });
  });

  it("skips a plan ending in another month and a trainee already in the Arbox list", () => {
    const view = withBranchAttendance(report([entry({ user_id: 9 })]), {
      monthKeys: MONTHS,
      profiles: [profile({ id: "k1", arboxUserId: 9, kiryat: true }), profile({ id: "k2", kiryat: true })],
      calendarCounts: new Map(),
      calendarPlanEnds: [calendarEnd({ profileId: "k1" }), calendarEnd({ profileId: "k2", endsOn: "2026-11-02" })],
      reportMonth: "2026-10-01",
    });
    expect(view.monthly).toHaveLength(1);
    expect(view.monthly[0].source).toBe("arbox");
  });

  it("files a card queue under the card tab and keeps each tab newest end first", () => {
    const view = withBranchAttendance(report([], { training_card: [entry({ end_date: "2026-10-10" })] }), {
      monthKeys: MONTHS,
      profiles: [],
      calendarCounts: new Map(),
      calendarPlanEnds: [calendarEnd({ cardsOnly: true, planName: "כרטיסייה ידנית", endsOn: "2026-10-28" })],
      reportMonth: "2026-10-01",
    });
    expect(view.training_card.map((e) => e.end_date)).toEqual(["2026-10-28", "2026-10-10"]);
  });
});
