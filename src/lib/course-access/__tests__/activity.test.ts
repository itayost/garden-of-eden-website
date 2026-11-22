import { describe, expect, test } from "vitest";
import type { PlanQueueView } from "@/features/plans/lib/queries";
import {
  arboxReadProblem,
  isBelievableSweep,
  planActivityStamps,
  queueIsTraining,
  wouldLockAfterSweep,
  type ActivityProfile,
  type SweptTrainee,
} from "../activity";

function view(queue: {
  current: unknown;
  queued: unknown[];
  frozen: unknown;
}): PlanQueueView {
  return { queue } as unknown as PlanQueueView;
}

describe("isBelievableSweep", () => {
  test("refuses an empty Arbox list", () => {
    expect(isBelievableSweep(0, null)).toBe(false);
  });
  test("accepts any non-empty list when there is no earlier good run", () => {
    expect(isBelievableSweep(1, null)).toBe(true);
  });
  test("refuses fewer than half of the last good count", () => {
    expect(isBelievableSweep(249, 500)).toBe(false);
  });
  test("accepts exactly half of the last good count", () => {
    expect(isBelievableSweep(250, 500)).toBe(true);
  });
  test("accepts more than the last good count", () => {
    expect(isBelievableSweep(600, 500)).toBe(true);
  });
});

describe("queueIsTraining", () => {
  test("false without a view", () => {
    expect(queueIsTraining(undefined)).toBe(false);
  });
  test("true with a current Plan", () => {
    expect(queueIsTraining(view({ current: {}, queued: [], frozen: null }))).toBe(true);
  });
  test("true with only queued Plans", () => {
    expect(queueIsTraining(view({ current: null, queued: [{}], frozen: null }))).toBe(true);
  });
  test("true when nothing is ahead but a Freeze holds the Plan", () => {
    expect(queueIsTraining(view({ current: null, queued: [], frozen: {} }))).toBe(true);
  });
  test("false when nothing is ahead and not frozen", () => {
    expect(queueIsTraining(view({ current: null, queued: [], frozen: null }))).toBe(false);
  });
});

describe("planActivityStamps", () => {
  const today = "2026-11-22";
  const base = {
    arboxTrainingIds: new Set<number>([7]),
    planTrainingIds: new Set<string>(["p2"]),
    today,
  };
  const profile = (over: Partial<ActivityProfile> & { id: string }): ActivityProfile => ({
    arboxUserId: null,
    seenOn: null,
    ...over,
  });

  test("stamps a profile whose Arbox id trained", () => {
    expect(planActivityStamps({ ...base, profiles: [profile({ id: "p1", arboxUserId: 7 })] })).toEqual(["p1"]);
  });
  test("stamps a profile with a Plan queue and no Arbox link", () => {
    expect(planActivityStamps({ ...base, profiles: [profile({ id: "p2" })] })).toEqual(["p2"]);
  });
  test("skips a profile in neither set", () => {
    expect(planActivityStamps({ ...base, profiles: [profile({ id: "p3", arboxUserId: 9 })] })).toEqual([]);
  });
  test("skips a profile already stamped today", () => {
    expect(planActivityStamps({ ...base, profiles: [profile({ id: "p2", seenOn: today })] })).toEqual([]);
  });
  test("skips a profile stamped after today by a later run", () => {
    expect(planActivityStamps({ ...base, profiles: [profile({ id: "p2", seenOn: "2026-11-23" })] })).toEqual([]);
  });
  test("stamps a profile last seen earlier", () => {
    expect(planActivityStamps({ ...base, profiles: [profile({ id: "p2", seenOn: "2026-11-01" })] })).toEqual(["p2"]);
  });
});

describe("arboxReadProblem", () => {
  const rows = { memberships: 400, cards: 80, onHold: 5 };
  const problem = (over: Partial<Parameters<typeof arboxReadProblem>[0]>) =>
    arboxReadProblem({ rows, arboxIds: 450, lastGoodArboxIds: null, ...over });

  test("a full read with no earlier sweep is good", () => {
    expect(problem({})).toBeNull();
  });
  test("an empty memberships report is not good, even on the first sweep", () => {
    expect(problem({ rows: { ...rows, memberships: 0 } })).toBe("memberships_report_empty");
  });
  test("an empty cards report is not good", () => {
    expect(problem({ rows: { ...rows, cards: 0 } })).toBe("cards_report_empty");
  });
  test("an empty on-hold report is still good", () => {
    expect(problem({ rows: { ...rows, onHold: 0 } })).toBeNull();
  });
  test("no Arbox ids at all is not good", () => {
    expect(problem({ arboxIds: 0 })).toBe("arbox_rows_too_few");
  });
  test("fewer than half of the last good count is not good", () => {
    expect(problem({ arboxIds: 249, lastGoodArboxIds: 500 })).toBe("arbox_rows_too_few");
  });
  test("half of the last good count is good", () => {
    expect(problem({ arboxIds: 250, lastGoodArboxIds: 500 })).toBeNull();
  });
});

describe("wouldLockAfterSweep", () => {
  const today = "2026-11-22";
  const trainee = (over: Partial<SweptTrainee> & { id: string }): SweptTrainee => ({
    arboxUserId: null,
    seenOn: null,
    accessUntil: null,
    ...over,
  });
  const locked = (profiles: SweptTrainee[], stamped: string[] = []) =>
    wouldLockAfterSweep({ profiles, stampedIds: new Set(stamped), today }).map((p) => p.id);

  test("a trainee stamped by this sweep stays open", () => {
    expect(locked([trainee({ id: "a" })], ["a"])).toEqual([]);
  });
  test("a trainee seen on the first day of the grace period stays open", () => {
    expect(locked([trainee({ id: "a", seenOn: "2026-11-15" })])).toEqual([]);
  });
  test("a trainee seen the day before the grace period is locked", () => {
    expect(locked([trainee({ id: "a", seenOn: "2026-11-14" })])).toEqual(["a"]);
  });
  test("a trainee never seen is locked", () => {
    expect(locked([trainee({ id: "a" })])).toEqual(["a"]);
  });
  test("an admin mark until today keeps an unseen trainee open", () => {
    expect(locked([trainee({ id: "a", accessUntil: today })])).toEqual([]);
  });
  test("an admin mark that ended yesterday does not", () => {
    expect(locked([trainee({ id: "a", accessUntil: "2026-11-21" })])).toEqual(["a"]);
  });
  test("keeps the input order and returns the trainees themselves", () => {
    const b = trainee({ id: "b", arboxUserId: 4 });
    const a = trainee({ id: "a" });
    expect(wouldLockAfterSweep({ profiles: [b, trainee({ id: "c" }), a], stampedIds: new Set(["c"]), today })).toEqual([b, a]);
  });
});
