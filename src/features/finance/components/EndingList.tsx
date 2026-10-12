import Link from "next/link";
import { BellRing, ChevronLeft, Link2, MessageCircle, Phone, Snowflake, Store } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatPhoneToLocal } from "@/lib/validations/common";
import { waShareUrl } from "@/lib/whatsapp/share";
import { cn } from "@/lib/utils";
import type { EndingEntry, ExpiredEntry } from "../lib/ending-soon";
import type { EndingRow } from "../lib/queries";

type Row = EndingEntry<EndingRow> | ExpiredEntry<EndingRow>;

const isExpired = (row: Row): row is ExpiredEntry<EndingRow> => "daysAgo" in row;

function leftLabel(row: Row): { text: string; urgent: boolean } {
  if (isExpired(row)) return { text: `לפני ${row.daysAgo === 1 ? "יום" : `${row.daysAgo} ימים`}`, urgent: true };
  if (row.by === "sessions") {
    const left = row.sessionsLeft ?? 0;
    const base = left === 0 ? "0 נותרו" : left === 1 ? "אימון אחד" : `${left} אימונים`;
    return { text: row.booked > 0 ? `${base} · ${row.booked} שמורים` : base, urgent: left <= 1 };
  }
  if (row.daysLeft === 0) return { text: "מסתיים היום", urgent: true };
  return { text: row.daysLeft === 1 ? "יום אחד" : `${row.daysLeft} ימים`, urgent: row.daysLeft <= 3 };
}

function Flags({ row }: { row: Row }) {
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
      {row.frozenLabel && (
        <Badge variant="outline" className="gap-1 font-normal text-info">
          <Snowflake className="h-3 w-3" aria-hidden /> {row.frozenLabel}
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

function Contact({ row }: { row: Row }) {
  if (!row.guardianPhone) return <span className="text-xs text-muted-foreground">אין טלפון הורה</span>;
  return (
    <div className="flex gap-1">
      <Button asChild variant="outline" size="icon" aria-label={`התקשרות ל${row.guardianName ?? "הורה"}`}>
        <a href={`tel:${row.guardianPhone}`}>
          <Phone className="h-4 w-4" />
        </a>
      </Button>
      <Button asChild variant="outline" size="icon" aria-label={`וואטסאפ ל${row.guardianName ?? "הורה"}`}>
        <a href={waShareUrl(row.guardianPhone, "")} target="_blank" rel="noreferrer">
          <MessageCircle className="h-4 w-4" />
        </a>
      </Button>
      <Button asChild variant="ghost" size="icon" aria-label={`לדף של ${row.traineeName}`}>
        <Link href={`/admin/users/${row.profileId}`}>
          <ChevronLeft className="h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
}

export function EndingList({ rows, title, empty }: { rows: Row[]; title: string; empty: string }) {
  return (
    <section aria-label={title} className="min-w-0 rounded-xl border bg-card">
      <h2 className="flex items-baseline justify-between px-4 pt-4 font-bold">
        {title}
        <span className="text-xs font-normal text-muted-foreground tabular-nums">{rows.length} חניכים</span>
      </h2>
      {rows.length === 0 ? (
        <p className="px-4 py-12 text-center text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-2 divide-y">
          {rows.map((row) => {
            const left = leftLabel(row);
            return (
              <li key={row.profileId} className="grid gap-2 px-4 py-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_7rem_minmax(0,1.2fr)_auto] md:items-center">
                <div className="min-w-0">
                  <Link href={`/admin/users/${row.profileId}`} className="font-bold hover:underline">
                    {row.traineeName}
                  </Link>
                  <div className="text-xs text-muted-foreground">{row.guardianName ?? "הורה לא רשום"}</div>
                  {row.guardianPhone && (
                    <div dir="ltr" className="text-end text-xs text-muted-foreground tabular-nums md:text-start">
                      {formatPhoneToLocal(row.guardianPhone)}
                    </div>
                  )}
                </div>
                <div className="text-sm">
                  {row.planName}
                  <div className="text-xs text-muted-foreground">
                    {row.branchName} · {isExpired(row) ? "הסתיים" : "מסתיים"} {Number(row.endsOn.slice(8, 10))}.{Number(row.endsOn.slice(5, 7))}
                  </div>
                </div>
                <span className={cn("font-bold tabular-nums", left.urgent ? "text-destructive" : "text-warning-emphasis")}>{left.text}</span>
                <Flags row={row} />
                <Contact row={row} />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
