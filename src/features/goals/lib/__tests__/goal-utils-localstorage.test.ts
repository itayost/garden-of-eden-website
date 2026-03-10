import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { wasGoalCelebrated, markGoalCelebrated } from "../utils/goal-utils";

import { GOAL_CELEBRATION_STORAGE_KEY } from "../config/goal-config";

const USER_ID = "user-123";
const GOAL_ID = "goal-abc";
const STORAGE_KEY = `${GOAL_CELEBRATION_STORAGE_KEY}_${USER_ID}`;

describe("wasGoalCelebrated", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    localStorage.clear();
  });

  it("returns false when nothing stored", () => {
    expect(wasGoalCelebrated(USER_ID, GOAL_ID)).toBe(false);
  });

  it("returns false when goal not in list", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(["other-goal"]));
    expect(wasGoalCelebrated(USER_ID, GOAL_ID)).toBe(false);
  });

  it("returns true when goal is in list", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([GOAL_ID]));
    expect(wasGoalCelebrated(USER_ID, GOAL_ID)).toBe(true);
  });

  it("returns false when stored data is not an array", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify("not-an-array"));
    expect(wasGoalCelebrated(USER_ID, GOAL_ID)).toBe(false);
  });

  it("returns false when stored data is invalid JSON", () => {
    localStorage.setItem(STORAGE_KEY, "{{invalid");
    expect(wasGoalCelebrated(USER_ID, GOAL_ID)).toBe(false);
  });
});

describe("markGoalCelebrated", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    localStorage.clear();
  });

  it("creates entry when none exists", () => {
    markGoalCelebrated(USER_ID, GOAL_ID);
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored).toEqual([GOAL_ID]);
  });

  it("appends to existing list", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(["existing-goal"]));
    markGoalCelebrated(USER_ID, GOAL_ID);
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored).toEqual(["existing-goal", GOAL_ID]);
  });

  it("does not duplicate if already celebrated", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([GOAL_ID]));
    markGoalCelebrated(USER_ID, GOAL_ID);
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored).toEqual([GOAL_ID]);
  });

  it("resets to single-item array when stored data is not an array", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify("bad-data"));
    markGoalCelebrated(USER_ID, GOAL_ID);
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored).toEqual([GOAL_ID]);
  });

  it("trims to last 100 entries when exceeding max", () => {
    const ids = Array.from({ length: 100 }, (_, i) => `goal-${i}`);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    markGoalCelebrated(USER_ID, "goal-new");
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored).toHaveLength(100);
    expect(stored[stored.length - 1]).toBe("goal-new");
    expect(stored[0]).toBe("goal-1"); // goal-0 was trimmed
  });
});
