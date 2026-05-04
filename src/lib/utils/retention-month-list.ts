export interface RetentionMonthOption {
  readonly report_month: string;
  readonly created_at: string | null;
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
