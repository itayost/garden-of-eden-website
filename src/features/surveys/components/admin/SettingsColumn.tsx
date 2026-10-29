"use client";

import type { BranchOption } from "@/types/branches";
import type { EditorForm } from "../../lib/editor-model";
import type { PublishProblemGroups } from "../../lib/publish";
import { AudienceSection, ChecklistSection, DatesSection, DetailsSection } from "./SettingsSections";

interface SettingsColumnProps {
  form: EditorForm;
  branches: readonly BranchOption[];
  groups: PublishProblemGroups;
  today: string;
  /** Publishing was tried, so a phone shows the checklist instead of its summary. */
  attempted: boolean;
  onChange: (patch: Partial<EditorForm>) => void;
}

/**
 * The settings beside the Questions: details, audience, dates and the
 * publish checklist. It is a sticky card from lg; on a phone the last three
 * fold to a line each.
 */
export function SettingsColumn({ form, branches, groups, today, attempted, onChange }: SettingsColumnProps) {
  return (
    <aside
      aria-label="הגדרות הסקר"
      className="overflow-hidden rounded-xl border bg-card shadow-sm lg:sticky lg:top-4"
    >
      <DetailsSection form={form} onChange={onChange} />
      <AudienceSection form={form} branches={branches} onChange={onChange} />
      <DatesSection form={form} today={today} onChange={onChange} />
      <ChecklistSection groups={groups} questionCount={form.questions.length} attempted={attempted} />
    </aside>
  );
}
