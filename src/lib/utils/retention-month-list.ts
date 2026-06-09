export interface RetentionMonthOption {
  readonly report_month: string;
  readonly created_at: string | null;
}

/**
 * Current calendar month as a report-month key ("YYYY-MM-01").
 * Report months are immutable snapshots once they pass; a month strictly
 * earlier than this value must never be rebuilt/overwritten.
 */
export function getCurrentCalendarMonth(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

/** Whether reportMonth is strictly before the current calendar month (frozen). */
export function isPastReportMonth(
  reportMonth: string,
  now: Date = new Date(),
): boolean {
  return reportMonth < getCurrentCalendarMonth(now);
}

export function buildRetentionMonthOptions(
  months: readonly RetentionMonthOption[],
  currentCalendarMonth: string,
): readonly RetentionMonthOption[] {
  if (months.some((m) => m.report_month === currentCalendarMonth)) {
    return months;
  }

  const synthesized: RetentionMonthOption = {
    report_month: currentCalendarMonth,
    created_at: null,
  };

  const insertIndex = months.findIndex(
    (m) => m.report_month < currentCalendarMonth,
  );

  if (insertIndex === -1) {
    return [...months, synthesized];
  }

  return [
    ...months.slice(0, insertIndex),
    synthesized,
    ...months.slice(insertIndex),
  ];
}
