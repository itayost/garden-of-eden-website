"use client";

import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toLocalPhone } from "@/lib/plans/local-phone";
import type { PaymentLinkResult as LinkResult } from "../../lib/actions/payment-link";
import { copy, Line } from "./PaymentResult";

/**
 * A Payment link was made: the link to copy, and whether the WhatsApp went
 * out. Nothing is sold until the parent pays by card.
 */
export function PaymentLinkResult({ result, onClose }: { result: LinkResult; onClose: () => void }) {
  const { whatsapp } = result;
  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        <Line ok={true}>
          <div className="font-medium">נוצר קישור לתשלום</div>
          <div className="text-muted-foreground">
            ההורה חותם על ההסכם ומשלם באשראי. המסלול נרשם רק אחרי התשלום; קישור שלא שולם פג תוקף כמו הזמנה רגילה.
          </div>
        </Line>
        {whatsapp.sentTo ? (
          <Line ok={true}>
            <div className="font-medium">הקישור נשלח בוואטסאפ</div>
            <div className="text-muted-foreground" dir="ltr">
              {toLocalPhone(whatsapp.sentTo)}
            </div>
          </Line>
        ) : whatsapp.skipped ? (
          <Line ok={null}>
            <div className="font-medium">לא נשלח וואטסאפ (לפי בחירתכם). העתיקו את הקישור ושלחו להורה.</div>
          </Line>
        ) : (
          <Line ok={false}>
            <div className="font-medium">הוואטסאפ לא נשלח. העתיקו את הקישור ושלחו להורה.</div>
            <div className="text-muted-foreground">{whatsapp.error}</div>
          </Line>
        )}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => copy(result.url, "הקישור לתשלום הועתק")}>
          <Copy className="h-4 w-4 me-1" />
          העתק קישור לתשלום
        </Button>
        <Button onClick={onClose}>סגירה</Button>
      </div>
    </div>
  );
}
