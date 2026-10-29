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

/** What is running and what was refused, shared by the three actions. */
function useBuilderRun() {
  const [pending, setPending] = useState<BuilderPending | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  return {
    pending,
    errors,
    begin: (kind: BuilderPending) => {
      setPending(kind);
      setErrors([]);
    },
    /** The action stopped on these reasons. */
    fail: (reasons: string[]) => {
      setErrors(reasons);
      setPending(null);
    },
    finish: () => setPending(null),
    /** Reasons found before anything was sent. */
    show: (reasons: string[]) => setErrors(reasons),
    clear: () => setErrors([]),
  };
}

type BuilderRun = ReturnType<typeof useBuilderRun>;

/** The Survey the builder is working on: its id once it has been saved. */
interface SavedSurvey {
  id: string | null;
  remember: (id: string) => void;
}

/**
 * Saves the draft. The first save of a new Survey moves to its edit page with
 * router.replace, so a reload opens the saved draft; the edit page reads it
 * back from the server, and later saves go to the same Survey.
 */
function useSaveAction(run: BuilderRun, saved: SavedSurvey, draft: SurveyDraft, published: boolean) {
  const router = useRouter();
  return async () => {
    if (run.pending !== null) return;
    run.begin("save");
    const outcome = await saveDraft(saved.id, draft);
    if ("errors" in outcome) return run.fail(outcome.errors);
    saved.remember(outcome.surveyId);
    run.finish();
    toast.success(published ? "השינויים נשמרו" : "הטיוטה נשמרה");
    if (saved.id === null) router.replace(editHref(outcome.surveyId));
  };
}

/**
 * Publishing is a save, then a publish, then the Survey's own page. The
 * address is not touched on the way: that page replaces it.
 */
function usePublishAction(
  run: BuilderRun,
  saved: SavedSurvey,
  options: { draft: SurveyDraft; today: string; onAttempt: () => void },
) {
  const router = useRouter();
  return async () => {
    if (run.pending !== null) return;
    options.onAttempt();
    const problems = publishProblem(options.draft, options.today);
    if (problems.length > 0) return run.show(problems);
    run.begin("publish");
    const outcome = await saveDraft(saved.id, options.draft);
    if ("errors" in outcome) return run.fail(outcome.errors);
    saved.remember(outcome.surveyId);
    const refusal = await publishSaved(outcome.surveyId);
    if (refusal !== null) return run.fail(refusal);
    toast.success("הסקר פורסם");
    // Still pending: the page is on its way out, and a second click must do nothing.
    router.push(`/admin/surveys/${outcome.surveyId}`);
  };
}

function useBackToDraftAction(run: BuilderRun, savedId: string | null) {
  const router = useRouter();
  return async () => {
    if (run.pending !== null || savedId === null) return;
    run.begin("unpublish");
    const refusal = await unpublishSaved(savedId);
    if (refusal !== null) return run.fail(refusal);
    run.finish();
    toast.success("הסקר חזר לטיוטה");
    router.refresh();
  };
}

/**
 * Save, publish and return-to-draft for the builder. Whatever the server
 * refuses lands in `errors`, in Hebrew, every problem on its own line.
 */
export function useBuilderActions({ surveyId, published, draft, today }: BuilderActionsOptions) {
  const run = useBuilderRun();
  const [savedId, setSavedId] = useState(surveyId);
  const [attempted, setAttempted] = useState(false);
  const saved: SavedSurvey = { id: savedId, remember: setSavedId };

  const save = useSaveAction(run, saved, draft, published);
  const publish = usePublishAction(run, saved, { draft, today, onAttempt: () => setAttempted(true) });
  const backToDraft = useBackToDraftAction(run, savedId);

  return {
    savedId,
    pending: run.pending,
    errors: run.errors,
    attempted,
    save,
    publish,
    backToDraft,
    clearErrors: run.clear,
  };
}

export type BuilderActionsApi = ReturnType<typeof useBuilderActions>;
