import { CircleCheck, TriangleAlert } from "lucide-react";

import { questionCountLabel } from "../../lib/format";
import type { PublishProblemGroups } from "../../lib/publish";

interface PublishChecklistProps {
  /** What publishProblem finds, by part of the form; an empty part passes. */
  groups: PublishProblemGroups;
  questionCount: number;
}

function Passed({ children }: { children: string }) {
  return (
    <li className="flex items-center gap-2">
      <CircleCheck aria-hidden="true" className="size-[15px] flex-none text-success" />
      {children}
    </li>
  );
}

function Problem({ children }: { children: string }) {
  return (
    <li className="flex items-start gap-2 text-destructive">
      <TriangleAlert aria-hidden="true" className="mt-0.5 size-[15px] flex-none" />
      {children}
    </li>
  );
}

/** One row for a part: a check when it passes, otherwise each of its problems in red. */
function Part({ problems, passed }: { problems: readonly string[]; passed: string }) {
  if (problems.length === 0) return <Passed>{passed}</Passed>;
  return (
    <>
      {problems.map((problem) => (
        <Problem key={problem}>{problem}</Problem>
      ))}
    </>
  );
}

/**
 * What still stands between the draft and publishing, as it is now: a check
 * for each part that is ready and each problem in red. It reads the same
 * rules the server applies, so what passes here publishes.
 */
export function PublishChecklist({ groups, questionCount }: PublishChecklistProps) {
  return (
    <ul aria-label="לפני פרסום" className="flex flex-col gap-2 text-[13px]">
      <Part problems={groups.basics} passed="כותרת וקהל" />
      <Part problems={groups.questions} passed={questionCountLabel(questionCount)} />
      <Part problems={groups.dates} passed="תאריכים" />
    </ul>
  );
}
