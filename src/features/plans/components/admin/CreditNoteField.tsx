"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { recordCreditNoteAction } from "../../lib/actions/void-plan";

/** Records the number of the credit note issued by hand in Morning for a refund. */
export function CreditNoteField({ refundId }: { refundId: string }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      const result = await recordCreditNoteAction({ refundId, creditNoteNumber: value });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("מספר הזיכוי נשמר");
      router.refresh();
    });

  return (
    <div className="flex items-center gap-1">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="מספר חשבונית זיכוי"
        aria-label="מספר חשבונית הזיכוי שהופקה ב-Morning"
        className="h-8 w-40 text-xs"
        disabled={pending}
      />
      <Button size="sm" variant="outline" onClick={save} disabled={pending || value.trim() === ""}>
        שמירה
      </Button>
    </div>
  );
}
