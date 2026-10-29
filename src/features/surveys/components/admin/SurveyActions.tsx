"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CloseSurveyButton } from "./CloseSurveyButton";
import { DeleteSurveyButton } from "./DeleteSurveyButton";
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
  const router = useRouter();
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
      {canClose && (
        <CloseSurveyButton surveyId={surveyId} className={PHONE_SIZE} onSuccess={() => router.refresh()} />
      )}
      {canDelete && (
        <DeleteSurveyButton surveyId={surveyId} responseCount={responseCount} className={PHONE_SIZE} />
      )}
      <SurveyCsvButton rows={csvRows} fileName={csvFileName} className={PHONE_SIZE} />
    </div>
  );
}
