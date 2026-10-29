"use client";

import { useState } from "react";

import type { BranchOption } from "@/types/branches";
import { previewSurvey } from "../../lib/draft";
import { toEditorForm, toSurveyDraft, type EditorForm } from "../../lib/editor-model";
import { publishProblemGroups } from "../../lib/publish";
import type { SurveyDraft, SurveyState } from "../../lib/types";
import { SurveyPopup } from "../trainee/SurveyPopup";
import { BuilderActions } from "./BuilderActions";
import { BuilderErrors } from "./BuilderErrors";
import { DeleteSurveyButton } from "./DeleteSurveyButton";
import { EditorHeader } from "./EditorHeader";
import { QuestionListEditor } from "./QuestionListEditor";
import { SettingsColumn } from "./SettingsColumn";
import { StickyActionBar } from "./StickyActionBar";
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

interface WorkspaceProps {
  form: EditorForm;
  branches: readonly BranchOption[];
  today: string;
  attempted: boolean;
  onChange: (patch: Partial<EditorForm>) => void;
}

/** The settings column beside the Questions. The checklist is judged here, from the form as it stands. */
function BuilderWorkspace({ form, branches, today, attempted, onChange }: WorkspaceProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start">
      <SettingsColumn
        form={form}
        branches={branches}
        groups={publishProblemGroups(toSurveyDraft(form), today)}
        today={today}
        attempted={attempted}
        onChange={onChange}
      />
      <QuestionListEditor
        questions={form.questions}
        showProblems={attempted}
        onChange={(questions) => onChange({ questions })}
      />
    </div>
  );
}

interface PreviewProps {
  draft: SurveyDraft;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** The draft in the Trainee's popup. The preview mode sends nothing. */
function BuilderPreview({ draft, open, onOpenChange }: PreviewProps) {
  return (
    <SurveyPopup
      survey={previewSurvey(draft)}
      firstName={PREVIEW_FIRST_NAME}
      mode="preview"
      open={open}
      onOpenChange={onOpenChange}
    />
  );
}

/**
 * The Survey builder: settings and the publish checklist beside the Questions
 * from lg, one column with a bar of actions pinned to the bottom on a phone.
 * Everything is edited in one working copy and saved together.
 */
export function SurveyBuilder({ surveyId, initial, state, branches, today }: SurveyBuilderProps) {
  const [form, setForm] = useState<EditorForm>(() => toEditorForm(initial));
  const [previewOpen, setPreviewOpen] = useState(false);
  const draft = toSurveyDraft(form);
  const published = state !== "draft";
  const actions = useBuilderActions({ surveyId, published, draft, today });

  const change = (patch: Partial<EditorForm>) => {
    actions.clearErrors();
    setForm((current) => ({ ...current, ...patch }));
  };
  const buttons = (variant: "header" | "bar") => (
    <BuilderActions
      variant={variant}
      published={published}
      canPreview={form.questions.length > 0}
      onPreview={() => setPreviewOpen(true)}
      actions={actions}
    />
  );

  return (
    <div className="space-y-5">
      <EditorHeader
        title={actions.savedId === null ? "סקר חדש" : "עריכת סקר"}
        state={state}
        actions={buttons("header")}
      />
      {actions.errors.length > 0 && <BuilderErrors errors={actions.errors} />}
      <BuilderWorkspace
        form={form}
        branches={branches}
        today={today}
        attempted={actions.attempted}
        onChange={change}
      />
      {actions.savedId !== null && <DeleteSurveyButton surveyId={actions.savedId} />}
      <StickyActionBar>{buttons("bar")}</StickyActionBar>
      <BuilderPreview draft={draft} open={previewOpen} onOpenChange={setPreviewOpen} />
    </div>
  );
}
