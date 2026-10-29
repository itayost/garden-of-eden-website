import type { ReactNode } from "react";
import Link from "next/link";
import { CalendarClock, ChevronLeft, Users } from "lucide-react";

import type { SurveyState } from "../../lib/types";
import { SurveyStateBadge } from "./SurveyStateBadge";

interface SurveyResultsHeaderProps {
  title: string;
  state: SurveyState;
  /** "חיפה, קריית אתא · ילידי 2013 עד 2015". */
  audience: string;
  /** "22.10 עד 5.11 · נשארו 7 ימים". */
  dates: string;
  /** The buttons the viewer may use. */
  actions: ReactNode;
}

/** The top of the results: the way back, the title with its state, who and when, and the actions. */
export function SurveyResultsHeader({ title, state, audience, dates, actions }: SurveyResultsHeaderProps) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <Link
          href="/admin/surveys"
          className="mb-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          סקרים
          <ChevronLeft aria-hidden="true" className="size-3.5" />
        </Link>
        <h1 className="flex flex-wrap items-center gap-x-3 gap-y-1 break-words text-2xl font-bold md:text-3xl">
          {title}
          <SurveyStateBadge state={state} />
        </h1>
        <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {audience !== "" && (
            <span className="inline-flex items-center gap-1.5">
              <Users aria-hidden="true" className="size-4" />
              {audience}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5">
            <CalendarClock aria-hidden="true" className="size-4" />
            {dates}
          </span>
        </p>
      </div>
      {actions}
    </header>
  );
}
