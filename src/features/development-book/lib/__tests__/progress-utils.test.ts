import { describe, it, expect } from "vitest";
import { progressPercent, countDoneInParameter } from "../progress-utils";
import type { BookParameterWithChildren } from "../types";

describe("progressPercent", () => {
  it("returns 0 when total is 0", () => { expect(progressPercent(0, 0)).toBe(0); });
  it("rounds to nearest integer", () => { expect(progressPercent(1, 3)).toBe(33); });
  it("returns 100 when all done", () => { expect(progressPercent(4, 4)).toBe(100); });
});

describe("countDoneInParameter", () => {
  const param: BookParameterWithChildren = { drills: [{ id: "a" }, { id: "b" }, { id: "c" }] } as BookParameterWithChildren;
  it("counts done drills via the map", () => {
    expect(countDoneInParameter(param, { a: true, c: true })).toEqual({ done: 2, total: 3 });
  });
});
