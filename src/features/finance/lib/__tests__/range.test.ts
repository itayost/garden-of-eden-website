import { describe, expect, test } from "vitest";
import { parseBranchParam, parseRange, stripStart } from "../range";

const TODAY = "2026-10-12";

describe("parseRange", () => {
  test("no params is today", () => {
    expect(parseRange({}, TODAY)).toEqual({ from: TODAY, to: TODAY, preset: "day", clipped: false });
  });
  test("week is the last seven days including today", () => {
    expect(parseRange({ range: "week" }, TODAY)).toEqual({ from: "2026-10-06", to: TODAY, preset: "week", clipped: false });
  });
  test("month runs from the first of this month", () => {
    expect(parseRange({ range: "month" }, TODAY)).toEqual({ from: "2026-10-01", to: TODAY, preset: "month", clipped: false });
  });
  test("a custom range is kept", () => {
    expect(parseRange({ range: "custom", from: "2026-09-01", to: "2026-09-30" }, TODAY)).toEqual({
      from: "2026-09-01",
      to: "2026-09-30",
      preset: "custom",
      clipped: false,
    });
  });
  test("malformed or impossible dates fall back to today", () => {
    expect(parseRange({ range: "custom", from: "2026-02-30", to: "2026-03-01" }, TODAY).preset).toBe("day");
    expect(parseRange({ range: "custom", from: "yesterday", to: TODAY }, TODAY).preset).toBe("day");
    expect(parseRange({ range: "custom", from: "2026-13-01", to: TODAY }, TODAY)).toEqual({
      from: TODAY,
      to: TODAY,
      preset: "day",
      clipped: false,
    });
    expect(parseRange({ range: "custom" }, TODAY).preset).toBe("day");
  });
  test("a reversed range falls back to today", () => {
    expect(parseRange({ range: "custom", from: "2026-10-10", to: "2026-10-01" }, TODAY).preset).toBe("day");
  });
  test("a future end is cut to today; a wholly future range falls back to today", () => {
    expect(parseRange({ range: "custom", from: "2026-10-01", to: "2026-12-01" }, TODAY).to).toBe(TODAY);
    expect(parseRange({ range: "custom", from: "2026-11-01", to: "2026-12-01" }, TODAY).preset).toBe("day");
  });
  test("a range over 93 days keeps its last 93 and says so", () => {
    const range = parseRange({ range: "custom", from: "2026-01-01", to: "2026-10-12" }, TODAY);
    expect(range).toEqual({ from: "2026-07-12", to: TODAY, preset: "custom", clipped: true });
  });
  test("an unknown preset is today", () => {
    expect(parseRange({ range: "year" }, TODAY).preset).toBe("day");
  });
});

describe("stripStart", () => {
  test("a single day shows six days of context", () => {
    expect(stripStart({ from: TODAY, to: TODAY })).toBe("2026-10-07");
  });
  test("a longer range starts the strip at its own start", () => {
    expect(stripStart({ from: "2026-10-01", to: TODAY })).toBe("2026-10-01");
  });
});

describe("parseBranchParam", () => {
  const allowed = ["ka-id"];
  test("an allowed branch id is kept", () => {
    expect(parseBranchParam("ka-id", allowed)).toBe("ka-id");
  });
  test("a missing, unknown or hand-typed value means all branches", () => {
    expect(parseBranchParam(undefined, allowed)).toBeNull();
    expect(parseBranchParam("haifa-id", allowed)).toBeNull();
    expect(parseBranchParam("'; drop table", allowed)).toBeNull();
  });
});
