"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Info, Lock, Users } from "lucide-react";
import { toast } from "sonner";

import { updateSurveyDetailsAction } from "../../lib/actions/update-survey-details";
import { answeredText, audienceText } from "../../lib/format";
import { reopensEndedSurvey, surveyState } from "../../lib/state";
import type { SurveyQuestion, SurveyRecord } from "../../lib/types";
import { BuilderErrors } from "./BuilderErrors";
import { DateField } from "./DateField";
import { LockedActions } from "./LockedActions";
import { LockedQuestionRows } from "./LockedQuestionRows";
import { SurveyDetailsFields } from "./SurveyDetailsFields";
import { SurveyStateBadge } from "./SurveyStateBadge";
import { REQUEST_FAILED } from "./builder-messages";

export interface LockedSurveyEditorProps {
  record: SurveyRecord;
  questions: readonly SurveyQuestion[];
  /** At least one: the Survey is locked because someone answered. */
  responseCount: number;
  /** The names of the Survey's branches, for the audience line. */
  branchNames: readonly string[];
  today: string;
}

const REOPEN_HINT = "סקר שנסגר לפי תאריך נפתח שוב עד התאריך החדש.";

const blankToNull = (value: string): string | null => (value.trim() === "" ? null : value);

/** What was saved, or the reason it was not. A request that throws reads as a failed save. */
async function saveDetails(
  surveyId: string,
  details: { title: string; intro: string | null; closesOn: string | null },
): Promise<string | null> {
  try {
    const result = await updateSurveyDetailsAction(surveyId, details);
    return "error" in result ? result.error : null;
  } catch {
    return REQUEST_FAILED.save;
  }
}

/**
 * The editor for a Survey somebody has answered. The Questions and the
 * audience are shown as they are, locked so the results stay comparable;
 * the title, intro and close date can still change. A new close date that
 * reopens a Survey which ended by date says so.
 */
export function LockedSurveyEditor({ record, questions, responseCount, branchNames, today }: LockedSurveyEditorProps) {
  const router = useRouter();
  const [title, setTitle] = useState(record.title);
  const [intro, setIntro] = useState(record.intro ?? "");
  const [closesOn, setClosesOn] = useState(record.closesOn ?? "");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const edited = (apply: () => void) => {
    setErrors([]);
    apply();
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setErrors([]);
    const problem = await saveDetails(record.id, {
      title,
      intro: blankToNull(intro),
      closesOn: closesOn === "" ? null : closesOn,
    });
    setSaving(false);
    if (problem !== null) return setErrors([problem]);
    toast.success("השינויים נשמרו");
    router.refresh();
  };

  const reopens = reopensEndedSurvey(record, closesOn === "" ? null : closesOn, today);
  const actions = (grow: boolean) => (
    <LockedActions surveyId={record.id} saving={saving} grow={grow} onSave={save} />
  );

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
            עריכת סקר
            <SurveyStateBadge state={surveyState(record, today)} />
          </h1>
        </div>
        <div className="hidden items-center gap-2 lg:flex">{actions(false)}</div>
      </header>

      {errors.length > 0 && <BuilderErrors errors={errors} />}

      <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start">
        <section
          aria-label="פרטי הסקר"
          className="flex flex-col gap-3.5 rounded-xl border bg-card px-4 py-4 shadow-sm lg:sticky lg:top-4 lg:px-[18px]"
        >
          <div className="flex gap-2.5 rounded-lg bg-info/10 p-3 text-[13px] leading-relaxed">
            <Info aria-hidden="true" className="mt-0.5 size-4 flex-none text-info" />
            <p>
              <strong>{answeredText(responseCount)}.</strong> השאלות והקהל נעולים כדי שהתוצאות יישארו
              השוואתיות. אפשר לשנות כותרת, פתיח ותאריך סגירה.
            </p>
          </div>
          <SurveyDetailsFields
            idPrefix="locked"
            title={title}
            intro={intro}
            onTitleChange={(next) => edited(() => setTitle(next))}
            onIntroChange={(next) => edited(() => setIntro(next))}
          />
          <DateField
            id="locked-closes-on"
            label="נסגר"
            optional
            value={closesOn}
            hint={reopens ? REOPEN_HINT : undefined}
            onChange={(next) => edited(() => setClosesOn(next))}
          />
        </section>

        <div className="space-y-4">
          <section aria-label="למי נשלח" className="rounded-xl border bg-muted/40 px-4 py-3.5 lg:px-[18px]">
            <h2 className="flex items-center gap-2 text-sm font-bold">
              <Users aria-hidden="true" className="size-4" />
              למי נשלח
              <Lock aria-hidden="true" className="ms-auto size-3.5 text-muted-foreground" />
            </h2>
            <p className="mt-1.5 text-[13px] text-muted-foreground">
              {audienceText(branchNames, record.birthYears)}
            </p>
          </section>
          <section aria-labelledby="locked-questions" className="rounded-xl border bg-card px-4 py-3.5 shadow-sm lg:px-[18px]">
            <h2 id="locked-questions" className="mb-1 text-[15px] font-bold">
              שאלות{" "}
              <span className="font-normal text-muted-foreground">
                ({questions.length}, נעולות)
              </span>
            </h2>
            <LockedQuestionRows questions={questions} />
          </section>
        </div>
      </div>

      <div className="sticky bottom-0 z-20 -mx-4 border-t bg-background/95 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] backdrop-blur-sm lg:hidden">
        <div className="flex items-center gap-2">{actions(true)}</div>
      </div>
    </div>
  );
}
