import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  RECENTLY_EXPIRED_DAYS,
  STAFF_ENDING_DAYS,
  STAFF_ENDING_SESSIONS,
  type EndingCounts,
  type EndingFilter,
} from "../lib/ending-soon";

/** The filter names; the page's list titles reuse them. */
export const ENDING_FILTER_LABELS: Record<EndingFilter, string> = {
  all: "כל המסתיימים",
  link: "קישור ממתין",
  reminded: "קיבלו תזכורת",
  arbox: "שולם ב-Arbox",
  expired: "פגו לאחרונה",
};

/** Who counts as ending, shared by the page subtitle and the filter footer. */
export const ENDING_RULE_TEXT = `מסלול שמסתיים בעוד ${STAFF_ENDING_DAYS} ימים או פחות, או כרטיסייה עם ${STAFF_ENDING_SESSIONS} אימונים או פחות.`;

const ITEMS: { value: EndingFilter; hint?: string; attention?: boolean }[] = [
  { value: "all" },
  { value: "link", hint: "ההורה קיבל קישור ועוד לא שילם" },
  { value: "reminded", hint: "ההודעה האוטומטית כבר יצאה" },
  { value: "arbox", hint: "אין תזכורת אוטומטית, צריך לפנות", attention: true },
  { value: "expired", hint: `ב-${RECENTLY_EXPIRED_DAYS} הימים האחרונים, בלי מסלול חדש` },
];

export function EndingFilters({ counts, active, hrefFor }: { counts: EndingCounts; active: EndingFilter; hrefFor: (f: EndingFilter) => string }) {
  return (
    <nav aria-label="סינון" className="rounded-xl border bg-card p-2 lg:sticky lg:top-4">
      <ul className="flex gap-2 overflow-x-auto lg:flex-col lg:gap-1">
        {ITEMS.map((item) => {
          const count = counts[item.value];
          const hint = item.hint ?? `${counts.byDate} לפי תאריך · ${counts.bySessions} לפי אימונים`;
          return (
            <li key={item.value} className="shrink-0">
              <Link
                href={hrefFor(item.value)}
                aria-current={active === item.value ? "page" : undefined}
                className={cn(
                  "flex items-center justify-between gap-4 rounded-lg px-3 py-2 transition-colors hover:bg-muted",
                  active === item.value && "bg-secondary ring-1 ring-primary/40",
                )}
              >
                <span>
                  <span className="block font-semibold">{ENDING_FILTER_LABELS[item.value]}</span>
                  <span className="hidden text-xs text-muted-foreground lg:block">{hint}</span>
                </span>
                <span className={cn("text-lg font-bold tabular-nums", item.attention && count > 0 && "text-warning-emphasis")}>{count}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="hidden border-t px-3 pt-2 text-xs text-muted-foreground lg:block">
        {ENDING_RULE_TEXT} מסלול שכבר חודש לא מופיע כאן.
      </p>
    </nav>
  );
}
