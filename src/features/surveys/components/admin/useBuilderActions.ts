"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { publishProblem } from "../../lib/publish";
import type { SurveyDraft } from "../../lib/types";
import { publishSaved, saveDraft, unpublishSaved } from "./builder-requests";

export type BuilderPending = "save" | "publish" | "unpublish";

interface BuilderActionsOptions {
  /** Null while the Survey has never been saved. */
  surveyId: string | null;
  published: boolean;
  draft: SurveyDraft;
  today: string;
}

const editHref = (surveyId: string) => `/admin/surveys/${surveyId}/edit`;

/**
 * Save, publish and return-to-draft for the builder. Publishing is a save,
 * then a publish, then the Survey's own page; whatever the server refuses
 * lands in `errors`, in Hebrew, every problem on its own line. The first
 * save of a new Survey moves the address bar to its edit page without
 * remounting the builder, and later saves go to the same Survey.
 */
export function useBuilderActions({ surveyId, published, draft, today }: BuilderActionsOptions) {
  const router = useRouter();
  const [savedId, setSavedId] = useState(surveyId);
  const [pending, setPending] = useState<BuilderPending | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [attempted, setAttempted] = useState(false);

  const remember = (id: string) => {
    if (savedId === null) window.history.replaceState(window.history.state, "", editHref(id));
    setSavedId(id);
  };

  const stop = (reasons: string[]) => {
    setErrors(reasons);
    setPending(null);
  };

  const save = async () => {
    if (pending !== null) return;
    setPending("save");
    setErrors([]);
    const outcome = await saveDraft(savedId, draft);
    if ("errors" in outcome) return stop(outcome.errors);
    remember(outcome.surveyId);
    setPending(null);
    toast.success(published ? "השינויים נשמרו" : "הטיוטה נשמרה");
  };

  const publish = async () => {
    if (pending !== null) return;
    setAttempted(true);
    const problems = publishProblem(draft, today);
    if (problems.length > 0) return setErrors(problems);
    setPending("publish");
    setErrors([]);
    const saved = await saveDraft(savedId, draft);
    if ("errors" in saved) return stop(saved.errors);
    remember(saved.surveyId);
    const refusal = await publishSaved(saved.surveyId);
    if (refusal !== null) return stop(refusal);
    toast.success("הסקר פורסם");
    // Still pending: the page is on its way out, and a second click must do nothing.
    router.push(`/admin/surveys/${saved.surveyId}`);
  };

  const backToDraft = async () => {
    if (pending !== null || savedId === null) return;
    setPending("unpublish");
    setErrors([]);
    const refusal = await unpublishSaved(savedId);
    if (refusal !== null) return stop(refusal);
    setPending(null);
    toast.success("הסקר חזר לטיוטה");
    router.refresh();
  };

  return {
    savedId,
    pending,
    errors,
    attempted,
    save,
    publish,
    backToDraft,
    clearErrors: () => setErrors([]),
  };
}
