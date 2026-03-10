import { describe, it, expect } from "vitest";
import { categorizeNotes } from "../aggregate-notes";
import type { TraineeReportNotes } from "@/lib/utils/trainee-notes";

const mockNotes: readonly TraineeReportNotes[] = [
  {
    reportId: "r1",
    reportDate: "2026-01-15",
    trainerName: "Coach A",
    notes: [
      { type: "achievements", label: "הישגים", details: "Great speed improvement", achievementCategories: ["מהירות"] },
      { type: "limitations", label: "מגבלות", details: "Needs flexibility work" },
    ],
  },
  {
    reportId: "r2",
    reportDate: "2026-01-20",
    trainerName: "Coach B",
    notes: [
      { type: "social_skills", label: "כישורים חברתיים", details: "Great team player" },
      { type: "pro_candidates", label: "מועמד למקצוענות", details: "Ready for advanced program" },
    ],
  },
];

describe("categorizeNotes", () => {
  it("separates strengths, weaknesses, and social skills", () => {
    const result = categorizeNotes(mockNotes);

    expect(result.strengths).toHaveLength(2);
    expect(result.strengths[0].text).toContain("Great speed improvement");
    expect(result.strengths[1].text).toContain("Ready for advanced program");

    expect(result.weaknesses).toHaveLength(1);
    expect(result.weaknesses[0].text).toContain("Needs flexibility work");

    expect(result.socialSkills).toHaveLength(1);
    expect(result.socialSkills[0].text).toContain("Great team player");
  });

  it("returns empty arrays for no notes", () => {
    const result = categorizeNotes([]);
    expect(result.strengths).toHaveLength(0);
    expect(result.weaknesses).toHaveLength(0);
    expect(result.socialSkills).toHaveLength(0);
  });

  it("skips notes without details", () => {
    const notesWithoutDetails: readonly TraineeReportNotes[] = [
      {
        reportId: "r3",
        reportDate: "2026-02-01",
        trainerName: "Coach C",
        notes: [
          { type: "achievements", label: "הישגים", details: null },
          { type: "injuries", label: "פציעות", details: "Ankle sprain" },
        ],
      },
    ];
    const result = categorizeNotes(notesWithoutDetails);
    expect(result.strengths).toHaveLength(0);
    expect(result.weaknesses).toHaveLength(1);
    expect(result.weaknesses[0].text).toBe("Ankle sprain");
  });
});
