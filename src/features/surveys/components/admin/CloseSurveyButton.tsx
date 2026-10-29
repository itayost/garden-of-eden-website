"use client";

import { CircleStop } from "lucide-react";

import { DeleteConfirmDialog } from "@/components/admin/DeleteConfirmDialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { closeSurveyAction } from "../../lib/actions/close-survey";

interface CloseSurveyButtonProps {
  surveyId: string;
  /** Sizing and width, from the row of buttons it sits in. */
  className?: string;
  /** Runs once the Survey is closed: the page it sits on decides where to go next. */
  onSuccess: () => void;
}

/** Closes an open Survey now, after a confirmation. A Survey closed this way stays closed. */
export function CloseSurveyButton({ surveyId, className, onSuccess }: CloseSurveyButtonProps) {
  return (
    <DeleteConfirmDialog
      title="לסגור את הסקר עכשיו?"
      description="הסקר יפסיק לקבל תשובות, ואי אפשר לפתוח אותו שוב. התשובות שכבר נשלחו נשארות."
      confirmLabel="סגירה"
      loadingLabel="סוגר..."
      successMessage="הסקר נסגר"
      errorMessage="הסגירה נכשלה. נסו שוב."
      onDelete={() => closeSurveyAction(surveyId)}
      onSuccess={onSuccess}
      trigger={
        <Button
          type="button"
          variant="outline"
          className={cn("text-destructive hover:text-destructive", className)}
        >
          <CircleStop aria-hidden="true" />
          סגירה עכשיו
        </Button>
      }
    />
  );
}
