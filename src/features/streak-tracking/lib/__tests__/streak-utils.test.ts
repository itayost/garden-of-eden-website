import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  findMilestoneReached,
  wasMilestoneCelebrated,
  markMilestoneCelebrated,
  formatStreakDisplay,
} from "../utils/streak-utils";

import { CELEBRATION_STORAGE_KEY } from "../config/milestones";

const USER_ID = "user-streak-test";
const STORAGE_KEY = `${CELEBRATION_STORAGE_KEY}_${USER_ID}`;

describe("findMilestoneReached", () => {
  it("returns milestone for exact match (7 days)", () => {
    const result = findMilestoneReached(7);
    expect(result).not.toBeNull();
    expect(result!.value).toBe(7);
  });

  it("returns milestone for 30 days", () => {
    const result = findMilestoneReached(30);
    expect(result).not.toBeNull();
    expect(result!.value).toBe(30);
  });

  it("returns milestone for 100 days", () => {
    const result = findMilestoneReached(100);
    expect(result).not.toBeNull();
    expect(result!.value).toBe(100);
  });

  it("returns null for non-milestone streak", () => {
    expect(findMilestoneReached(5)).toBeNull();
    expect(findMilestoneReached(8)).toBeNull();
    expect(findMilestoneReached(50)).toBeNull();
  });

  it("returns null for 0", () => {
    expect(findMilestoneReached(0)).toBeNull();
  });
});

describe("wasMilestoneCelebrated", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    localStorage.clear();
  });

  it("returns false when nothing stored", () => {
    expect(wasMilestoneCelebrated(USER_ID, 7)).toBe(false);
  });

  it("returns false when milestone not in list", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([30]));
    expect(wasMilestoneCelebrated(USER_ID, 7)).toBe(false);
  });

  it("returns true when milestone is in list", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([7, 30]));
    expect(wasMilestoneCelebrated(USER_ID, 7)).toBe(true);
  });

  it("returns false for invalid stored JSON", () => {
    localStorage.setItem(STORAGE_KEY, "not-json");
    expect(wasMilestoneCelebrated(USER_ID, 7)).toBe(false);
  });

  it("returns false for non-array stored data", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify("string-data"));
    expect(wasMilestoneCelebrated(USER_ID, 7)).toBe(false);
  });

  it("filters out non-number items in stored array", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(["seven", null, 7]));
    expect(wasMilestoneCelebrated(USER_ID, 7)).toBe(true);
  });
});

describe("markMilestoneCelebrated", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    localStorage.clear();
  });

  it("creates entry when none exists", () => {
    markMilestoneCelebrated(USER_ID, 7);
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored).toEqual([7]);
  });

  it("appends to existing list", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([7]));
    markMilestoneCelebrated(USER_ID, 30);
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored).toEqual([7, 30]);
  });

  it("does not duplicate if already celebrated", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([7]));
    markMilestoneCelebrated(USER_ID, 7);
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored).toEqual([7]);
  });

  it("handles corrupted stored data gracefully", () => {
    localStorage.setItem(STORAGE_KEY, "{{bad");
    markMilestoneCelebrated(USER_ID, 7);
    // parseCelebratedMilestones returns [] for bad JSON, so [7] is appended
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored).toEqual([7]);
  });
});

describe("formatStreakDisplay", () => {
  it("returns '0' for zero streak", () => {
    expect(formatStreakDisplay(0)).toBe("0");
  });

  it("returns 'יום 1' for single day", () => {
    expect(formatStreakDisplay(1)).toBe("יום 1");
  });

  it("returns plural format for multiple days", () => {
    expect(formatStreakDisplay(5)).toBe("5 ימים");
    expect(formatStreakDisplay(30)).toBe("30 ימים");
    expect(formatStreakDisplay(100)).toBe("100 ימים");
  });
});
