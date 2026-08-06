/**
 * Date formatting utilities
 * Centralized date formatting for consistent display across the app
 */

export const HEBREW_WEEKDAYS = [
  "יום ראשון",
  "יום שני",
  "יום שלישי",
  "יום רביעי",
  "יום חמישי",
  "יום שישי",
  "שבת",
] as const;

/**
 * Hebrew weekday name for an ISO YYYY-MM-DD date.
 * Parses at UTC midnight so a date-only string never shifts a day; pass a
 * date produced by israelToday() when "today" is meant.
 */
export function hebrewWeekday(isoDate: string): string {
  return HEBREW_WEEKDAYS[new Date(`${isoDate}T00:00:00Z`).getUTCDay()];
}

/**
 * Format date in Hebrew locale (he-IL)
 * Example output: "15 בינואר 2024"
 */
export function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("he-IL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Format date in short format
 * Example output: "15/01/2024"
 */
export function formatDateShort(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Format date with time
 * Example output: "15 בינואר 2024, 14:30"
 */
export function formatDateTime(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("he-IL", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/**
 * Format relative time (e.g., "לפני 3 דקות")
 */
export function formatRelativeTime(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - d.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return "עכשיו";
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `לפני ${diffInMinutes} דקות`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `לפני ${diffInHours} שעות`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `לפני ${diffInDays} ימים`;
  }

  // Fall back to full date for older dates
  return formatDate(d);
}
