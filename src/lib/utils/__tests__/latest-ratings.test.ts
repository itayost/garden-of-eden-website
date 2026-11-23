import { describe, it, expect } from "vitest";
import { latestRatings, type RatingHistoryRow } from "../get-player-ratings";

function row(date: string, overall: number | null): RatingHistoryRow {
  return {
    date,
    pace: overall,
    shooting: overall,
    passing: overall,
    dribbling: overall,
    defending: overall,
    physical: overall,
    overall_rating: overall,
  };
}

describe("latestRatings", () => {
  it("returns neutral ratings for an empty history", () => {
    expect(latestRatings([])).toEqual({
      pace: null,
      shooting: null,
      passing: null,
      dribbling: null,
      defending: null,
      physical: null,
      overall_rating: null,
    });
  });

  it("returns the last row of a date-ascending history, without the date", () => {
    const history = [row("2026-01-01", 60), row("2026-03-01", 72)];
    expect(latestRatings(history)).toEqual({
      pace: 72,
      shooting: 72,
      passing: 72,
      dribbling: 72,
      defending: 72,
      physical: 72,
      overall_rating: 72,
    });
  });
});
