import { Lock } from "lucide-react";

import type { SurveyQuestion } from "../../lib/types";
import { KIND_META } from "./kind-meta";

/** The Questions of a Survey that has Responses: what they say and what kind they are, none of it editable. */
export function LockedQuestionRows({ questions }: { questions: readonly SurveyQuestion[] }) {
  return (
    <ol>
      {questions.map((question, index) => {
        const { Icon, label } = KIND_META[question.kind];
        return (
          <li key={question.id} className="flex items-center gap-3 border-t py-3 first:border-t-0">
            <span className="grid size-6 flex-none place-items-center rounded-[7px] bg-secondary text-xs font-bold text-secondary-foreground">
              {index + 1}
            </span>
            <Icon aria-hidden="true" className="size-[15px] flex-none text-muted-foreground" />
            <span className="min-w-0 flex-1 text-sm text-muted-foreground">
              <span className="block">{question.text}</span>
              <span className="block text-xs">
                {label}
                {question.required ? "" : " · לא חובה"}
              </span>
            </span>
            <Lock aria-hidden="true" className="size-3.5 flex-none text-muted-foreground" />
          </li>
        );
      })}
    </ol>
  );
}
