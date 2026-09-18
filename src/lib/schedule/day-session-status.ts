/**
 * Whether each trainee's session is built, for a range of days at once — what
 * the calendar's day card shows beside every name.
 *
 * The calendar switches day on the client from one week of loaded data, so the
 * statuses are loaded for the whole week rather than for one date.
 */

/** A trainee with no entry has nothing built, so there is no third state to store. */
export interface DaySessionStatus {
  status: "built" | "completed";
  exerciseCount: number;
}

/** date -> trainee id -> status. */
export type DaySessionStatuses = Record<string, Record<string, DaySessionStatus>>;

/** A session row as the week query selects it. */
export interface SessionStatusRow {
  trainee_id: string;
  session_date: string;
  completed_at: string | null;
  exercises: { id: string }[] | null;
}

export function toDaySessionStatuses(rows: SessionStatusRow[]): DaySessionStatuses {
  return rows.reduce<DaySessionStatuses>((statuses, row) => {
    const day = statuses[row.session_date] ?? {};
    return {
      ...statuses,
      [row.session_date]: {
        ...day,
        [row.trainee_id]: {
          status: row.completed_at ? "completed" : "built",
          exerciseCount: row.exercises?.length ?? 0,
        },
      },
    };
  }, {});
}
