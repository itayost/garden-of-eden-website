import { describe, it, expect } from "vitest";
import {
  MAX_ATTEMPTS,
  MAX_PER_RUN,
  dueAssessments,
  newestByTrainee,
  staleProposals,
  type CheckState,
  type DueRow,
} from "../due";

const TODAY = "2026-11-16";

/** An Assessment dated `date`, last changed that morning unless `changedAt` says otherwise. */
function assessment(id: string, traineeId: string, date: string, changedAt = `${date}T10:00:00Z`): DueRow {
  return { id, traineeId, date, createdAt: `${date}T09:00:00Z`, changedAt };
}

const noChecks = new Map<string, CheckState>();

describe("newestByTrainee", () => {
  it("takes the later date", () => {
    const rows = [
      { id: "a2", traineeId: "t1", date: "2026-11-10", createdAt: "2026-11-01T09:00:00Z" },
      { id: "a1", traineeId: "t1", date: "2026-11-01", createdAt: "2026-11-12T09:00:00Z" },
      { id: "b1", traineeId: "t2", date: "2026-10-01", createdAt: "" },
    ];
    expect(newestByTrainee(rows)).toEqual(
      new Map([
        ["t1", "a2"],
        ["t2", "b1"],
      ]),
    );
  });

  it("on the same date takes the later createdAt, and an empty createdAt loses", () => {
    const rows = [
      { id: "a1", traineeId: "t1", date: "2026-11-10", createdAt: "2026-11-10T12:00:00Z" },
      { id: "a2", traineeId: "t1", date: "2026-11-10", createdAt: "2026-11-10T08:00:00Z" },
      { id: "b1", traineeId: "t2", date: "2026-11-10", createdAt: "" },
      { id: "b2", traineeId: "t2", date: "2026-11-10", createdAt: "2026-11-10T08:00:00Z" },
    ];
    const newest = newestByTrainee(rows);
    expect(newest.get("t1")).toBe("a1");
    expect(newest.get("t2")).toBe("b2");
  });
});

describe("dueAssessments", () => {
  it("offers only the Trainee's newest Assessment, with no check as a first attempt", () => {
    const rows = [assessment("old", "t1", "2026-11-05"), assessment("new", "t1", "2026-11-10")];
    expect(dueAssessments(rows, noChecks, TODAY)).toEqual([
      { id: "new", traineeId: "t1", attempts: 1, previous: null },
    ]);
  });

  it("waits while the newest Assessment changed today, and offers no older one instead", () => {
    const rows = [
      assessment("old", "t1", "2026-11-05"),
      assessment("new", "t1", "2026-11-15", "2026-11-16T05:00:00Z"),
    ];
    expect(dueAssessments(rows, noChecks, TODAY)).toEqual([]);
  });

  it("reads the change on the Israel day", () => {
    const lateLastNight = assessment("a", "t1", "2026-11-15", "2026-11-15T21:30:00Z");
    const afterMidnight = assessment("b", "t2", "2026-11-15", "2026-11-15T22:30:00Z");
    expect(dueAssessments([lateLastNight, afterMidnight], noChecks, TODAY).map((d) => d.id)).toEqual(["a"]);
  });

  it("leaves out an Assessment dated 15 days ago and takes one dated 14", () => {
    const rows = [assessment("a", "t1", "2026-11-01"), assessment("b", "t2", "2026-11-02")];
    expect(dueAssessments(rows, noChecks, TODAY).map((d) => d.id)).toEqual(["b"]);
  });

  it("never offers a proposed check again, even after a change", () => {
    const rows = [assessment("a", "t1", "2026-11-10", "2026-11-14T10:00:00Z")];
    const checks = new Map([["a", { outcome: "proposed", attempts: 1, checkedAt: "2026-11-12T04:15:00Z" }]]);
    expect(dueAssessments(rows, checks, TODAY)).toEqual([]);
  });

  it("retries an unfinished check of an earlier day", () => {
    const rows = [assessment("a", "t1", "2026-11-10")];
    const checks = new Map([["a", { outcome: "unfinished", attempts: 1, checkedAt: "2026-11-15T04:15:00Z" }]]);
    expect(dueAssessments(rows, checks, TODAY)).toEqual([
      {
        id: "a",
        traineeId: "t1",
        attempts: 2,
        previous: { outcome: "unfinished", checkedAt: "2026-11-15T04:15:00Z" },
      },
    ]);
  });

  it("stops after the third attempt", () => {
    const rows = [assessment("a", "t1", "2026-11-10")];
    const checks = new Map([["a", { outcome: "unfinished", attempts: MAX_ATTEMPTS, checkedAt: "2026-11-15T04:15:00Z" }]]);
    expect(dueAssessments(rows, checks, TODAY)).toEqual([]);
  });

  it("tries an unfinished check once a night", () => {
    const rows = [assessment("a", "t1", "2026-11-10")];
    const checks = new Map([["a", { outcome: "unfinished", attempts: 1, checkedAt: "2026-11-16T04:15:00Z" }]]);
    expect(dueAssessments(rows, checks, TODAY)).toEqual([]);
  });

  it("checks again from the start an Assessment changed after it had no candidates or no pick", () => {
    const rows = [assessment("a", "t1", "2026-11-10", "2026-11-14T10:00:00Z")];
    for (const outcome of ["no_candidates", "none_picked"]) {
      const checks = new Map([["a", { outcome, attempts: 2, checkedAt: "2026-11-13T04:15:00Z" }]]);
      expect(dueAssessments(rows, checks, TODAY)).toEqual([
        { id: "a", traineeId: "t1", attempts: 1, previous: { outcome, checkedAt: "2026-11-13T04:15:00Z" } },
      ]);
    }
  });

  it("leaves a no-candidates check that came after the last change", () => {
    const rows = [assessment("a", "t1", "2026-11-10", "2026-11-12T10:00:00Z")];
    const checks = new Map([["a", { outcome: "no_candidates", attempts: 1, checkedAt: "2026-11-13T04:15:00Z" }]]);
    expect(dueAssessments(rows, checks, TODAY)).toEqual([]);
  });

  it("takes the oldest first, at most 40", () => {
    const rows = Array.from({ length: 45 }, (_, i) =>
      assessment(`a${i}`, `t${i}`, i % 2 === 0 ? "2026-11-12" : "2026-11-08"),
    );
    const due = dueAssessments(rows, noChecks, TODAY);
    expect(due).toHaveLength(MAX_PER_RUN);
    expect(due.slice(0, 22).every((item) => Number(item.id.slice(1)) % 2 === 1)).toBe(true);
  });
});

describe("staleProposals", () => {
  const newest = new Map([
    ["t1", "a1"],
    ["t2", "a2-new"],
  ]);
  const base = {
    traineeId: "t1",
    assessmentId: "a1",
    metricKey: "sprint_10m",
    createdAt: "2026-11-10T04:15:00Z",
    assessmentDeleted: false,
  };

  it("expires old, covered, deleted and superseded proposals and keeps a fresh one", () => {
    const open = [
      { ...base, id: "fresh" },
      { ...base, id: "thirty-one-days", createdAt: "2026-10-16T04:15:00Z" },
      { ...base, id: "thirty-days", createdAt: "2026-10-17T04:15:00Z" },
      { ...base, id: "has-goal", metricKey: "jump_2leg_height" },
      { ...base, id: "deleted", metricKey: "sprint_5m", assessmentDeleted: true },
      { ...base, id: "superseded", traineeId: "t2", assessmentId: "a2-old" },
      { ...base, id: "no-live-assessment", traineeId: "t3", assessmentId: "a3" },
    ];
    const openGoals = new Set(["t1:jump_2leg_height", "t2:sprint_5m"]);
    expect(staleProposals(open, openGoals, newest, TODAY)).toEqual([
      "thirty-one-days",
      "has-goal",
      "deleted",
      "superseded",
      "no-live-assessment",
    ]);
  });
});
