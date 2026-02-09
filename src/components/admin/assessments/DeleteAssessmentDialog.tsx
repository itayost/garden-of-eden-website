"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { softDeleteAssessmentAction } from "@/lib/actions/admin-assessments";
import { DeleteConfirmDialog } from "@/components/admin/DeleteConfirmDialog";

interface DeleteAssessmentDialogProps {
  assessmentId: string;
  assessmentDate: string;
  trigger?: React.ReactNode;
}

export function DeleteAssessmentDialog({
  assessmentId,
  assessmentDate,
  trigger,
}: DeleteAssessmentDialogProps) {
  const router = useRouter();
  const formattedDate = new Date(assessmentDate).toLocaleDateString("he-IL");

  return (
    <DeleteConfirmDialog
      title="מחיקת מבדק"
      description={
        <>
          <p>האם אתה בטוח שברצונך למחוק את המבדק מתאריך <strong>{formattedDate}</strong>?</p>
          <p className="text-muted-foreground">
            המבדק יסומן כמחוק אך הנתונים ישמרו במערכת.
          </p>
        </>
      }
      confirmLabel="מחק מבדק"
      loadingLabel="מוחק..."
      successMessage="המבדק נמחק בהצלחה"
      errorMessage="שגיאה במחיקת המבדק"
      onDelete={() => softDeleteAssessmentAction(assessmentId)}
      onSuccess={() => router.refresh()}
      trigger={trigger || (
        <Button variant="ghost" size="icon">
          <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
        </Button>
      )}
    />
  );
}
