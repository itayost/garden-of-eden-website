/** "6 מתאמנים", or the singular Hebrew reads wrong with a numeral. */
export function rosterLabel(count: number): string {
  return count === 1 ? "מתאמן אחד" : `${count} מתאמנים`;
}
