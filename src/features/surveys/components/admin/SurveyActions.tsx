"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleStop, Pencil, Trash2 } from "lucide-react";

import { DeleteConfirmDialog } from "@/components/admin/DeleteConfirmDialog";
import { Button } from "@/components/ui/button";
import { closeSurveyAction } from "../../lib/actions/close-survey";
import { deleteSurveyAction } from "../../lib/actions/delete-survey";
import { deleteDescription } from "../../lib/results-view";
import { SurveyCsvButton } from "./SurveyCsvButton";

/** Four buttons fit one row on a phone only when they are smaller and go by their words alone. */
const PHONE_SIZE = "max-md:h-8 max-md:px-2.5 max-md:text-[13px] max-md:[&>svg]:hidden";

interface SurveyActionsProps {
  surveyId: string;
  /** Show "עריכה": the viewer may edit it and it was not closed early. */
  canEdit: boolean;
  /** Show "סגירה עכשיו": the viewer may edit it and it is open. */
  canClose: boolean;
  /** Show "מחיקה": an Admin, or a manager of a Survey nobody answered. */
  canDelete: boolean;
  /** Every Response, not only the ones in view: they all go with a deleted Survey. */
  responseCount: number;
  csvRows: Record<string, string>[];
  csvFileName: string;
}

function CloseButton({ surveyId }: { surveyId: string }) {
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
      onSuccess={() => router.refresh()}
      trigger={
        <Button type="button" variant="outline" className={`${PHONE_SIZE} text-destructive hover:text-destructive`}>
          <CircleStop aria-hidden="true" />
          סגירה עכשיו
        </Button>
      }
    />
  );
}

function DeleteButton({ surveyId, responseCount }: { surveyId: string; responseCount: number }) {
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
        <Button type="button" variant="ghost" className={`${PHONE_SIZE} text-destructive hover:text-destructive`}>
          <Trash2 aria-hidden="true" />
          מחיקה
        </Button>
      }
    />
  );
}

/** The buttons of the results page. The server refuses what the viewer may not do; this hides it. */
export function SurveyActions({
  surveyId,
  canEdit,
  canClose,
  canDelete,
  responseCount,
  csvRows,
  csvFileName,
}: SurveyActionsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {canEdit && (
        <Button asChild variant="outline" className={PHONE_SIZE}>
          <Link href={`/admin/surveys/${surveyId}/edit`}>
            <Pencil aria-hidden="true" />
            עריכה
          </Link>
        </Button>
      )}
      {canClose && <CloseButton surveyId={surveyId} />}
      {canDelete && <DeleteButton surveyId={surveyId} responseCount={responseCount} />}
      <SurveyCsvButton rows={csvRows} fileName={csvFileName} className={PHONE_SIZE} />
    </div>
  );
}
