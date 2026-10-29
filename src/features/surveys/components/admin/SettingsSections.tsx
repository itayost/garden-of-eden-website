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

type FormChange = (patch: Partial<EditorForm>) => void;

const SECTION_ICON = "size-4";

/** Title and intro. Not folded: a Survey is nothing without them. */
export function DetailsSection({ form, onChange }: { form: EditorForm; onChange: FormChange }) {
  return (
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
  );
}

interface AudienceSectionProps {
  form: EditorForm;
  branches: readonly BranchOption[];
  onChange: FormChange;
}

/**
 * Branches and birth years. It reads the head counts itself, because the
 * folded line on a phone and the picker both show them. Open at the start
 * only while no branch is chosen.
 */
export function AudienceSection({ form, branches, onChange }: AudienceSectionProps) {
  const audience = useAudienceYears(form.branchIds);
  const [open, setOpen] = useState(form.branchIds.length === 0);
  const names = branches.filter((branch) => form.branchIds.includes(branch.id)).map((b) => b.nameHe);
  const reach =
    audience.status === "ready" ? reachCount(form.birthYears, audience.years, audience.total) : null;

  return (
    <CollapsibleSection
      title="למי נשלח"
      icon={<Users aria-hidden="true" className={SECTION_ICON} />}
      summary={audienceSummary(names, form.birthYears, reach)}
      open={open}
      onToggle={() => setOpen(!open)}
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
  );
}

/** When the Survey opens and, optionally, when it closes. */
export function DatesSection({ form, today, onChange }: { form: EditorForm; today: string; onChange: FormChange }) {
  const [open, setOpen] = useState(false);
  return (
    <CollapsibleSection
      title="תאריכים"
      icon={<Calendar aria-hidden="true" className={SECTION_ICON} />}
      summary={datesSummary(form.opensOn, form.closesOn)}
      open={open}
      onToggle={() => setOpen(!open)}
    >
      <div className="grid grid-cols-2 gap-2.5">
        <DateField
          id="builder-opens-on"
          label="נפתח"
          value={form.opensOn}
          onChange={(opensOn) => {
            if (opensOn !== "") onChange({ opensOn });
          }}
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
  );
}

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

interface ChecklistSectionProps {
  groups: PublishProblemGroups;
  questionCount: number;
  /** Publishing was tried, so a phone shows the checklist instead of its summary. */
  attempted: boolean;
}

/** What still stands between the draft and publishing. */
export function ChecklistSection({ groups, questionCount, attempted }: ChecklistSectionProps) {
  const [open, setOpen] = useState(false);
  const count = problemTotal(groups);
  return (
    <CollapsibleSection
      title="לפני פרסום"
      icon={<ListChecks aria-hidden="true" className={SECTION_ICON} />}
      summary={<ChecklistSummary count={count} />}
      open={open || (attempted && count > 0)}
      onToggle={() => setOpen(!open)}
    >
      <PublishChecklist groups={groups} questionCount={questionCount} />
    </CollapsibleSection>
  );
}
