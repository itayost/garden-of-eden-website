import Link from "next/link";
import { cn } from "@/lib/utils";
import type { EndingCounts, EndingFilter } from "../lib/ending-soon";

const ITEMS: { value: EndingFilter; label: string; hint: (c: EndingCounts) => string; count: (c: EndingCounts) => number; attention?: boolean }[] = [
  { value: "all", label: "כל המסתיימים", hint: (c) => `${c.byDate} לפי תאריך · ${c.bySessions} לפי אימונים`, count: (c) => c.all },
  { value: "link", label: "קישור ממתין", hint: () => "ההורה קיבל קישור ועוד לא שילם", count: (c) => c.link },
  { value: "reminded", label: "קיבלו תזכורת", hint: () => "ההודעה האוטומטית כבר יצאה", count: (c) => c.reminded },
  { value: "arbox", label: "שולם ב-Arbox", hint: () => "אין תזכורת אוטומטית, צריך לפנות", count: (c) => c.arbox, attention: true },
  { value: "expired", label: "פגו לאחרונה", hint: () => "ב-14 הימים האחרונים, בלי מסלול חדש", count: (c) => c.expired },
];

export function EndingFilters({ counts, active, hrefFor }: { counts: EndingCounts; active: EndingFilter; hrefFor: (f: EndingFilter) => string }) {
  return (
    <nav aria-label="סינון" className="rounded-xl border bg-card p-2 lg:sticky lg:top-4">
      <ul className="flex gap-2 overflow-x-auto lg:flex-col lg:gap-1">
        {ITEMS.map((item) => {
          const count = item.count(counts);
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
                  <span className="block font-semibold">{item.label}</span>
                  <span className="hidden text-xs text-muted-foreground lg:block">{item.hint(counts)}</span>
                </span>
                <span className={cn("text-lg font-bold tabular-nums", item.attention && count > 0 && "text-warning-emphasis")}>{count}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="hidden border-t px-3 pt-2 text-xs text-muted-foreground lg:block">
        מסלול שמסתיים בעוד 7 ימים או פחות, או כרטיסייה עם 2 אימונים או פחות. מסלול שכבר חודש לא מופיע כאן.
      </p>
    </nav>
  );
}
