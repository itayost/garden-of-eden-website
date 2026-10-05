/** A discounted sale's line: the list price struck through, why, and who gave it. */
export function DiscountNote({
  listPrice,
  reason,
  by,
}: {
  listPrice: number;
  reason: string | null;
  by: string | null;
}) {
  return (
    <span className="text-xs text-muted-foreground">
      <s>₪{listPrice.toLocaleString("he-IL")}</s> הנחה: {reason}
      {by ? ` · ע"י ${by}` : ""}
    </span>
  );
}
