import type { TraineeReportNotes } from "@/lib/utils/trainee-notes";

export interface ReportBulletItem {
  readonly id: string;
  readonly text: string;
  readonly source: string; // "trainer name - date"
  readonly category: string;
}

interface CategorizedNotes {
  readonly strengths: readonly ReportBulletItem[];
  readonly weaknesses: readonly ReportBulletItem[];
  readonly socialSkills: readonly ReportBulletItem[];
}

const STRENGTH_CATEGORIES = new Set(["achievements", "pro_candidates"]);
const WEAKNESS_CATEGORIES = new Set([
  "limitations",
  "injuries",
  "discipline",
  "mental_state",
  "complaints",
  "insufficient_attention",
  "worked_on",
]);
const SOCIAL_CATEGORIES = new Set(["social_skills"]);

export function categorizeNotes(
  reportNotes: readonly TraineeReportNotes[],
): CategorizedNotes {
  const allItems = reportNotes.flatMap((report) => {
    const source = `${report.trainerName} - ${new Date(report.reportDate).toLocaleDateString("he-IL")}`;

    return report.notes
      .filter((note) => note.details)
      .map((note): ReportBulletItem => ({
        id: `${report.reportId}-${note.type}`,
        text: note.details!,
        source,
        category: note.type,
      }));
  });

  return {
    strengths: allItems.filter((i) => STRENGTH_CATEGORIES.has(i.category)),
    weaknesses: allItems.filter((i) => WEAKNESS_CATEGORIES.has(i.category)),
    socialSkills: allItems.filter((i) => SOCIAL_CATEGORIES.has(i.category)),
  };
}
