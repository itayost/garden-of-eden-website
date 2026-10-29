"use client";

import { useState } from "react";
import { Calendar, CircleCheck, ListChecks, TriangleAlert, Users } from "lucide-react";

import type { BranchOption } from "@/types/branches";
import type { EditorForm } from "../../lib/editor-model";
import { audienceSummary, datesSummary, fixCountText, reachCount } from "../../lib/format";
import type { PublishProblemGroups } from "../../lib/publish";
import { AudiencePicker } from "./AudiencePicker";
import { CollapsibleSection } from "./CollapsibleSection";
import { DateField } from "./DateField";
import { PublishChecklist } from "./PublishChecklist";
import { SurveyDetailsFields } from "./SurveyDetailsFields";
import { useAudienceYears } from "./useAudienceYears";

interface SettingsColumnProps {
  form: EditorForm;
  branches: readonly BranchOption[];
  groups: PublishProblemGroups;
  today: string;
  /** Publishing was tried, so a phone shows the checklist instead of its summary. */
  attempted: boolean;
  onChange: (patch: Partial<EditorForm>) => void;
}

const SECTION_ICON = "size-4";

const problemTotal = (groups: PublishProblemGroups): number =>
  groups.basics.length + groups.questions.length + groups.dates.length;

/** The checklist's one line on a phone: ready, or how much is left. */
function ChecklistSummary({ count }: { count: number }) {
  const Icon = count === 0 ? CircleCheck : TriangleAlert;
  return (
    <span className={count === 0 ? "flex items-center gap-1.5" : "flex items-center gap-1.5 text-destructive"}>
      <Icon aria-hidden="true" className="size-4" />
      {count === 0 ? "מוכן לפרסום" : fixCountText(count)}
    </span>
  );
}

/**
 * The settings beside the Questions: details, audience, dates and the
 * publish checklist. It is a sticky card from lg; on a phone the last three
 * fold to a line each. The Audience's head counts are read here because the
 * folded line and the picker both show them.
 */
export function SettingsColumn({ form, branches, groups, today, attempted, onChange }: SettingsColumnProps) {
  const audience = useAudienceYears(form.branchIds);
  const [audienceOpen, setAudienceOpen] = useState(form.branchIds.length === 0);
  const [datesOpen, setDatesOpen] = useState(false);
  const [checkOpen, setCheckOpen] = useState(false);

  const branchNames = branches.filter((branch) => form.branchIds.includes(branch.id)).map((b) => b.nameHe);
  const reach =
    audience.status === "ready" ? reachCount(form.birthYears, audience.years, audience.total) : null;
  const count = problemTotal(groups);

  return (
    <aside
      aria-label="הגדרות הסקר"
      className="overflow-hidden rounded-xl border bg-card shadow-sm lg:sticky lg:top-4"
    >
      <section className="flex flex-col gap-3.5 px-4 py-3.5 lg:px-[18px] lg:py-4">
        <h3 className="hidden text-sm font-bold lg:block">פרטים</h3>
        <SurveyDetailsFields
          idPrefix="builder"
          title={form.title}
          intro={form.intro ?? ""}
          onTitleChange={(title) => onChange({ title })}
          onIntroChange={(intro) => onChange({ intro: intro === "" ? null : intro })}
        />
      </section>
      <CollapsibleSection
        title="למי נשלח"
        icon={<Users aria-hidden="true" className={SECTION_ICON} />}
        summary={audienceSummary(branchNames, form.birthYears, reach)}
        open={audienceOpen}
        onToggle={() => setAudienceOpen(!audienceOpen)}
      >
        <AudiencePicker
          branches={branches}
          branchIds={form.branchIds}
          birthYears={form.birthYears}
          audience={audience}
          onBranchesChange={(branchIds) => onChange({ branchIds })}
          onYearsChange={(birthYears) => onChange({ birthYears })}
        />
      </CollapsibleSection>
      <CollapsibleSection
        title="תאריכים"
        icon={<Calendar aria-hidden="true" className={SECTION_ICON} />}
        summary={datesSummary(form.opensOn, form.closesOn)}
        open={datesOpen}
        onToggle={() => setDatesOpen(!datesOpen)}
      >
        <div className="grid grid-cols-2 gap-2.5">
          <DateField
            id="builder-opens-on"
            label="נפתח"
            value={form.opensOn}
            onChange={(opensOn) => opensOn !== "" && onChange({ opensOn })}
          />
          <DateField
            id="builder-closes-on"
            label="נסגר"
            optional
            value={form.closesOn ?? ""}
            min={form.opensOn > today ? form.opensOn : today}
            onChange={(closesOn) => onChange({ closesOn: closesOn === "" ? null : closesOn })}
          />
        </div>
      </CollapsibleSection>
      <CollapsibleSection
        title="לפני פרסום"
        icon={<ListChecks aria-hidden="true" className={SECTION_ICON} />}
        summary={<ChecklistSummary count={count} />}
        open={checkOpen || (attempted && count > 0)}
        onToggle={() => setCheckOpen(!checkOpen)}
      >
        <PublishChecklist groups={groups} questionCount={form.questions.length} />
      </CollapsibleSection>
    </aside>
  );
}
