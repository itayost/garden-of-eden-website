"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CheckCircle2, Copy, FileText, MessageCircle, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { shortDate } from "@/lib/utils/iso-date";
import { toLocalPhone } from "@/lib/plans/local-phone";
import type { ManualPaymentResult } from "../../lib/manual-payment";
import { issueInvoiceAction } from "../../lib/actions/admin-orders";
import { resendAgreementLinkAction } from "../../lib/actions/staff-payment";

function Line({ ok, children }: { ok: boolean | null; children: React.ReactNode }) {
  const Icon = ok === null ? FileText : ok ? CheckCircle2 : XCircle;
  const color = ok === null ? "text-muted-foreground" : ok ? "text-green-600" : "text-destructive";
  return (
    <li className="flex items-start gap-3 rounded-xl border p-3">
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${color}`} />
      <div className="min-w-0 flex-1 space-y-1 text-sm">{children}</div>
    </li>
  );
}

async function copy(text: string, done: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(done);
  } catch {
    toast.error("ההעתקה נכשלה");
  }
}

/**
 * What happened, line by line, so the staff member knows what the parent
 * received before the family walks away. Every failed line has its retry.
 */
export function PaymentResult({
  result,
  isAdmin,
  onClose,
}: {
  result: ManualPaymentResult;
  isAdmin: boolean;
  onClose: () => void;
}) {
  const [invoice, setInvoice] = useState(result.invoice);
  const [whatsapp, setWhatsapp] = useState(result.whatsapp);
  const [pending, startTransition] = useTransition();

  const retryInvoice = () =>
    startTransition(async () => {
      const r = await issueInvoiceAction(result.orderId);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      setInvoice({ url: r.url ?? null, error: null, skipped: false });
    });

  const resend = () =>
    startTransition(async () => {
      const r = await resendAgreementLinkAction(result.agreementId);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      setWhatsapp({ sentTo: r.sentTo, error: null, skipped: false });
    });

  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        <Line ok={true}>
          <div className="font-medium">המסלול נרשם</div>
          {result.endsOn && <div className="text-muted-foreground">בתוקף עד {shortDate(result.endsOn)}</div>}
        </Line>

        {invoice.skipped ? (
          <Line ok={null}>
            <div className="font-medium">חשבונית תופק ידנית ב-Morning</div>
            <div className="text-muted-foreground">החיבור ל-Morning עדיין לא הוגדר</div>
          </Line>
        ) : invoice.url || (!invoice.error && !invoice.url) ? (
          <Line ok={true}>
            <div className="font-medium">חשבונית הופקה ב-Morning</div>
            {invoice.url && (
              <div className="flex flex-wrap gap-2">
                <a href={invoice.url} target="_blank" rel="noreferrer" className="underline">
                  פתיחה
                </a>
                <button type="button" className="inline-flex items-center gap-1 underline" onClick={() => copy(invoice.url!, "הקישור לחשבונית הועתק")}>
                  <Copy className="h-3 w-3" />
                  העתק קישור
                </button>
              </div>
            )}
          </Line>
        ) : (
          <Line ok={false}>
            <div className="font-medium">החשבונית לא הופקה</div>
            <div className="text-muted-foreground">{invoice.error}</div>
            {isAdmin ? (
              <Button size="sm" variant="outline" onClick={retryInvoice} disabled={pending}>
                {pending ? <Loader2 className="h-3 w-3 me-1 animate-spin" /> : null}
                נסה שוב
              </Button>
            ) : (
              <div className="text-muted-foreground">המנהל יכול להפיק אותה מחדש מדף ההזמנות.</div>
            )}
          </Line>
        )}

        {whatsapp.skipped ? (
          <Line ok={null}>
            <div className="font-medium">הודעת וואטסאפ לא נשלחה (לפי בחירתכם)</div>
          </Line>
        ) : whatsapp.sentTo ? (
          <Line ok={true}>
            <div className="font-medium">הודעה עם קישור לחתימה נשלחה בוואטסאפ</div>
            <div className="text-muted-foreground" dir="ltr">
              {toLocalPhone(whatsapp.sentTo)}
            </div>
          </Line>
        ) : (
          <Line ok={false}>
            <div className="font-medium">הודעת הוואטסאפ לא נשלחה</div>
            <div className="text-muted-foreground">{whatsapp.error}</div>
            <Button size="sm" variant="outline" onClick={resend} disabled={pending}>
              <MessageCircle className="h-3 w-3 me-1" />
              שלח שוב
            </Button>
          </Line>
        )}
      </ul>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => copy(result.agreementUrl, "הקישור לחתימה הועתק")}>
          <Copy className="h-4 w-4 me-1" />
          העתק קישור לחתימה
        </Button>
        <Button onClick={onClose} className="ms-auto">
          סיום
        </Button>
      </div>
    </div>
  );
}
