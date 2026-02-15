import { describe, it, expect } from "vitest";
import type { PlayerAssessment } from "@/types/assessment";
import {
  getLatestAssessmentPerUser,
  calculateRankings,
  calculateGroupStatistics,
  createDistributionBins,
  calculateMedian,
} from "../lib/utils/ranking-utils";

// Helper to create mock assessment
function createMockAssessment(
  overrides: Partial<PlayerAssessment> & { user_id: string; assessment_date: string }
): PlayerAssessment {
  return {
    id: `assessment-${overrides.user_id}-${overrides.assessment_date}`,
    sprint_5m: null,
    sprint_10m: null,
    sprint_20m: null,
    jump_2leg_distance: null,
    jump_right_leg: null,
    jump_left_leg: null,
    jump_2leg_height: null,
    blaze_spot_time: null,
    flexibility_ankle: null,
    flexibility_knee: null,
    flexibility_hip: null,
    coordination: null,
    leg_power_technique: null,
    body_structure: null,
    kick_power_kaiser: null,
    concentration_notes: null,
    decision_making_notes: null,
    work_ethic_notes: null,
    recovery_notes: null,
    nutrition_notes: null,
    assessed_by: null,
    notes: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("getLatestAssessmentPerUser", () => {
  it("should return the latest assessment for each user", () => {
    const assessments = [
      createMockAssessment({ user_id: "user1", assessment_date: "2024-01-01", sprint_10m: 2.5 }),
      createMockAssessment({ user_id: "user1", assessment_date: "2024-02-01", sprint_10m: 2.3 }),
      createMockAssessment({ user_id: "user2", assessment_date: "2024-01-15", sprint_10m: 2.8 }),
      createMockAssessment({ user_id: "user2", assessment_date: "2024-01-10", sprint_10m: 2.9 }),
    ];

    const result = getLatestAssessmentPerUser(assessments);

    expect(result.size).toBe(2);
    expect(result.get("user1")?.assessment_date).toBe("2024-02-01");
    expect(result.get("user1")?.sprint_10m).toBe(2.3);
    expect(result.get("user2")?.assessment_date).toBe("2024-01-15");
    expect(result.get("user2")?.sprint_10m).toBe(2.8);
  });

  it("should return empty map for empty input", () => {
    const result = getLatestAssessmentPerUser([]);
    expect(result.size).toBe(0);
  });

  it("should handle single assessment per user", () => {
    const assessments = [
      createMockAssessment({ user_id: "user1", assessment_date: "2024-01-01", sprint_10m: 2.5 }),
    ];

    const result = getLatestAssessmentPerUser(assessments);
    expect(result.size).toBe(1);
    expect(result.get("user1")?.sprint_10m).toBe(2.5);
  });
});

describe("calculateRankings", () => {
  const userNames = new Map([
    ["user1", "אלון כהן"],
    ["user2", "יובל לוי"],
    ["user3", "נועם דוד"],
  ]);

  it("should rank players correctly for lower-is-better metrics (sprint)", () => {
    const latestAssessments = new Map([
      ["user1", createMockAssessment({ user_id: "user1", assessment_date: "2024-02-01", sprint_10m: 2.5 })],
      ["user2", createMockAssessment({ user_id: "user2", assessment_date: "2024-02-01", sprint_10m: 2.3 })], // fastest
      ["user3", createMockAssessment({ user_id: "user3", assessment_date: "2024-02-01", sprint_10m: 2.8 })],
    ]);

    const rankings = calculateRankings(latestAssessments, userNames, "sprint_10m", true);

    expect(rankings).toHaveLength(3);
    expect(rankings[0].rank).toBe(1);
    expect(rankings[0].userId).toBe("user2"); // 2.3 is fastest
    expect(rankings[1].rank).toBe(2);
    expect(rankings[1].userId).toBe("user1"); // 2.5 is second
    expect(rankings[2].rank).toBe(3);
    expect(rankings[2].userId).toBe("user3"); // 2.8 is slowest
  });

  it("should rank players correctly for higher-is-better metrics (jump)", () => {
    const latestAssessments = new Map([
      ["user1", createMockAssessment({ user_id: "user1", assessment_date: "2024-02-01", jump_2leg_distance: 180 })],
      ["user2", createMockAssessment({ user_id: "user2", assessment_date: "2024-02-01", jump_2leg_distance: 200 })], // best
      ["user3", createMockAssessment({ user_id: "user3", assessment_date: "2024-02-01", jump_2leg_distance: 160 })],
    ]);

    const rankings = calculateRankings(latestAssessments, userNames, "jump_2leg_distance", false);

    expect(rankings).toHaveLength(3);
    expect(rankings[0].rank).toBe(1);
    expect(rankings[0].userId).toBe("user2"); // 200 is highest
    expect(rankings[1].rank).toBe(2);
    expect(rankings[1].userId).toBe("user1"); // 180 is second
    expect(rankings[2].rank).toBe(3);
    expect(rankings[2].userId).toBe("user3"); // 160 is lowest
  });

  it("should handle ties with same rank", () => {
    const latestAssessments = new Map([
      ["user1", createMockAssessment({ user_id: "user1", assessment_date: "2024-02-01", sprint_10m: 2.5 })],
      ["user2", createMockAssessment({ user_id: "user2", assessment_date: "2024-02-01", sprint_10m: 2.5 })], // tied
      ["user3", createMockAssessment({ user_id: "user3", assessment_date: "2024-02-01", sprint_10m: 2.8 })],
    ]);

    const rankings = calculateRankings(latestAssessments, userNames, "sprint_10m", true);

    expect(rankings[0].rank).toBe(1);
    expect(rankings[1].rank).toBe(1); // same rank for tie
    expect(rankings[2].rank).toBe(3); // skips to 3, not 2
  });

  it("should skip users with null metric values", () => {
    const latestAssessments = new Map([
      ["user1", createMockAssessment({ user_id: "user1", assessment_date: "2024-02-01", sprint_10m: 2.5 })],
      ["user2", createMockAssessment({ user_id: "user2", assessment_date: "2024-02-01", sprint_10m: null })],
      ["user3", createMockAssessment({ user_id: "user3", assessment_date: "2024-02-01", sprint_10m: 2.8 })],
    ]);

    const rankings = calculateRankings(latestAssessments, userNames, "sprint_10m", true);

    expect(rankings).toHaveLength(2);
    expect(rankings.find((r) => r.userId === "user2")).toBeUndefined();
  });

  it("should calculate percentiles correctly", () => {
    const latestAssessments = new Map([
      ["user1", createMockAssessment({ user_id: "user1", assessment_date: "2024-02-01", sprint_10m: 2.0 })],
      ["user2", createMockAssessment({ user_id: "user2", assessment_date: "2024-02-01", sprint_10m: 2.5 })],
      ["user3", createMockAssessment({ user_id: "user3", assessment_date: "2024-02-01", sprint_10m: 3.0 })],
      ["user4", createMockAssessment({ user_id: "user4", assessment_date: "2024-02-01", sprint_10m: 3.5 })],
    ]);

    const userNamesLarge = new Map([
      ["user1", "User 1"],
      ["user2", "User 2"],
      ["user3", "User 3"],
      ["user4", "User 4"],
    ]);

    const rankings = calculateRankings(latestAssessments, userNamesLarge, "sprint_10m", true);

    // Best performer (2.0) should have highest percentile
    expect(rankings[0].percentile).toBe(75); // better than 3 out of 4 = 75%
    expect(rankings[3].percentile).toBe(0); // worst, better than 0
  });
});

describe("calculateGroupStatistics", () => {
  it("should calculate basic statistics correctly", () => {
    const values = [10, 20, 30, 40, 50];
    const stats = calculateGroupStatistics(values);
    expect(stats).not.toBeNull();

    expect(stats!.count).toBe(5);
    expect(stats!.min).toBe(10);
    expect(stats!.max).toBe(50);
    expect(stats!.average).toBe(30);
    expect(stats!.median).toBe(30);
  });

  it("should handle even number of values for median", () => {
    const values = [10, 20, 30, 40];
    const stats = calculateGroupStatistics(values);
    expect(stats).not.toBeNull();

    expect(stats!.median).toBe(25); // (20 + 30) / 2
  });

  it("should handle single value", () => {
    const values = [42];
    const stats = calculateGroupStatistics(values);
    expect(stats).not.toBeNull();

    expect(stats!.count).toBe(1);
    expect(stats!.min).toBe(42);
    expect(stats!.max).toBe(42);
    expect(stats!.average).toBe(42);
    expect(stats!.median).toBe(42);
  });

  it("should return null for empty array", () => {
    const stats = calculateGroupStatistics([]);
    expect(stats).toBeNull();
  });
});

describe("calculateMedian", () => {
  it("should calculate median for odd number of values", () => {
    expect(calculateMedian([1, 3, 5])).toBe(3);
    expect(calculateMedian([1, 2, 3, 4, 5])).toBe(3);
  });

  it("should calculate median for even number of values", () => {
    expect(calculateMedian([1, 2, 3, 4])).toBe(2.5);
    expect(calculateMedian([10, 20])).toBe(15);
  });

  it("should handle unsorted input", () => {
    expect(calculateMedian([5, 1, 3])).toBe(3);
  });

  it("should return 0 for empty array", () => {
    expect(calculateMedian([])).toBe(0);
  });
});

describe("createDistributionBins", () => {
  it("should create correct number of bins", () => {
    const values = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    const bins = createDistributionBins(values, 5);

    expect(bins).toHaveLength(5);
  });

  it("should assign values to correct bins", () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const bins = createDistributionBins(values, 2);

    expect(bins).toHaveLength(2);
    // First bin: 1-5.5 should contain [1,2,3,4,5] = 5 values
    // Second bin: 5.5-10 should contain [6,7,8,9,10] = 5 values
    expect(bins[0].count + bins[1].count).toBe(10);
  });

  it("should create labels for bins", () => {
    const values = [10, 20, 30, 40, 50];
    const bins = createDistributionBins(values, 2);

    expect(bins[0].label).toBeDefined();
    expect(bins[0].label).toContain("-");
  });

  it("should return empty array for empty input", () => {
    const bins = createDistributionBins([], 5);
    expect(bins).toHaveLength(0);
  });

  it("should handle all same values", () => {
    const values = [5, 5, 5, 5, 5];
    const bins = createDistributionBins(values, 3);

    // When all values are same, should have 1 bin with all values
    const totalCount = bins.reduce((sum, bin) => sum + bin.count, 0);
    expect(totalCount).toBe(5);
  });
});
