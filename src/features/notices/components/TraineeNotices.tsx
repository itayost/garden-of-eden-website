"use client";

import { useState, useTransition } from "react";
import { BellRing, X } from "lucide-react";
import { toast } from "sonner";
import { dismissNoticeAction, type TraineeNotice } from "../lib/notices";

/** What changed for the Trainee without them doing it, until they close it. */
export function TraineeNotices({ notices }: { notices: TraineeNotice[] }) {
  const [open, setOpen] = useState(notices);
  const [pending, startTransition] = useTransition();
  if (open.length === 0) return null;

  const dismiss = (id: string) =>
    startTransition(async () => {
      const result = await dismissNoticeAction(id);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      setOpen((current) => current.filter((n) => n.id !== id));
    });

  return (
    <section aria-label="עדכונים" className="space-y-2">
      {open.map((notice) => (
        <div
          key={notice.id}
          role="status"
          className="flex items-start gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-4 text-sm"
        >
          <BellRing className="mt-0.5 h-4 w-4 shrink-0 text-warning-emphasis" aria-hidden="true" />
          <p className="flex-1 leading-relaxed">{notice.body}</p>
          <button
            type="button"
            onClick={() => dismiss(notice.id)}
            disabled={pending}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-black/5 hover:text-foreground"
            aria-label="סגירת ההודעה"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </section>
  );
}
