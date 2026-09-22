"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, CalendarDays, Check, ChevronLeft, ChevronRight, Dumbbell, HeartPulse, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useCurrentBranch } from "@/features/branches/components/BranchContext";
import { BranchSwitcher } from "@/features/branches/components/BranchSwitcher";
import { HealthSheet } from "@/features/plans/components/HealthSheet";
import { PlanSheet } from "@/features/plans/components/staff/PlanSheet";
import { filterWorklist, worklistProgress, type WorklistGroup, type WorklistRow } from "@/lib/schedule/session-worklist";
import { cn } from "@/lib/utils";
import { hebrewWeekday } from "@/lib/utils/date";
import { addDays, shortDate } from "@/lib/utils/iso-date";
import { trainerColor } from "@/lib/utils/trainer-color";
import { STAFF_PLAN_CHIP } from "@/lib/plans/status-styles";
import type { StaffPlanBadge } from "@/types/plans";

const STATUS: Record<WorklistRow["status"], { label: (row: WorklistRow) => string; className: string; Icon: typeof Plus }> = {
  not_built: { label: () => "לא נבנה", className: "bg-secondary text-secondary-foreground", Icon: Plus },
  built: { label: (row) => `נבנה · ${row.exerciseCount} תרגילים`, className: "bg-primary text-primary-foreground", Icon: Dumbbell },
  completed: { label: () => "הושלם", className: "bg-success text-success-foreground", Icon: Check },
};

interface SessionWorklistProps {
  date: string;
  today: string;
  groups: WorklistGroup[];
  planBadges: Record<string, StaffPlanBadge>;
  loadError: string | null;
  /** Session statuses failed to load; every row would wrongly read "לא נבנה". */
  summariesFailed: boolean;
  currentUserId: string;
  isAdmin: boolean;
  mineOnly: boolean;
  pendingOnly: boolean;
}

/**
 * בניית אימונים: every rostered trainee for one day and whether their session
 * is built. Rosters are changed in the calendar, never here.
 */
export function SessionWorklist({
  date,
  today,
  groups,
  planBadges,
  loadError,
  summariesFailed,
  currentUserId,
  isAdmin,
  mineOnly,
  pendingOnly,
}: SessionWorklistProps) {
  const { branchId } = useCurrentBranch();
  const [planFor, setPlanFor] = useState<{ id: string; name: string } | null>(null);
  const [healthFor, setHealthFor] = useState<{ id: string; name: string } | null>(null);

  const hrefFor = (next: { date?: string; mine?: boolean; pending?: boolean }) => {
    const params = new URLSearchParams({ date: next.date ?? date, branch: branchId });
    if (next.mine ?? mineOnly) params.set("mine", "1");
    if (next.pending ?? pendingOnly) params.set("pending", "1");
    return `/admin/schedule?${params.toString()}`;
  };
  const calendarHref = `/admin/calendar?date=${date}&branch=${branchId}`;

  const progress = worklistProgress(groups);
  const visible = filterWorklist(groups, { mineOnly, pendingOnly, currentUserId });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon" asChild aria-label="יום קודם">
          <Link href={hrefFor({ date: addDays(date, -1) })}>
            <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
        <span className="flex items-center gap-2 px-1 font-display text-xl">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          {hebrewWeekday(date)} · {shortDate(date)}
        </span>
        <Button variant="outline" size="icon" asChild aria-label="יום הבא">
          <Link href={hrefFor({ date: addDays(date, 1) })}>
            <ChevronLeft className="h-4 w-4" />
          </Link>
        </Button>
        {date !== today && (
          <Button variant="ghost" size="sm" asChild>
            <Link href={hrefFor({ date: today })}>היום</Link>
          </Button>
        )}
        <BranchSwitcher />
      </div>

      {loadError ? (
        <Card className="border-destructive">
          <CardContent className="py-12 text-center text-destructive">{loadError}</CardContent>
        </Card>
      ) : groups.length === 0 ? (
        <EmptyState text="אין סלוטים ליום זה" calendarHref={calendarHref} />
      ) : progress.total === 0 ? (
        <EmptyState text="אין מתאמנים לבנות להם אימון" calendarHref={calendarHref} />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <p className="font-display text-lg tabular-nums">
              {progress.built} מתוך {progress.total} נבנו
            </p>
            <div className="flex gap-1.5" role="group" aria-label="סינון">
              <FilterLink href={hrefFor({ mine: !mineOnly })} active={mineOnly} label="רק שלי" />
              <FilterLink href={hrefFor({ pending: !pendingOnly })} active={pendingOnly} label="רק לא נבנו" />
            </div>
          </div>

          {summariesFailed && (
            <p className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              סטטוס האימונים לא נטען. ייתכן שחלק מהאימונים כבר נבנו.
            </p>
          )}

          {visible.length === 0 ? (
            <p className="rounded-xl border border-dashed py-8 text-center text-sm text-muted-foreground">
              אין תוצאות לסינון הזה
            </p>
          ) : (
            <div className="space-y-4">
              {visible.map((group) => {
                const palette = trainerColor(group.trainerId);
                return (
                  <section key={group.slotId} className="overflow-hidden rounded-2xl border">
                    <header className={cn("flex flex-wrap items-center gap-2 px-4 py-2", palette.bg)}>
                      <span className="font-display text-lg tabular-nums text-forest">{group.startTime}</span>
                      <span className={cn("h-2.5 w-2.5 rounded-full", palette.dot)} aria-hidden="true" />
                      <span className={cn("font-extrabold", palette.text)}>{group.trainerName ?? "ללא מאמן"}</span>
                      {group.locationHe && <span className="text-xs text-muted-foreground">{group.locationHe}</span>}
                    </header>
                    {/* Same row as the calendar's roster sheet, so the group's
                        workout is reachable from wherever a trainer stands. */}
                    <Link
                      href={`/admin/schedule/slot/${group.slotId}?branch=${branchId}`}
                      className="flex min-h-12 items-center justify-between gap-3 border-b px-4 py-2 text-sm transition-colors hover:bg-muted/60 focus-visible:bg-muted focus-visible:outline-none"
                    >
                      <span className="flex items-center gap-2 font-medium">
                        <Dumbbell className="h-4 w-4 shrink-0 text-muted-foreground" />
                        אימון קבוצתי
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {group.hasGroupWorkout
                          ? `${group.groupExerciseCount} תרגילים`
                          : "טרם נבנה"}
                      </span>
                    </Link>
                    <ul className="divide-y">
                      {group.rows.map((row) => {
                        const status = STATUS[row.status];
                        const badge = planBadges[row.traineeId];
                        const chip = badge?.endsOn ? STAFF_PLAN_CHIP[badge.status] : undefined;
                        return (
                          <li key={row.rosterEntryId} className="flex items-center gap-2 pe-3">
                            <Link
                              href={`/admin/schedule/session/${row.traineeId}?date=${date}&slot=${group.slotId}&branch=${branchId}`}
                              className="flex min-w-0 flex-1 items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/60 focus-visible:bg-muted focus-visible:outline-none"
                            >
                              <span className="flex min-w-0 items-center gap-1.5">
                                <span className="truncate font-medium">{row.traineeName}</span>
                                {/* Says why a group save left this one alone.
                                    Only where there is a group to differ from. */}
                                {row.isCustom && group.hasGroupWorkout && (
                                  <span
                                    className="shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] text-muted-foreground"
                                    title="אימון אישי, עדכון קבוצתי לא ידרוס אותו"
                                  >
                                    אישי
                                  </span>
                                )}
                              </span>
                              <span className={cn("flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs", status.className)}>
                                <status.Icon className="h-3 w-3" />
                                {status.label(row)}
                              </span>
                            </Link>
                            {chip && (
                              <button
                                type="button"
                                onClick={() => setPlanFor({ id: row.traineeId, name: row.traineeName })}
                                className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-bold", chip.className)}
                                aria-label={`המסלול של ${row.traineeName}: ${chip.label}`}
                              >
                                {chip.label}
                              </button>
                            )}
                            {badge?.hasMedicalNotes && (
                              <button
                                type="button"
                                onClick={() => setHealthFor({ id: row.traineeId, name: row.traineeName })}
                                className="rounded-full p-0.5 text-warning-emphasis hover:bg-amber-100"
                                aria-label={`מידע רפואי של ${row.traineeName}`}
                              >
                                <HeartPulse className="h-4 w-4" />
                              </button>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })}
            </div>
          )}
        </>
      )}

      {planFor && (
        <PlanSheet traineeId={planFor.id} traineeName={planFor.name} isAdmin={isAdmin} open onOpenChange={(open) => !open && setPlanFor(null)} />
      )}
      {healthFor && (
        <HealthSheet traineeId={healthFor.id} traineeName={healthFor.name} open onOpenChange={(open) => !open && setHealthFor(null)} />
      )}
    </div>
  );
}

function EmptyState({ text, calendarHref }: { text: string; calendarHref: string }) {
  return (
    <Card className="border-2 border-dashed">
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <p className="text-muted-foreground">{text}</p>
        <Button asChild>
          <Link href={calendarHref}>
            <CalendarDays className="h-4 w-4" />
            ליומן
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function FilterLink({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={cn(
        "rounded-full border px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active ? "border-forest bg-forest text-cream" : "bg-background hover:bg-muted",
      )}
    >
      {label}
    </Link>
  );
}
