"use client";

import { useEffect, useRef, useState } from "react";
import { FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { markReportReadAction } from "../../lib/actions/player";
import type { PlayerReport } from "../../lib/queries/player";
import { reportWeekLabel } from "../../lib/report-week";
import { BodyBlock } from "../report/BodyBlock";
import { DrillList } from "../report/DrillList";
import { GoalProgressList } from "../report/GoalProgressList";

type SentReport = Extract<PlayerReport, { kind: "report" }>;

/**
 * Whether the text is cut at its four lines now. Measured after layout and on
 * every resize; from the `sm` breakpoint the text is never cut.
 */
function useClamped(ref: React.RefObject<HTMLElement | null>, expanded: boolean): boolean {
  const [clamped, setClamped] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element || expanded) return;
    const measure = () => setClamped(element.scrollHeight > element.clientHeight + 1);
    const frame = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", measure);
    };
  }, [ref, expanded]);
  return clamped && !expanded;
}

/**
 * The player's sent Weekly report on the dashboard: the week's text, the
 * Goals, the chosen drills (each linking to its book page) and the
 * measurement when there was one. On a phone the text starts at
 * four lines with "קרא עוד". Opening the dashboard records the first read.
 */
export function WeeklyReportCard({ report }: { report: SentReport }) {
  const textRef = useRef<HTMLParagraphElement>(null);
  const marked = useRef(false);
  const [expanded, setExpanded] = useState(false);
  const clamped = useClamped(textRef, expanded);

  useEffect(() => {
    if (marked.current || report.opened) return;
    marked.current = true;
    // The stamp is for staff; a failure changes nothing the player sees.
    markReportReadAction({ reportId: report.id }).catch(() => undefined);
  }, [report.id, report.opened]);

  return (
    <Card>
      <CardContent className="space-y-5 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-forest/10 text-forest">
            <FileText className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="text-sm">
            <h2 className="font-bold">הדוח השבועי שלך</h2>
            <p className="text-muted-foreground">{reportWeekLabel(report.weekStart)}</p>
          </div>
        </div>

        <div>
          <p
            ref={textRef}
            className={cn("whitespace-pre-line text-[15px] leading-7", !expanded && "line-clamp-4 sm:line-clamp-none")}
          >
            {report.text}
          </p>
          {clamped && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="min-h-10 text-sm font-bold text-forest underline-offset-4 hover:underline sm:hidden"
            >
              קרא עוד
            </button>
          )}
        </div>

        <GoalProgressList goals={report.goals} title="היעדים שלך" />
        <DrillList drills={report.drills} linkToBook />
        {report.body && <BodyBlock body={report.body} />}
      </CardContent>
    </Card>
  );
}
