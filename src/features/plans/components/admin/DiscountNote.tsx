/** A sale below list price: what it was worth struck through, why, and who gave it (a Discount, or free). */
export function DiscountNote({
  listPrice,
  reason,
  by,
  free = false,
}: {
  listPrice: number;
  reason: string | null;
  by: string | null;
  free?: boolean;
}) {
  return (
    <span className="text-xs text-muted-foreground">
      <s>₪{listPrice.toLocaleString("he-IL")}</s> {free ? "ללא תשלום" : "הנחה"}: {reason}
      {by ? ` · ע"י ${by}` : ""}
    </span>
  );
}
