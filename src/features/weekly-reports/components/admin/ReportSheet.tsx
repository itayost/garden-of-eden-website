"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useLastShown } from "@/features/surveys/components/admin/useLastShown";
import type { ReportDetail } from "../../lib/queries/queue";
import { reportWeekLabel } from "../../lib/report-week";
import { FactSheetView } from "./FactSheetView";
import { ReportEditor } from "./ReportEditor";
import { StatusChip } from "./StatusChip";

interface ReportSheetProps {
  /** The report in ?report=, already checked against the caller's scope; null when none is open. */
  report: ReportDetail | null;
  /** The queue's URL without ?report=. */
  closeHref: string;
}

/**
 * One report: the Fact sheet on one side and the texts with their actions on
 * the other (stacked on a phone, texts first). Full width on a phone.
 */
export function ReportSheet({ report, closeHref }: ReportSheetProps) {
  const router = useRouter();
  const shown = useLastShown(report);
  // Closes at once, before the URL without ?report= has loaded.
  const [closedId, setClosedId] = useState<string | null>(null);
  if (report === null && closedId !== null) setClosedId(null);
  const open = report !== null && report.id !== closedId;

  function close() {
    if (report) setClosedId(report.id);
    router.replace(closeHref, { scroll: false });
  }

  return (
    <Sheet open={open} onOpenChange={(next) => !next && close()}>
      <SheetContent side="left" className="w-full gap-0 overflow-y-auto sm:max-w-2xl lg:max-w-5xl">
        {shown !== null && (
          <>
            <SheetHeader className="border-b pe-12 text-start">
              <SheetTitle className="text-base font-bold">{shown.fullName}</SheetTitle>
              <SheetDescription className="text-xs">
                {[
                  shown.kind === "missed_you" ? "התגעגענו" : "דוח שבועי",
                  reportWeekLabel(shown.weekStart),
                  shown.branchNames.join(", "),
                ]
                  .filter((part) => part !== "")
                  .join(" · ")}
              </SheetDescription>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <StatusChip status={shown.status} />
                {shown.parentOutcome && <span className="text-muted-foreground">{shown.parentOutcome}</span>}
                <Link
                  href={`/admin/users/${shown.traineeId}`}
                  className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                >
                  <ExternalLink className="size-3.5" aria-hidden="true" />
                  לדף החניך
                </Link>
              </div>
            </SheetHeader>
            <div className="grid gap-6 p-4 lg:grid-cols-2">
              <div>
                {/* A new row, or a text written again, starts the form afresh. */}
                <ReportEditor key={`${shown.id}:${shown.writtenAt ?? ""}`} report={shown} onDone={close} />
              </div>
              {shown.stored && (
                <aside className="space-y-3 rounded-lg bg-muted/40 p-4 lg:order-first">
                  <h2 className="text-sm font-bold">דף העובדות</h2>
                  <FactSheetView sheet={shown.stored.sheet} body={shown.stored.body} />
                </aside>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
