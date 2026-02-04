import type { SleepDataPoint, SleepRange } from "../../types";

interface PreWorkoutFormSleep {
  submitted_at: string;
  sleep_hours: string | null;
}

const MONTH_NAMES_HE = [
  "ינואר",
  "פברואר",
  "מרץ",
  "אפריל",
  "מאי",
  "יוני",
  "יולי",
  "אוגוסט",
  "ספטמבר",
  "אוקטובר",
  "נובמבר",
  "דצמבר",
];

/**
 * Aggregate sleep data by month from pre_workout_forms
 */
export function aggregateSleepDataByMonth(
  forms: PreWorkoutFormSleep[]
): SleepDataPoint[] {
  const monthGroups = new Map<
    string,
    { poor: number; moderate: number; good: number }
  >();

  for (const form of forms) {
    if (!form.sleep_hours) continue;

    const date = new Date(form.submitted_at);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

    if (!monthGroups.has(monthKey)) {
      monthGroups.set(monthKey, { poor: 0, moderate: 0, good: 0 });
    }

    const group = monthGroups.get(monthKey)!;

    switch (form.sleep_hours as SleepRange) {
      case "4-6":
        group.poor++;
        break;
      case "6-8":
        group.moderate++;
        break;
      case "8-11":
        group.good++;
        break;
    }
  }

  return Array.from(monthGroups.entries())
    .map(([month, counts]) => ({
      month,
      monthDisplay: formatMonthHebrew(month),
      poor: counts.poor,
      moderate: counts.moderate,
      good: counts.good,
      total: counts.poor + counts.moderate + counts.good,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

/**
 * Format year-month to Hebrew display
 */
export function formatMonthHebrew(yearMonth: string): string {
  const [year, month] = yearMonth.split("-");
  const monthNum = parseInt(month, 10);
  return `${MONTH_NAMES_HE[monthNum - 1]} ${year}`;
}
