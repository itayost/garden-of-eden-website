"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";

import { DeleteConfirmDialog } from "@/components/admin/DeleteConfirmDialog";
import { ExceptionFormDialog } from "@/components/admin/schedule/week/ExceptionFormDialog";
import { Button } from "@/components/ui/button";
import type { TrainerOption } from "@/lib/actions/admin-trainers-list";
import { deleteExceptionAction } from "@/lib/actions/weekly-schedule";
import type { OnDutyAbsence } from "@/types/weekly-schedule";

interface AbsenceActionsProps {
  absence: OnDutyAbsence;
  /** ISO date the absence is on. */
  date: string;
  trainers: TrainerOption[];
}

/** Edit and delete for one absence, where the calendar shows it. Admins only. */
export function AbsenceActions({ absence, date, trainers }: AbsenceActionsProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);

  return (
    <span className="inline-flex items-center">
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        aria-label={`עריכת ההיעדרות של ${absence.trainerName}`}
        onClick={() => setEditing(true)}
      >
        <Pencil className="h-3 w-3" />
      </Button>
      <DeleteConfirmDialog
        title="מחיקת היעדרות"
        description={`${absence.trainerName} יחזור לשיבוץ ביום הזה.`}
        successMessage="ההיעדרות נמחקה"
        errorMessage="שגיאה במחיקת ההיעדרות"
        onDelete={() => deleteExceptionAction(absence.exceptionId)}
        onSuccess={() => router.refresh()}
        trigger={
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            aria-label={`מחיקת ההיעדרות של ${absence.trainerName}`}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        }
      />
      {editing && (
        <ExceptionFormDialog
          key={absence.exceptionId}
          open={editing}
          onOpenChange={setEditing}
          trainers={trainers}
          canEdit
          exception={{
            id: absence.exceptionId,
            exceptionDate: date,
            trainerId: absence.trainerId,
            note: absence.noteHe,
          }}
        />
      )}
    </span>
  );
}
