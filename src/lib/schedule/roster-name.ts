/**
 * Staff tell trainees apart by their שנתון, so the calendar shows a roster
 * name as "יונתן 08". The name on a roster row is a snapshot and carries no
 * birthdate; the year is looked up from the profile when the week is loaded.
 */

const ISO_YEAR = /^(\d{4})-/;

/** The year of an ISO birthdate, or null when there is none to read. */
export function birthYearOf(birthdate: string | null): number | null {
  const match = birthdate ? ISO_YEAR.exec(birthdate) : null;
  return match ? Number(match[1]) : null;
}

/** "08" for 2008; null when the year is unknown (free-text names, no birthdate). */
export function shortBirthYear(birthYear: number | null | undefined): string | null {
  return birthYear == null ? null : String(birthYear % 100).padStart(2, "0");
}

/** "יונתן 08"; the bare name when the year is unknown. */
export function rosterName(entry: { trainee_name: string; birth_year?: number | null }): string {
  const year = shortBirthYear(entry.birth_year);
  return year ? `${entry.trainee_name} ${year}` : entry.trainee_name;
}
