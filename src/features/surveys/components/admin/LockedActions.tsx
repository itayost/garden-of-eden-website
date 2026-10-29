"use client";

import { useRouter } from "next/navigation";
import { CircleStop, Loader2 } from "lucide-react";

import { DeleteConfirmDialog } from "@/components/admin/DeleteConfirmDialog";
import { Button } from "@/components/ui/button";
import { closeSurveyAction } from "../../lib/actions/close-survey";

interface LockedActionsProps {
  surveyId: string;
  /** The Survey is open: one that already ended by date has nothing to close. */
  canClose: boolean;
  saving: boolean;
  grow: boolean;
  onSave: () => void;
}

function CloseNowButton({ surveyId, width }: { surveyId: string; width: string | undefined }) {
  const router = useRouter();
  return (
    <DeleteConfirmDialog
      title="לסגור את הסקר עכשיו?"
      description="הסקר יפסיק לקבל תשובות, ואי אפשר לפתוח אותו שוב. התשובות שכבר נשלחו נשארות."
      confirmLabel="סגירה"
      loadingLabel="סוגר..."
      successMessage="הסקר נסגר"
      errorMessage="הסגירה נכשלה. נסו שוב."
      onDelete={() => closeSurveyAction(surveyId)}
      onSuccess={() => router.push(`/admin/surveys/${surveyId}`)}
      trigger={
        <Button type="button" variant="outline" className={`${width ?? ""} text-destructive hover:text-destructive`}>
          <CircleStop aria-hidden="true" />
          סגירה עכשיו
        </Button>
      }
    />
  );
}

/** Close now (after a confirmation, while the Survey is open) and save, for a Survey that has Responses. */
export function LockedActions({ surveyId, canClose, saving, grow, onSave }: LockedActionsProps) {
  const width = grow ? "flex-1" : undefined;
  return (
    <>
      {canClose && <CloseNowButton surveyId={surveyId} width={width} />}
      <Button type="button" className={width} disabled={saving} onClick={onSave}>
        {saving && <Loader2 aria-hidden="true" className="animate-spin" />}
        שמירה
      </Button>
    </>
  );
}
