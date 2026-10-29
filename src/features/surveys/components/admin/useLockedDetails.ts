"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { updateSurveyDetailsAction } from "../../lib/actions/update-survey-details";
import { reopensEndedSurvey } from "../../lib/state";
import type { SurveyRecord } from "../../lib/types";
import { REQUEST_FAILED } from "./builder-messages";

/** The fields of a locked Survey that can still change, as the inputs hold them ("" is no value). */
export interface LockedValues {
  title: string;
  intro: string;
  closesOn: string;
}

const blankToNull = (value: string): string | null => (value.trim() === "" ? null : value);

/** What was saved, or the reason it was not. A request that throws reads as a failed save. */
async function sendDetails(surveyId: string, values: LockedValues): Promise<string | null> {
  try {
    const result = await updateSurveyDetailsAction(surveyId, {
      title: values.title,
      intro: blankToNull(values.intro),
      closesOn: blankToNull(values.closesOn),
    });
    return "error" in result ? result.error : null;
  } catch {
    return REQUEST_FAILED.save;
  }
}

/**
 * The title, intro and close date of a Survey that has Responses, and saving
 * them. `reopens` says the new close date (or none) opens a Survey that ended by date.
 * An edit clears the last refusal.
 */
export function useLockedDetails(record: SurveyRecord, today: string) {
  const router = useRouter();
  const [values, setValues] = useState<LockedValues>({
    title: record.title,
    intro: record.intro ?? "",
    closesOn: record.closesOn ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const edit = (patch: Partial<LockedValues>) => {
    setErrors([]);
    setValues((current) => ({ ...current, ...patch }));
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setErrors([]);
    const problem = await sendDetails(record.id, values);
    setSaving(false);
    if (problem !== null) return setErrors([problem]);
    toast.success("השינויים נשמרו");
    router.refresh();
  };

  const closesOn = blankToNull(values.closesOn);
  return { values, edit, saving, errors, save, reopens: reopensEndedSurvey(record, closesOn, today) };
}
