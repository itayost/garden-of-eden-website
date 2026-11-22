"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { setCourseAccessMark } from "@/lib/actions/admin-course-access-mark";
import { MAX_MARK_DAYS } from "@/lib/course-access/mark";
import { courseAccessStatusLines } from "@/lib/course-access/status";
import { addDays } from "@/lib/utils/iso-date";
import { formatDateShort } from "@/lib/utils/date";

interface CourseAccessCardProps {
  userId: string;
  seenTrainingOn: string | null;
  accessUntil: string | null;
  trainingNow: boolean;
  /** The training rule decides; false while the old rule still holds. */
  ruleOn: boolean;
  /** Admins set and end the mark; trainers only see it. */
  canEdit: boolean;
  /** Israel day, from the server. */
  today: string;
}

/** A bare YYYY-MM-DD for people: read at noon UTC so no zone moves the day. */
function show(day: string): string {
  return formatDateShort(new Date(`${day}T12:00:00Z`));
}

/** Whether this trainee opens the courses that are for active trainees, and the admin's mark. */
export function CourseAccessCard({
  userId,
  seenTrainingOn,
  accessUntil,
  trainingNow,
  ruleOn,
  canEdit,
  today,
}: CourseAccessCardProps) {
  const lines = courseAccessStatusLines({ ruleOn, trainingNow, seenTrainingOn, accessUntil, today }, show);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarCheck className="h-5 w-5" aria-hidden="true" />
          גישה לקורסים
        </CardTitle>
        <CardDescription>
          {lines.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </CardDescription>
      </CardHeader>

      {canEdit && (
        <CardContent>
          <MarkControls userId={userId} hasMark={accessUntil !== null} today={today} />
        </CardContent>
      )}
    </Card>
  );
}

/** The admin's date picker and buttons; the action checks the admin again. */
function MarkControls({ userId, hasMark, today }: { userId: string; hasMark: boolean; today: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [until, setUntil] = useState("");

  const apply = (next: string | null) => {
    startTransition(async () => {
      const result = await setCourseAccessMark(userId, next);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(next ? "הסימון נשמר" : "הסימון הסתיים");
      setUntil("");
      router.refresh();
    });
  };

  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="space-y-1 text-xs text-muted-foreground">
        <span>עד תאריך</span>
        <input
          type="date"
          value={until}
          min={today}
          max={addDays(today, MAX_MARK_DAYS)}
          onChange={(e) => setUntil(e.target.value)}
          disabled={pending}
          className="block rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
        />
      </label>
      <Button type="button" variant="outline" size="sm" onClick={() => apply(until)} disabled={pending || !until}>
        סמן כפעיל עד
      </Button>
      {hasMark && (
        <Button type="button" variant="outline" size="sm" onClick={() => apply(null)} disabled={pending}>
          סיים סימון
        </Button>
      )}
    </div>
  );
}
