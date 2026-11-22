import { describe, expect, test } from "vitest";
import type { PlanQueueView } from "@/features/plans/lib/queries";
import {
  isBelievableSweep,
  planActivityStamps,
  queueIsTraining,
  type ActivityProfile,
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
