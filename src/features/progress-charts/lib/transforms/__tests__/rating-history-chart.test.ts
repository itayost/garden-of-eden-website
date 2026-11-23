import { describe, it, expect } from "vitest";
import { ratingHistoryToChartData } from "../index";

describe("ratingHistoryToChartData", () => {
  it("maps each snapshot to a chart point whose value is the overall rating", () => {
    const [point] = ratingHistoryToChartData([
      {
        date: "2026-03-01",
        pace: 70,
        shooting: 65,
        passing: 68,
        dribbling: 71,
        defending: 50,
        physical: 66,
        overall_rating: 67,
      },
    ]);
    expect(point).toMatchObject({
      date: "2026-03-01",
      value: 67,
      pace: 70,
      shooting: 65,
      passing: 68,
      dribbling: 71,
      defending: 50,
      physical: 66,
      overall_rating: 67,
    });
    expect(typeof point.dateDisplay).toBe("string");
  });

  it("returns an empty list for no snapshots", () => {
    expect(ratingHistoryToChartData([])).toEqual([]);
  });
});
