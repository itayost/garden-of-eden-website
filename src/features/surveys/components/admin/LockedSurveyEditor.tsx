"use client";

import { surveyState } from "../../lib/state";
import type { SurveyQuestion, SurveyRecord } from "../../lib/types";
import { BuilderErrors } from "./BuilderErrors";
import { EditorHeader } from "./EditorHeader";
import { LockedActions } from "./LockedActions";
import { LockedDetailsPanel } from "./LockedDetailsPanel";
import { LockedReadOnlyPanels } from "./LockedReadOnlyPanels";
import { StickyActionBar } from "./StickyActionBar";
import { useLockedDetails } from "./useLockedDetails";

export interface LockedSurveyEditorProps {
  record: SurveyRecord;
  questions: readonly SurveyQuestion[];
  /** At least one: the Survey is locked because someone answered. */
  responseCount: number;
  /** The names of the Survey's branches, for the audience line. */
  branchNames: readonly string[];
  today: string;
}

/**
 * The editor for a Survey somebody has answered. The Questions and the
 * audience are shown as they are, locked so the results stay comparable;
 * the title, intro and close date can still change. A new close date that
 * reopens a Survey which ended by date says so.
 */
export function LockedSurveyEditor({ record, questions, responseCount, branchNames, today }: LockedSurveyEditorProps) {
  const details = useLockedDetails(record, today);
  const state = surveyState(record, today);
  const actions = (grow: boolean) => (
    <LockedActions
      surveyId={record.id}
      canClose={state === "open"}
      saving={details.saving}
      grow={grow}
      onSave={details.save}
    />
  );

  return (
    <div className="space-y-5">
      <EditorHeader title="עריכת סקר" state={state} actions={actions(false)} />
      {details.errors.length > 0 && <BuilderErrors errors={details.errors} />}
      <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start">
        <LockedDetailsPanel
          responseCount={responseCount}
          values={details.values}
          reopens={details.reopens}
          onEdit={details.edit}
        />
        <LockedReadOnlyPanels branchNames={branchNames} birthYears={record.birthYears} questions={questions} />
      </div>
      <StickyActionBar>{actions(true)}</StickyActionBar>
    </div>
  );
}
