"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requestPurchaseLinkAction } from "../lib/actions/purchase-request";

/** The request's wording, the same on every screen. */
export const REQUEST_LABELS = {
  buy: "בקשה מההורה לקנות מסלול",
  renew: "בקשה מההורה לחדש",
  renewEarly: "בקשה מההורה לחידוש מוקדם",
} as const;

/**
 * "Buy a plan" for a trainee: the parent gets the purchase link on WhatsApp
 * and pays on their own phone; the child never holds the link.
 */
export function PurchaseRequestButton({ label, primary = true }: { label: string; primary?: boolean }) {
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  const request = () =>
    startTransition(async () => {
      const result = await requestPurchaseLinkAction();
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      setSent(true);
    });

  if (sent) {
    return <p className="text-sm font-medium text-success">שלחנו להורה קישור לבחירת מסלול ותשלום</p>;
  }
  return (
    <Button variant={primary ? "default" : "outline"} onClick={request} disabled={pending}>
      {pending ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <Send className="h-4 w-4 me-2" />}
      {label}
    </Button>
  );
}
