import { describe, expect, test } from "vitest";
import type { PlanQueueView } from "@/features/plans/lib/queries";
import {
  isBelievableSweep,
  planActivityStamps,
  planQueuesLookUnread,
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

describe("planQueuesLookUnread", () => {
  test("nothing to read is not a failure", () => {
    expect(planQueuesLookUnread(0, 0)).toBe(false);
  });
  test("Plan holders with no queue at all back means the read failed", () => {
    expect(planQueuesLookUnread(300, 0)).toBe(true);
  });
  test("any queue back is a read that worked", () => {
    expect(planQueuesLookUnread(300, 1)).toBe(false);
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
