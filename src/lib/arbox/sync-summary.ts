/**
 * The Hebrew line staff see after pressing "סנכרון עם Arbox".
 *
 * Link errors from the user sync are left out on purpose: a handful of Arbox
 * clients fail to link every night (an id and a phone pointing at two
 * profiles), and repeating that count on every press would read as the button
 * being broken.
 */
export interface ArboxSyncCounts {
  readonly usersCreated: number;
  readonly plansCreated: number;
  readonly plansMerged: number;
  readonly purchasesFailed: number;
}

const counted = (n: number, one: string, many: string): string | null =>
  n === 0 ? null : n === 1 ? one : `${n} ${many}`;

export function arboxSyncSummary(c: ArboxSyncCounts): string {
  const parts = [
    counted(c.usersCreated, "מתאמן חדש אחד", "מתאמנים חדשים"),
    counted(c.plansCreated, "מסלול אחד נוסף", "מסלולים נוספו"),
    counted(c.plansMerged, "מסלול אחד עודכן", "מסלולים עודכנו"),
    counted(c.purchasesFailed, "רכישה אחת לא נקלטה", "רכישות לא נקלטו"),
  ].filter((p): p is string => p !== null);
  return `Arbox סונכרן: ${parts.length === 0 ? "אין שינויים" : parts.join(", ")}`;
}
