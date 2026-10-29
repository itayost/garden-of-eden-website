import { Lock, Users } from "lucide-react";

import { audienceText } from "../../lib/format";
import type { SurveyQuestion } from "../../lib/types";
import { LockedQuestionRows } from "./LockedQuestionRows";

interface LockedReadOnlyPanelsProps {
  /** The names of the Survey's branches, for the audience line. */
  branchNames: readonly string[];
  birthYears: readonly number[];
  questions: readonly SurveyQuestion[];
}

/** The audience and the Questions of a Survey that has Responses, shown as they are, with a lock. */
export function LockedReadOnlyPanels({ branchNames, birthYears, questions }: LockedReadOnlyPanelsProps) {
  return (
    <div className="space-y-4">
      <section aria-label="למי נשלח" className="rounded-xl border bg-muted/40 px-4 py-3.5 lg:px-[18px]">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <Users aria-hidden="true" className="size-4" />
          למי נשלח
          <Lock aria-hidden="true" className="ms-auto size-3.5 text-muted-foreground" />
        </h2>
        <p className="mt-1.5 text-[13px] text-muted-foreground">{audienceText(branchNames, birthYears)}</p>
      </section>
      <section
        aria-labelledby="locked-questions"
        className="rounded-xl border bg-card px-4 py-3.5 shadow-sm lg:px-[18px]"
      >
        <h2 id="locked-questions" className="mb-1 text-[15px] font-bold">
          שאלות <span className="font-normal text-muted-foreground">({questions.length}, נעולות)</span>
        </h2>
        <LockedQuestionRows questions={questions} />
      </section>
    </div>
  );
}
