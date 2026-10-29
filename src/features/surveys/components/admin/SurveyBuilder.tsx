"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import type { BranchOption } from "@/types/branches";
import { previewSurvey } from "../../lib/draft";
import { toEditorForm, toSurveyDraft, type EditorForm } from "../../lib/editor-model";
import { publishProblemGroups } from "../../lib/publish";
import type { SurveyDraft, SurveyState } from "../../lib/types";
import { SurveyPopup } from "../trainee/SurveyPopup";
import { BuilderActions } from "./BuilderActions";
import { BuilderErrors } from "./BuilderErrors";
import { DeleteSurveyButton } from "./DeleteSurveyButton";
import { QuestionListEditor } from "./QuestionListEditor";
import { SettingsColumn } from "./SettingsColumn";
import { SurveyStateBadge } from "./SurveyStateBadge";
import { useBuilderActions } from "./useBuilderActions";

export interface SurveyBuilderProps {
  /** Null for a Survey that has never been saved. */
  surveyId: string | null;
  initial: SurveyDraft;
  state: SurveyState;
  /** Only the branches the viewer may choose. */
  branches: readonly BranchOption[];
  /** Today in Israel, from the server, so the publish rules agree with it. */
  today: string;
}

/** The name the preview thanks; the real popup uses the Trainee's own. */
const PREVIEW_FIRST_NAME = "נועם";

/**
 * The Survey builder: settings and the publish checklist beside the Questions
 * from lg, one column with a bar of actions pinned to the bottom on a phone.
 * Everything is edited in one working copy and saved together.
 */
export function SurveyBuilder({ surveyId, initial, state, branches, today }: SurveyBuilderProps) {
  const [form, setForm] = useState<EditorForm>(() => toEditorForm(initial));
  const [previewOpen, setPreviewOpen] = useState(false);

  const draft = toSurveyDraft(form);
  const groups = publishProblemGroups(draft, today);
  const published = state !== "draft";
  const actions = useBuilderActions({ surveyId, published, draft, today });

  const change = (patch: Partial<EditorForm>) => {
    actions.clearErrors();
    setForm((current) => ({ ...current, ...patch }));
  };
  const buttons = {
    published,
    pending: actions.pending,
    canPreview: form.questions.length > 0,
    onPreview: () => setPreviewOpen(true),
    onSave: actions.save,
    onPublish: actions.publish,
    onBackToDraft: actions.backToDraft,
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            href="/admin/surveys"
            className="mb-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            סקרים
            <ChevronLeft aria-hidden="true" className="size-3.5" />
          </Link>
          <h1 className="flex items-center gap-3 text-3xl font-bold">
            {actions.savedId === null ? "סקר חדש" : "עריכת סקר"}
            <SurveyStateBadge state={state} />
          </h1>
        </div>
        <div className="hidden items-center gap-2 lg:flex">
          <BuilderActions variant="header" {...buttons} />
        </div>
      </header>

      {actions.errors.length > 0 && <BuilderErrors errors={actions.errors} />}

      <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start">
        <SettingsColumn
          form={form}
          branches={branches}
          groups={groups}
          today={today}
          attempted={actions.attempted}
          onChange={change}
        />
        <QuestionListEditor
          questions={form.questions}
          showProblems={actions.attempted}
          onChange={(questions) => change({ questions })}
        />
      </div>

      {actions.savedId !== null && <DeleteSurveyButton surveyId={actions.savedId} />}

      <div className="sticky bottom-0 z-20 -mx-4 border-t bg-background/95 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] backdrop-blur-sm lg:hidden">
        <div className="flex items-center gap-2">
          <BuilderActions variant="bar" {...buttons} />
        </div>
      </div>

      <SurveyPopup
        survey={previewSurvey(draft)}
        firstName={PREVIEW_FIRST_NAME}
        mode="preview"
        open={previewOpen}
        onOpenChange={setPreviewOpen}
      />
    </div>
  );
}
