"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

/** The same product was recorded for this trainee minutes ago. */
export function DuplicatePrompt({
  minutesAgo,
  onConfirm,
  onCancel,
  pending,
}: {
  minutesAgo: number;
  onConfirm: () => void;
  onCancel: () => void;
  pending: boolean;
}) {
  const when = minutesAgo === 0 ? "ממש עכשיו" : `לפני ${minutesAgo} דקות`;
  return (
    <div className="space-y-4 rounded-xl border border-amber-500/60 bg-amber-50 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <p className="text-sm">
          נרשם תשלום זהה למתאמן הזה {when}. להמשיך ולרשום תשלום נוסף?
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={onCancel} disabled={pending}>
          ביטול
        </Button>
        <Button onClick={onConfirm} disabled={pending}>
          כן, לרשום שוב
        </Button>
      </div>
    </div>
  );
}
