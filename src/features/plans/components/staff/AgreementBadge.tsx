"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, PenLine, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { resendAgreementLinkAction } from "../../lib/actions/staff-payment";

/** "הסכם נחתם" or "לא נחתם" with a resend for the latter. */
export function AgreementBadge({
  agreementId,
  signed,
}: {
  agreementId: string | null;
  signed: boolean;
}) {
  const [pending, startTransition] = useTransition();
  // The template waits for Meta: the staff member sends it from their own WhatsApp.
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  if (!agreementId) return null;
  if (signed) return <Badge variant="secondary">הסכם נחתם</Badge>;

  const resend = () =>
    startTransition(async () => {
      const result = await resendAgreementLinkAction(agreementId);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      if ("shareUrl" in result) {
        setShareUrl(result.shareUrl);
        return;
      }
      toast.success("הקישור לחתימה נשלח שוב");
    });

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <Badge className="bg-amber-500 text-black hover:bg-amber-500">
        <PenLine className="h-3 w-3 me-1" />
        הסכם לא נחתם
      </Badge>
      {shareUrl ? (
        <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" asChild>
          <a href={shareUrl} target="_blank" rel="noreferrer">
            <Send className="h-3 w-3 me-1" />
            פתיחת וואטסאפ להורה
          </a>
        </Button>
      ) : (
        <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={resend} disabled={pending}>
          {pending ? <Loader2 className="h-3 w-3 me-1 animate-spin" /> : <Send className="h-3 w-3 me-1" />}
          שלח שוב
        </Button>
      )}
    </span>
  );
}
