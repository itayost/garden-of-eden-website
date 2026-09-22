/**
 * Whether each trainee's session is built, per slot, for a range of days at
 * once — what the calendar's day card shows beside every name.
 *
 * The calendar switches day on the client from one week of loaded data, so the
 * statuses are loaded for the whole week rather than for one date.
 */

/** A trainee with no entry in a slot has nothing built there, so there is no third state to store. */
export interface DaySessionStatus {
  status: "built" | "completed";
  exerciseCount: number;
}

/** date -> slot id ("" when the session has no slot) -> trainee id -> status. */
export type DaySessionStatuses = Record<
  string,
  Record<string, Record<string, DaySessionStatus>>
>;

/** A session row as the week query selects it. */
export interface SessionStatusRow {
  trainee_id: string;
  session_date: string;
  slot_id: string | null;
  completed_at: string | null;
  exercises: { id: string }[] | null;
}

/**
 * A session belongs to a slot, so a trainee can hold more than one on a date
 * and the trainee id alone no longer identifies a status. The empty string
 * keys the rare session that belongs to no slot.
 */
export function toDaySessionStatuses(rows: SessionStatusRow[]): DaySessionStatuses {
  return rows.reduce<DaySessionStatuses>((statuses, row) => {
    const day = statuses[row.session_date] ?? {};
    const slotKey = row.slot_id ?? "";
    const slot = day[slotKey] ?? {};
    return {
      ...statuses,
      [row.session_date]: {
        ...day,
        [slotKey]: {
          ...slot,
          [row.trainee_id]: {
            status: row.completed_at ? "completed" : "built",
            exerciseCount: row.exercises?.length ?? 0,
          },
        },
      },
    };
  }, {});
}
