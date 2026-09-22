import { describe, expect, test } from "vitest";

import { pickOpenSession, sortTodaySessions } from "../open-session";

const MORNING = { id: "s-morning", startTime: "09:00", exerciseIds: ["e1", "e2"] };
const EVENING = { id: "s-evening", startTime: "19:00", exerciseIds: ["e3"] };
const SLOTLESS = { id: "s-none", startTime: null, exerciseIds: ["e4"] };

const at = (hours: number) => hours * 60;

describe("sortTodaySessions", () => {
  test("orders by start time and puts a session with no slot last", () => {
    const sorted = sortTodaySessions([SLOTLESS, EVENING, MORNING]);
    expect(sorted.map((s) => s.id)).toEqual(["s-morning", "s-evening", "s-none"]);
  });

  test("leaves a single session alone", () => {
    expect(sortTodaySessions([EVENING]).map((s) => s.id)).toEqual(["s-evening"]);
  });

  test("does not mutate the input", () => {
    const input = [EVENING, MORNING];
    sortTodaySessions(input);
    expect(input.map((s) => s.id)).toEqual(["s-evening", "s-morning"]);
  });
});

describe("pickOpenSession", () => {
  test("returns null for no sessions", () => {
    expect(pickOpenSession([], at(12), null)).toBeNull();
  });

  test("before the first hour, opens the earliest", () => {
    expect(pickOpenSession([MORNING, EVENING], at(7), null)).toBe("s-morning");
  });

  test("between the two hours, opens the one that already started", () => {
    expect(pickOpenSession([MORNING, EVENING], at(12), null)).toBe("s-morning");
  });

  test("after the last hour, opens the last one that started", () => {
    expect(pickOpenSession([MORNING, EVENING], at(22), null)).toBe("s-evening");
  });

  test("exactly at the start time counts as started", () => {
    expect(pickOpenSession([MORNING, EVENING], at(19), null)).toBe("s-evening");
  });

  test("a session with no slot is opened only when it is the only one", () => {
    expect(pickOpenSession([SLOTLESS], at(12), null)).toBe("s-none");
    expect(pickOpenSession([MORNING, SLOTLESS], at(12), null)).toBe("s-morning");
  });

  test("a scanned exercise wins over the clock", () => {
    expect(pickOpenSession([MORNING, EVENING], at(9), "e3")).toBe("s-evening");
  });

  test("a focus id that matches nothing falls back to the clock", () => {
    expect(pickOpenSession([MORNING, EVENING], at(9), "missing")).toBe("s-morning");
  });
});
