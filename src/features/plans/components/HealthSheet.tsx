"use client";

import { useEffect, useState } from "react";
import { HeartPulse, Phone } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { getTraineeHealthAction, type TraineeHealth } from "../lib/actions/trainee-health";
import { formatPhoneToLocal } from "@/lib/validations/common";

interface HealthSheetProps {
  traineeId: string;
  traineeName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Opened from a roster chip; loads through the scoped action on open. */
export function HealthSheet({ traineeId, traineeName, open, onOpenChange }: HealthSheetProps) {
  const [health, setHealth] = useState<TraineeHealth | null | undefined>(undefined);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    getTraineeHealthAction(traineeId).then((h) => {
      if (!cancelled) setHealth(h);
    });
    return () => {
      cancelled = true;
    };
  }, [open, traineeId]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" dir="rtl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <HeartPulse className="h-5 w-5 text-amber-600" />
            {traineeName}
          </SheetTitle>
        </SheetHeader>
        <div className="space-y-4 py-4 text-sm">
          {health === undefined && <p className="text-muted-foreground">טוען...</p>}
          {health === null && <p className="text-muted-foreground">אין הרשאה או אין נתונים</p>}
          {health && (
            <>
              <div>
                <div className="text-muted-foreground">מגבלות רפואיות</div>
                <div className="font-medium">{health.medicalNotes ?? "אין"}</div>
              </div>
              {health.emergencyContactPhone && (
                <a href={`tel:${health.emergencyContactPhone}`} className="flex items-center gap-2 rounded-xl border p-3 font-medium">
                  <Phone className="h-4 w-4" />
                  {health.emergencyContactName}: {formatPhoneToLocal(health.emergencyContactPhone)}
                </a>
              )}
              {health.guardianPhone && (
                <a href={`tel:${health.guardianPhone}`} className="flex items-center gap-2 rounded-xl border p-3">
                  <Phone className="h-4 w-4" />
                  הורה: {health.guardianName} {formatPhoneToLocal(health.guardianPhone)}
                </a>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
