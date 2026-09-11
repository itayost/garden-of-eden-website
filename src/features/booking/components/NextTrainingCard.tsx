import Link from "next/link";
import { CalendarCheck, CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { hebrewWeekday } from "@/lib/utils/date";
import { shortDate } from "@/lib/utils/iso-date";
import type { MyBooking } from "../lib/actions/schedule";

/** The next booked training on the home page, or the nudge to book one. */
export function NextTrainingCard({ next }: { next: MyBooking | null }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-forest/10 text-forest">
            {next ? <CalendarCheck className="h-5 w-5" /> : <CalendarPlus className="h-5 w-5" />}
          </div>
          <div className="text-sm">
            <div className="font-bold">{next ? "האימון הבא" : "עדיין לא נרשמת לאימון השבוע"}</div>
            <div className="text-muted-foreground">
              {next
                ? `${hebrewWeekday(next.date)} ${shortDate(next.date)} · ${next.time} · ${next.trainerName}`
                : "בחרו יום ושעה שנוחים לכם"}
            </div>
          </div>
        </div>
        <Button asChild variant={next ? "outline" : "default"} size="sm">
          <Link href="/dashboard/schedule">{next ? "כל האימונים" : "להרשמה"}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
