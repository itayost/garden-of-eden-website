"use client";

import Link from "next/link";
import { CalendarCheck, Check, ChevronDown, Dumbbell, HeartPulse, Loader2, Pencil, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { STAFF_PLAN_CHIP } from "@/lib/plans/status-styles";
import type { RosterSession } from "@/lib/schedule/roster-exercise";
import type { StaffPlanBadge } from "@/types/plans";
import type { SlotTrainee } from "@/types/schedule";

type StatusKey = "not_built" | "built" | "completed";

interface StatusStyle {
  label: (session: RosterSession | undefined) => string;
  className: string;
  Icon: typeof Plus;
}

/** What the trainee was given, at the three states a trainer acts on. */
const STATUS: Record<StatusKey, StatusStyle> = {
  not_built: { label: () => "לא נבנה", className: "bg-secondary text-secondary-foreground", Icon: Plus },
  built: {
    label: (session) => `${session?.exercises.length ?? 0} תרגילים`,
    className: "bg-primary text-primary-foreground",
    Icon: Dumbbell,
  },
  completed: { label: () => "הושלם", className: "bg-success text-success-foreground", Icon: Check },
};

function statusKey(session: RosterSession | undefined): StatusKey {
  if (!session) return "not_built";
  return session.completed_at ? "completed" : "built";
}

interface RosterRowProps {
  entry: SlotTrainee;
  /** Absent means nothing was built for this trainee on this day. */
  session: RosterSession | undefined;
  /** The day's sessions are still loading, or failed to load. */
  sessionsState: "loading" | "ready" | "error";
  badge: StaffPlanBadge | undefined;
  expanded: boolean;
  onToggle: () => void;
  removing: boolean;
  removeDisabled: boolean;
  onRemove: () => void;
  onOpenPlan: () => void;
  onOpenHealth: () => void;
  /** The session builder for this trainee on this day and slot. */
  builderHref: string;
}

/**
 * One trainee in a slot: who they are, whether their session is built, and —
 * when opened — the exercises they were given. Building still happens in the
 * builder; this row only reads and links.
 */
export function RosterRow({
  entry,
  session,
  sessionsState,
  badge,
  expanded,
  onToggle,
  removing,
  removeDisabled,
  onRemove,
  onOpenPlan,
  onOpenHealth,
  builderHref,
}: RosterRowProps) {
  const chip = badge?.endsOn ? STAFF_PLAN_CHIP[badge.status] : undefined;
  const status = STATUS[statusKey(session)];
  const panelId = `roster-session-${entry.id}`;
  // A free-text name has no account, so it can hold no session and nothing to open.
  const linked = entry.trainee_id !== null;

  return (
    <li className="px-1">
      <div className="flex items-center gap-1">
        {linked ? (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            aria-controls={panelId}
            className="flex min-h-12 min-w-0 flex-1 items-center gap-2 rounded-lg px-2 text-start transition-colors hover:bg-muted/60 focus-visible:bg-muted focus-visible:outline-none"
          >
            <ChevronDown
              className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")}
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1 truncate text-sm">{entry.trainee_name}</span>
            {entry.source === "self" && (
              <CalendarCheck className="h-4 w-4 shrink-0 text-forest" aria-label="נרשם בעצמו" />
            )}
            {sessionsState === "loading" ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" aria-label="טוען אימון" />
            ) : sessionsState === "ready" ? (
              <span
                className={cn(
                  "flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs tabular-nums",
                  status.className,
                )}
              >
                <status.Icon className="h-3 w-3" aria-hidden="true" />
                {status.label(session)}
              </span>
            ) : null}
          </button>
        ) : (
          <span className="min-h-12 min-w-0 flex-1 truncate px-2 py-3 text-sm text-muted-foreground">
            {entry.trainee_name}
            <span className="ms-1 text-[11px]">(ללא חשבון)</span>
          </span>
        )}

        {chip && linked && (
          <button
            type="button"
            onClick={onOpenPlan}
            className="inline-flex min-h-10 shrink-0 items-center px-1"
            title={badge?.sessionsLeft != null ? `${badge.sessionsLeft} אימונים נותרו` : undefined}
            aria-label={`המסלול של ${entry.trainee_name}: ${chip.label}`}
          >
            <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold", chip.className)}>{chip.label}</span>
          </button>
        )}
        {badge?.hasMedicalNotes && linked && (
          <button
            type="button"
            onClick={onOpenHealth}
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-warning-emphasis hover:bg-amber-100"
            aria-label={`מידע רפואי של ${entry.trainee_name}`}
          >
            <HeartPulse className="h-4 w-4" />
          </button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="size-10 shrink-0"
          disabled={removeDisabled}
          onClick={onRemove}
          aria-label={`הסרת ${entry.trainee_name} מהסלוט`}
        >
          {removing ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
        </Button>
      </div>

      {linked && expanded && (
        <div id={panelId} className="space-y-2 pb-3 pe-3 ps-8">
          {sessionsState === "error" ? (
            <p className="text-xs text-destructive">האימונים לא נטענו</p>
          ) : sessionsState === "loading" ? (
            <p className="text-xs text-muted-foreground">טוען...</p>
          ) : session && session.exercises.length > 0 ? (
            <ol className="space-y-1.5">
              {session.exercises.map((exercise, index) => (
                <li key={exercise.id} className="flex gap-2 text-sm">
                  <span className="w-4 shrink-0 text-xs tabular-nums text-muted-foreground">{index + 1}.</span>
                  <span className="min-w-0">
                    <span className="font-medium">{exercise.name}</span>
                    {exercise.target && (
                      <span className="ms-2 text-xs tabular-nums text-muted-foreground">{exercise.target}</span>
                    )}
                    {exercise.notes && (
                      <span className="block text-xs italic text-muted-foreground">{exercise.notes}</span>
                    )}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-xs text-muted-foreground">
              {session ? "האימון נבנה בלי תרגילים" : "לא נבנה אימון ליום הזה"}
            </p>
          )}

          <Button variant="outline" size="sm" asChild>
            <Link href={builderHref}>
              {session ? <Pencil className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
              {session ? "עריכת האימון" : "בניית אימון"}
            </Link>
          </Button>
        </div>
      )}
    </li>
  );
}
