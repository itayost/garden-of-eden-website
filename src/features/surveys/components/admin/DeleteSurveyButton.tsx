"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

import { DeleteConfirmDialog } from "@/components/admin/DeleteConfirmDialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { deleteSurveyAction } from "../../lib/actions/delete-survey";
import { deleteDescription } from "../../lib/results-view";

interface DeleteSurveyButtonProps {
  surveyId: string;
  /** Every Response: they all go with the Survey, and the confirmation says how many. */
  responseCount: number;
  /** The button's words; the confirmation keeps its own. */
  label?: string;
  /** Sizing, from the row of buttons it sits in. */
  className?: string;
}

/** Deletes a Survey after a confirmation that counts what goes with it, then goes back to the list. */
export function DeleteSurveyButton({
  surveyId,
  responseCount,
  label = "מחיקה",
  className,
}: DeleteSurveyButtonProps) {
  const router = useRouter();
  return (
    <DeleteConfirmDialog
      title="למחוק את הסקר?"
      description={deleteDescription(responseCount)}
      confirmLabel="מחיקה"
      loadingLabel="מוחק..."
      successMessage="הסקר נמחק"
      errorMessage="המחיקה נכשלה. נסו שוב."
      onDelete={() => deleteSurveyAction(surveyId)}
      onSuccess={() => router.push("/admin/surveys")}
      trigger={
        <Button
          type="button"
          variant="ghost"
          className={cn("text-destructive hover:text-destructive", className)}
        >
          <Trash2 aria-hidden="true" />
          {label}
        </Button>
      }
    />
  );
}
