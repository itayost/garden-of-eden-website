import { BellRing, Link2, MessageCircle, Phone, Snowflake, Store } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatPhoneToLocal } from "@/lib/validations/common";
import { waShareUrl } from "@/lib/whatsapp/share";
import { shortDate } from "@/lib/utils/iso-date";
import { cn } from "@/lib/utils";
import {
  RECENTLY_EXPIRED_DAYS,
  STAFF_ENDING_DAYS,
  STAFF_ENDING_SESSIONS,
  type EndingEntry,
  type EndingFilter,
  type ExpiredEntry,
} from "@/features/finance/lib/ending-soon";
import type { EndingRetentionRow } from "@/lib/retention/ending-soon-load";

export type EndingTabRow = EndingEntry<EndingRetentionRow> | ExpiredEntry<EndingRetentionRow>;

export const isExpiredRow = (row: EndingTabRow): row is ExpiredEntry<EndingRetentionRow> => "daysAgo" in row;

export const ENDING_FILTER_LABELS: Record<EndingFilter, string> = {
  all: "כל המסתיימים",
  link: "קישור ממתין",
  reminded: "קיבלו תזכורת",
  arbox: "שולם ב-Arbox",
  expired: "פגו לאחרונה",
};

/** Who counts as ending, under the tab's toolbar. */
export const ENDING_RULE_TEXT = `מסלול בקריית אתא שמסתיים בעוד ${STAFF_ENDING_DAYS} ימים או פחות, או כרטיסייה עם ${STAFF_ENDING_SESSIONS} אימונים או פחות. "פגו לאחרונה": ${RECENTLY_EXPIRED_DAYS} הימים האחרונים, בלי מסלול חדש. ההורה מקבל תזכורת לבד ב-3 ימים או אימון אחד.`;

const daysText = (n: number) => (n === 1 ? "יום אחד" : `${n} ימים`);

const sessionsText = (left: number) => (left === 0 ? "0 נותרו" : left === 1 ? "אימון אחד" : `${left} אימונים`);

function leftLabel(row: EndingTabRow): { text: string; urgent: boolean } {
  if (isExpiredRow(row)) {
    if (row.daysAgo === 0) return { text: "הסתיים היום", urgent: true };
    return { text: `לפני ${row.daysAgo === 1 ? "יום" : daysText(row.daysAgo)}`, urgent: true };
  }
  if (row.by === "sessions") {
    const left = row.sessionsLeft ?? 0;
    const parts = [
      sessionsText(left),
      row.booked > 0 ? `${row.booked} שמורים` : null,
      row.daysLeft <= STAFF_ENDING_DAYS ? (row.daysLeft === 0 ? "היום" : daysText(row.daysLeft)) : null,
    ];
    return { text: parts.filter((part) => part !== null).join(" · "), urgent: left <= 1 };
  }
  if (row.daysLeft === 0) return { text: "מסתיים היום", urgent: true };
  return { text: daysText(row.daysLeft), urgent: row.daysLeft <= 3 };
}

export function LeftCell({ row }: { row: EndingTabRow }) {
  const left = leftLabel(row);
  return (
    <span className={cn("whitespace-nowrap font-bold tabular-nums", left.urgent ? "text-destructive" : "text-warning-emphasis")}>
      {left.text}
    </span>
  );
}

export function FlagsCell({ row }: { row: EndingTabRow }) {
  return (
    <div className="flex flex-wrap gap-1">
      {row.reminded && (
        <Badge variant="outline" className="gap-1 font-normal">
          <BellRing className="h-3 w-3" aria-hidden /> תזכורת נשלחה
        </Badge>
      )}
      {row.linkWaiting && (
        <Badge variant="outline" className="gap-1 border-info/40 font-normal text-info">
          <Link2 className="h-3 w-3" aria-hidden /> קישור ממתין
        </Badge>
      )}
      {row.frozen && (
        <Badge variant="outline" className="gap-1 font-normal text-info">
          <Snowflake className="h-3 w-3" aria-hidden /> {row.frozen.endsOn ? `מוקפא עד ${shortDate(row.frozen.endsOn)}` : "מוקפא"}
        </Badge>
      )}
      {row.paidInArbox && (
        <Badge className="gap-1 bg-warning font-normal text-warning-foreground hover:bg-warning">
          <Store className="h-3 w-3" aria-hidden /> שולם ב-Arbox · אין תזכורת
        </Badge>
      )}
    </div>
  );
}

/** The parent (else the trainee) to reach, with call and WhatsApp. */
export function ContactCell({ row }: { row: EndingTabRow }) {
  const who = row.contactIsTrainee ? "לחניך" : "להורה";
  const name = row.contactIsTrainee ? row.traineeName : (row.guardianName ?? "הורה");
  return (
    <div className="min-w-0">
      <div className="text-sm">{row.contactIsTrainee ? "החניך" : (row.guardianName ?? "הורה לא רשום")}</div>
      {row.contactPhone ? (
        <div className="flex items-center gap-1">
          <span dir="ltr" className="text-xs tabular-nums text-muted-foreground">
            {formatPhoneToLocal(row.contactPhone)}
          </span>
          <Button asChild variant="ghost" size="icon" className="h-7 w-7" aria-label={`התקשרות ${who} ${name}`}>
            <a href={`tel:${row.contactPhone}`}>
              <Phone className="h-3.5 w-3.5" />
            </a>
          </Button>
          <Button asChild variant="ghost" size="icon" className="h-7 w-7" aria-label={`וואטסאפ ${who} ${name}`}>
            <a href={waShareUrl(row.contactPhone, "")} target="_blank" rel="noreferrer">
              <MessageCircle className="h-3.5 w-3.5" />
            </a>
          </Button>
        </div>
      ) : (
        <span className="text-xs text-muted-foreground">אין טלפון</span>
      )}
    </div>
  );
}
