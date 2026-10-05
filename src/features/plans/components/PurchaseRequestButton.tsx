"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requestPurchaseLinkAction } from "../lib/actions/purchase-request";

/**
 * "Buy a plan" for a trainee: the parent gets the purchase link on WhatsApp
 * and pays on their own phone; the child never fills in the agreement.
 */
export function PurchaseRequestButton({ label, primary }: { label: string; primary?: boolean }) {
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  const request = () =>
    startTransition(async () => {
      const result = await requestPurchaseLinkAction();
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      // Until the template is approved, the child's own WhatsApp sends it.
      if ("shareUrl" in result) window.open(result.shareUrl, "_blank", "noopener");
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
