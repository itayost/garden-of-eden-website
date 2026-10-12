/**
 * Shekels for a screen: "₪1,200", "₪12.5". A negative amount reads "−₪310"
 * with a real minus sign; callers isolate it with dir="ltr" so RTL text does
 * not move the sign to the far end.
 */
export function formatIls(amount: number): string {
  const digits = Math.abs(amount).toLocaleString("he-IL", { maximumFractionDigits: 2 });
  return amount < 0 ? `−₪${digits}` : `₪${digits}`;
}
