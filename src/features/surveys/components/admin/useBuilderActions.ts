"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { publishSurveyAction, unpublishSurveyAction } from "../../lib/actions/publish-survey";
import { publishProblem } from "../../lib/publish";
import { PROBLEM_SEPARATOR } from "../../lib/staff-input";
import type { SurveyDraft } from "../../lib/types";
import { REQUEST_FAILED } from "./builder-messages";
import { refusalOf, saveDraft } from "./builder-requests";

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

/** The id of the Survey the builder is working on, null until it has been saved: a state pair. */
type SavedIdState = readonly [string | null, (id: string) => void];

/**
 * Saves the draft. The first save of a new Survey moves to its edit page with
 * router.replace, so a reload opens the saved draft; the edit page reads it
 * back from the server, and later saves go to the same Survey. A save of an
 * existing Survey refreshes the page, so the state badge follows the dates.
 */
function useSaveAction(run: BuilderRun, savedState: SavedIdState, draft: SurveyDraft, published: boolean) {
  const router = useRouter();
  const [savedId, remember] = savedState;
  return async () => {
    if (run.pending !== null) return;
    const isNew = savedId === null;
    run.begin("save");
    const outcome = await saveDraft(savedId, draft);
    if ("errors" in outcome) return run.fail(outcome.errors);
    remember(outcome.surveyId);
    run.finish();
    toast.success(published ? "השינויים נשמרו" : "הטיוטה נשמרה");
    if (isNew) router.replace(editHref(outcome.surveyId));
    else router.refresh();
  };
}

/**
 * Publishing is a save, then a publish, then the Survey's own page. The
 * address is not touched on the way: that page replaces it.
 *
 * Unless the publish is refused for a Survey this publish was the first to
 * save: the address would stay on /new, where a reload loses the draft, so it
 * moves to the edit page. That page replaces this one and its list of reasons
 * with it, so the reasons also go to a toast.
 */
function usePublishAction(
  run: BuilderRun,
  savedState: SavedIdState,
  options: { draft: SurveyDraft; today: string; onAttempt: () => void },
) {
  const router = useRouter();
  const [savedId, remember] = savedState;
  return async () => {
    if (run.pending !== null) return;
    options.onAttempt();
    const problems = publishProblem(options.draft, options.today);
    if (problems.length > 0) return run.show(problems);
    const isNew = savedId === null;
    run.begin("publish");
    const outcome = await saveDraft(savedId, options.draft);
    if ("errors" in outcome) return run.fail(outcome.errors);
    remember(outcome.surveyId);
    const refusal = await refusalOf(() => publishSurveyAction(outcome.surveyId), REQUEST_FAILED.publish);
    if (refusal !== null) {
      run.fail(refusal);
      if (isNew) {
        toast.error(refusal.join(PROBLEM_SEPARATOR));
        router.replace(editHref(outcome.surveyId));
      }
      return;
    }
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
    const refusal = await refusalOf(() => unpublishSurveyAction(savedId), REQUEST_FAILED.unpublish);
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
  const savedState = useState(surveyId);
  const [savedId] = savedState;
  const [attempted, setAttempted] = useState(false);

  const save = useSaveAction(run, savedState, draft, published);
  const publish = usePublishAction(run, savedState, { draft, today, onAttempt: () => setAttempted(true) });
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
