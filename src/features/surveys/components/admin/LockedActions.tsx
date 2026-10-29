"use client";

import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CloseSurveyButton } from "./CloseSurveyButton";

interface LockedActionsProps {
  surveyId: string;
  /** The Survey is open: one that already ended by date has nothing to close. */
  canClose: boolean;
  saving: boolean;
  grow: boolean;
  onSave: () => void;
}

/** Close now (after a confirmation, while the Survey is open) and save, for a Survey that has Responses. */
export function LockedActions({ surveyId, canClose, saving, grow, onSave }: LockedActionsProps) {
  const router = useRouter();
  const width = grow ? "flex-1" : undefined;
  return (
    <>
      {canClose && (
        <CloseSurveyButton
          surveyId={surveyId}
          className={width}
          onSuccess={() => router.push(`/admin/surveys/${surveyId}`)}
        />
      )}
      <Button type="button" className={width} disabled={saving} onClick={onSave}>
        {saving && <Loader2 aria-hidden="true" className="animate-spin" />}
        שמירה
      </Button>
    </>
  );
}
