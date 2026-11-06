"use client";

import { useState } from "react";
import { NotebookPen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { normalizePhoneIL } from "@/lib/validations/common";
import { CallLink } from "./CallLink";
import { RetentionCallDialog } from "./RetentionCallDialog";

interface RetentionCallCellProps {
  readonly reportMonth: string;
  readonly phone: string | null;
  readonly traineeName: string;
}

/** The retention "שיחה" cell: call the customer, then document the call. */
export function RetentionCallCell({ reportMonth, phone, traineeName }: RetentionCallCellProps) {
  const [open, setOpen] = useState(false);
  const e164 = normalizePhoneIL(phone);

  if (!e164) return <span className="text-muted-foreground">—</span>;

  return (
    <div className="flex items-center gap-2 whitespace-nowrap">
      <CallLink
        target={{ kind: "retention", reportMonth, phone: e164 }}
        phone={e164}
        contactName={traineeName}
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 gap-1 px-2 text-xs"
        onClick={() => setOpen(true)}
        aria-label={`תיעוד שיחה עם ${traineeName}`}
      >
        <NotebookPen className="h-3.5 w-3.5" aria-hidden />
        תיעוד שיחה
      </Button>
      <RetentionCallDialog
        open={open}
        onOpenChange={setOpen}
        reportMonth={reportMonth}
        phone={e164}
        traineeName={traineeName}
      />
    </div>
  );
}
