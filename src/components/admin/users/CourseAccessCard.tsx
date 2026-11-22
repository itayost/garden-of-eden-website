"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { setCourseAccessMark } from "@/lib/actions/admin-course-access-mark";
import { MAX_MARK_DAYS } from "@/lib/course-access/mark";
import { addDays } from "@/lib/utils/iso-date";
import { formatDateShort } from "@/lib/utils/date";

interface CourseAccessCardProps {
  userId: string;
  seenTrainingOn: string | null;
  accessUntil: string | null;
  trainingNow: boolean;
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
  today,
}: CourseAccessCardProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [until, setUntil] = useState("");

  const marked = accessUntil !== null && accessUntil >= today;

  let status = "לא פעיל: אין מנוי, כרטיסייה או מסלול פעילים";
  if (marked) status = `מסומן פעיל עד ${show(accessUntil)}`;
  else if (trainingNow && seenTrainingOn) status = `פעיל: נראה מתאמן ב-${show(seenTrainingOn)}`;

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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarCheck className="h-5 w-5" aria-hidden="true" />
          גישה לקורסים
        </CardTitle>
        <CardDescription>{status}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
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
          <button
            type="button"
            onClick={() => apply(until)}
            disabled={pending || !until}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-bold transition-colors hover:bg-muted disabled:opacity-40"
          >
            סמן כפעיל עד
          </button>
          {accessUntil !== null && (
            <button
              type="button"
              onClick={() => apply(null)}
              disabled={pending}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-bold transition-colors hover:bg-muted disabled:opacity-50"
            >
              סיים סימון
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
