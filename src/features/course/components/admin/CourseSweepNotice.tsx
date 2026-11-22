import { AlertTriangle, Info } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatDateShort } from "@/lib/utils/date";
import type { CourseSweepNotice as Notice } from "@/lib/course-access/status";

const showDay = (day: string): string => formatDateShort(new Date(`${day}T12:00:00Z`));

function noticeText(notice: Exclude<Notice, { kind: "ok" }>): string {
  switch (notice.kind) {
    case "unread":
      return "לא הצלחנו לקרוא את מצב הבדיקה הלילית של הגישה לקורסים.";
    case "never":
      return "הבדיקה הלילית של הגישה לקורסים עוד לא הצליחה. עד אז הגישה לפי הכלל הקודם.";
    case "pending":
      return `הגישה לקורסים לפי אימון פעיל תופעל ב-${showDay(notice.ruleOnFrom)}. עד אז אפשר לסמן מתאמנים פעילים בכרטיס שלהם.`;
    case "stale":
      return `הבדיקה הלילית של הגישה לקורסים לא הצליחה מאז ${showDay(notice.lastGood)}. הגישה נקבעת לפי הבדיקה הזו, כדאי לבדוק את הסנכרון עם Arbox.`;
  }
}

/**
 * The admins' line about the nightly course-access sweep (courseSweepNotice):
 * nothing while it is healthy, a warning when it stopped succeeding.
 */
export function CourseSweepNotice({ notice }: { notice: Notice }) {
  if (notice.kind === "ok") return null;
  const warn = notice.kind === "stale" || notice.kind === "unread";
  const Icon = warn ? AlertTriangle : Info;
  return (
    <div
      role={warn ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2.5 rounded-lg border p-3 text-sm",
        warn ? "border-gold/40 bg-gold/5" : "border-border bg-muted/40 text-muted-foreground",
      )}
    >
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", warn && "text-gold")} aria-hidden="true" />
      <p>{noticeText(notice)}</p>
    </div>
  );
}
