import { describe, expect, test } from "vitest";
import type { ReportSetting } from "../../audience";
import { buildFactSheet } from "../../fact-sheet/build";
import { emptyWeek, ME, OTHER, WEEK } from "../../fact-sheet/__tests__/fixtures";
import type { BuiltSheet } from "../../fact-sheet/types";
import { classifyTrainee, countRows, weekRows, type TraineeTraining } from "../week-rows";

const KIRYAT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const HAIFA = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const SETTINGS: ReportSetting[] = [
  { branchId: KIRYAT, mode: "approval", birthYears: null, missedYou: true },
  { branchId: HAIFA, mode: "approval", birthYears: null, missedYou: false },
];

function training(overrides: Partial<TraineeTraining> = {}): TraineeTraining {
  return { traineeId: ME, branchIds: [KIRYAT], roster: [], arboxDates: [], freezes: [], ...overrides };
}

/** A counted Roster row on `date`. */
function trained(date: string) {
  return { date, counts: true };
}

describe("classifyTrainee", () => {
  test("a counted Roster row in the week gives a report", () => {
    expect(classifyTrainee(training({ roster: [trained("2026-11-19")] }), WEEK, SETTINGS, false)).toBe("report");
  });

  test("an Arbox entrance alone in the week gives a report", () => {
    expect(classifyTrainee(training({ arboxDates: ["2026-11-15"] }), WEEK, SETTINGS, false)).toBe("report");
  });

  test("a week whose only Roster row is a late cancel gets no report", () => {
    const rows = [{ date: "2026-11-17", counts: true, lateCancel: true }, trained("2026-11-04")];
    expect(classifyTrainee(training({ roster: rows }), WEEK, SETTINGS, false)).toBe("missed_you");
  });

  test("a Roster row that does not count is no training", () => {
    const rows = [{ date: "2026-11-17", counts: false }, trained("2026-11-04")];
    expect(classifyTrainee(training({ roster: rows }), WEEK, SETTINGS, false)).toBe("missed_you");
  });

  test("last trained two weeks back gives התגעגענו where the branch has it on", () => {
    expect(classifyTrainee(training({ roster: [trained("2026-11-04")] }), WEEK, SETTINGS, false)).toBe("missed_you");
  });

  test("a branch with התגעגענו off gives nothing", () => {
    const haifa = training({ branchIds: [HAIFA], roster: [trained("2026-11-04")] });
    expect(classifyTrainee(haifa, WEEK, SETTINGS, false)).toBe("nothing");
  });

  test("a failed Arbox read turns התגעגענו off for everyone", () => {
    expect(classifyTrainee(training({ roster: [trained("2026-11-04")] }), WEEK, SETTINGS, true)).toBe("nothing");
  });

  test("a Freeze on any day of the week gives nothing", () => {
    const frozen = training({
      roster: [trained("2026-11-04")],
      freezes: [{ startsOn: "2026-11-10", endsOn: null, endedOn: null }],
    });
    expect(classifyTrainee(frozen, WEEK, SETTINGS, false)).toBe("nothing");
  });

  test("a Freeze that ended before the week does not stop התגעגענו", () => {
    const thawed = training({
      roster: [trained("2026-11-04")],
      freezes: [{ startsOn: "2026-11-01", endsOn: "2026-11-12", endedOn: null }],
    });
    expect(classifyTrainee(thawed, WEEK, SETTINGS, false)).toBe("missed_you");
  });

  test("last trained four weeks back is listed as absent", () => {
    expect(classifyTrainee(training({ roster: [trained("2026-10-17")] }), WEEK, SETTINGS, false)).toBe("absent");
  });
});

function built(overrides: Parameters<typeof emptyWeek>[0] = {}): BuiltSheet {
  return buildFactSheet(emptyWeek(overrides));
}

describe("weekRows", () => {
  const report = built({
    roster: [
      { date: "2026-11-17", startTime: "17:00", focus: "מהירות", slotId: "slot-1", counts: true, lateCancel: false, trainerFirstNames: [] },
    ],
  });

  test("nothing gives no row", () => {
    expect(weekRows(WEEK, [{ traineeId: ME, branchIds: [KIRYAT], kind: "nothing" }], new Map())).toEqual([]);
  });

  test("התגעגענו goes in approved by the system, with no sheet and no Hold", () => {
    const [row] = weekRows(WEEK, [{ traineeId: ME, branchIds: [KIRYAT, HAIFA], kind: "missed_you" }], new Map());
    expect(row).toEqual({
      traineeId: ME,
      weekStart: WEEK,
      kind: "missed_you",
      status: "approved",
      branchIds: [KIRYAT, HAIFA],
      holdReasons: [],
      factSheet: null,
      approvedAutomatically: true,
    });
  });

  test("absent is listed, never approved", () => {
    const [row] = weekRows(WEEK, [{ traineeId: ME, branchIds: [KIRYAT], kind: "absent" }], new Map());
    expect(row).toMatchObject({ kind: "absent", status: "listed", approvedAutomatically: false, factSheet: null });
  });

  test("a report with no Hold waits for approval and stores the sheet and the body", () => {
    const [row] = weekRows(WEEK, [{ traineeId: ME, branchIds: [KIRYAT], kind: "report" }], new Map([[ME, report]]));
    expect(row).toMatchObject({ kind: "report", status: "pending", holdReasons: [], approvedAutomatically: false });
    expect(row.factSheet).toEqual({ sheet: report.sheet, body: report.body });
  });

  test("a report with a Hold goes in held with its reasons", () => {
    const noGender = built({ profile: { ...emptyWeek().profile, gender: null } });
    const [row] = weekRows(WEEK, [{ traineeId: ME, branchIds: [KIRYAT], kind: "report" }], new Map([[ME, noGender]]));
    expect(row.status).toBe("held");
    expect(row.holdReasons).toEqual(noGender.holds);
  });

  test("a report whose sheet could not be built gives no row", () => {
    expect(weekRows(WEEK, [{ traineeId: OTHER, branchIds: [KIRYAT], kind: "report" }], new Map([[ME, report]]))).toEqual([]);
  });

  test("the input lists are not shared with the rows", () => {
    const branchIds = [KIRYAT];
    const [row] = weekRows(WEEK, [{ traineeId: ME, branchIds, kind: "missed_you" }], new Map());
    expect(row.branchIds).toEqual(branchIds);
    expect(row.branchIds).not.toBe(branchIds);
  });
});

describe("countRows", () => {
  test("counts each kind, and the held reports apart", () => {
    const noGender = built({ profile: { ...emptyWeek().profile, gender: null } });
    const rows = weekRows(
      WEEK,
      [
        { traineeId: ME, branchIds: [KIRYAT], kind: "report" },
        { traineeId: OTHER, branchIds: [KIRYAT], kind: "report" },
        { traineeId: "c", branchIds: [KIRYAT], kind: "missed_you" },
        { traineeId: "d", branchIds: [KIRYAT], kind: "absent" },
        { traineeId: "e", branchIds: [KIRYAT], kind: "nothing" },
      ],
      new Map([
        [ME, built()],
        [OTHER, noGender],
      ]),
    );
    expect(countRows(rows)).toEqual({ reports: 2, held: 1, missedYou: 1, absent: 1 });
  });
});
