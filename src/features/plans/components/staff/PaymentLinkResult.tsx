"use client";

import { toast } from "sonner";
import { CheckCircle2, Copy, FileText, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toLocalPhone } from "@/lib/plans/local-phone";
import type { PaymentLinkResult as LinkResult } from "../../lib/actions/payment-link";

/**
 * A Payment link was made: the link to copy, and whether the WhatsApp went
 * out. Nothing is sold until the parent pays by card.
 */
export function PaymentLinkResult({ result, onClose }: { result: LinkResult; onClose: () => void }) {
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(result.url);
      toast.success("הקישור לתשלום הועתק");
    } catch {
      toast.error("ההעתקה נכשלה");
    }
  };
  const { whatsapp } = result;
  const Icon = whatsapp.sentTo ? CheckCircle2 : whatsapp.skipped ? FileText : XCircle;

  return (
    <div className="space-y-4">
      <div className="space-y-1 rounded-xl border p-3 text-sm">
        <div className="font-medium">נוצר קישור לתשלום</div>
        <div className="text-muted-foreground">
          ההורה חותם על ההסכם ומשלם באשראי. המסלול נרשם רק אחרי התשלום; קישור שלא שולם פג תוקף כמו הזמנה רגילה.
        </div>
      </div>
      <div className="flex items-start gap-3 rounded-xl border p-3 text-sm">
        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${whatsapp.sentTo ? "text-success" : whatsapp.skipped ? "text-muted-foreground" : "text-destructive"}`} />
        <div className="space-y-1">
          {whatsapp.sentTo ? (
            <>
              <div className="font-medium">הקישור נשלח בוואטסאפ</div>
              <div className="text-muted-foreground" dir="ltr">
                {toLocalPhone(whatsapp.sentTo)}
              </div>
            </>
          ) : whatsapp.skipped ? (
            <div className="font-medium">לא נשלח וואטסאפ (לפי בחירתכם). העתיקו את הקישור ושלחו להורה.</div>
          ) : (
            <>
              <div className="font-medium">הוואטסאפ לא נשלח. העתיקו את הקישור ושלחו להורה.</div>
              <div className="text-muted-foreground">{whatsapp.error}</div>
            </>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={copyLink}>
          <Copy className="h-4 w-4 me-1" />
          העתק קישור לתשלום
        </Button>
        <Button onClick={onClose}>סגירה</Button>
      </div>
    </div>
  );
}
