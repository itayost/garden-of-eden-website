import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import type { SurveyState } from "../../lib/types";
import { SurveyStateBadge } from "./SurveyStateBadge";

interface EditorHeaderProps {
  title: string;
  state: SurveyState;
  /** The labelled buttons, shown from lg; a phone has its sticky bar instead. */
  actions: ReactNode;
}

/** The top of both editors: the way back to the list, the heading with its state, and the actions. */
export function EditorHeader({ title, state, actions }: EditorHeaderProps) {
  return (
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
          {title}
          <SurveyStateBadge state={state} />
        </h1>
      </div>
      <div className="hidden items-center gap-2 lg:flex">{actions}</div>
    </header>
  );
}
