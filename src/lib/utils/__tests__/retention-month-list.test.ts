import { describe, it, expect } from "vitest";
import {
  buildRetentionMonthOptions,
  type RetentionMonthOption,
} from "../retention-month-list";

const makeMonth = (
  report_month: string,
  created_at: string | null = "2026-04-01T04:00:00Z",
): RetentionMonthOption => ({ report_month, created_at });

describe("buildRetentionMonthOptions", () => {
  it("returns the list unchanged when current month is already present", () => {
    const months = [
      makeMonth("2026-05-01"),
      makeMonth("2026-04-01"),
      makeMonth("2026-03-01"),
    ];

    const result = buildRetentionMonthOptions(months, "2026-05-01");

    expect(result).toBe(months);
  });

  it("prepends the current month when it is missing and newer than every existing month", () => {
    const months = [makeMonth("2026-04-01"), makeMonth("2026-03-01")];

    const result = buildRetentionMonthOptions(months, "2026-05-01");

    expect(result).toEqual([
      { report_month: "2026-05-01", created_at: null },
      { report_month: "2026-04-01", created_at: "2026-04-01T04:00:00Z" },
      { report_month: "2026-03-01", created_at: "2026-04-01T04:00:00Z" },
    ]);
  });

  it("inserts the current month in the correct descending position when a future month already exists", () => {
    const months = [
      makeMonth("2026-06-01"),
      makeMonth("2026-04-01"),
      makeMonth("2026-03-01"),
    ];

    const result = buildRetentionMonthOptions(months, "2026-05-01");

    expect(result.map((m) => m.report_month)).toEqual([
      "2026-06-01",
      "2026-05-01",
      "2026-04-01",
      "2026-03-01",
    ]);
    expect(result[1]?.created_at).toBeNull();
  });

  it("returns a single synthesized entry when the input list is empty", () => {
    const result = buildRetentionMonthOptions([], "2026-05-01");

    expect(result).toEqual([
      { report_month: "2026-05-01", created_at: null },
    ]);
  });

  it("appends the current month when every existing month is newer", () => {
    const months = [makeMonth("2026-07-01"), makeMonth("2026-06-01")];

    const result = buildRetentionMonthOptions(months, "2026-05-01");

    expect(result.map((m) => m.report_month)).toEqual([
      "2026-07-01",
      "2026-06-01",
      "2026-05-01",
    ]);
  });

  it("is idempotent: running twice produces the same list", () => {
    const months = [makeMonth("2026-04-01"), makeMonth("2026-03-01")];

    const once = buildRetentionMonthOptions(months, "2026-05-01");
    const twice = buildRetentionMonthOptions(once, "2026-05-01");

    expect(twice).toBe(once);
  });
});
