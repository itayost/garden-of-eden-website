import Link from "next/link";
import { ArrowLeftRight, Banknote, CreditCard, Gift, ScrollText, Smartphone, type LucideIcon } from "lucide-react";
import { formatIls } from "@/lib/utils/money";
import { INCOME_METHOD_LABEL, shortDay } from "../lib/format";
import type { IncomeMethod, IncomeReport } from "../lib/income";
import { Money } from "./Money";
import { SummarySection } from "./SummarySection";

const METHOD_ICON: Record<IncomeMethod, LucideIcon> = {
  cash: Banknote,
  card: CreditCard,
  bit: Smartphone,
  transfer: ArrowLeftRight,
  check: ScrollText,
  free: Gift,
};

export function IncomeSummary({
  report,
  dayHref,
  isToday,
}: {
  report: IncomeReport;
  dayHref: (day: string) => string;
  isToday: boolean;
}) {
  const maxMethod = Math.max(1, ...report.byMethod.map((m) => m.total));
  // A range lists its days with any money in or out, newest first; a single day needs no list.
  const activeDays =
    report.from === report.to
      ? []
      : report.days.filter((d) => d.count > 0 || d.refunds > 0).toReversed();

  return (
    <aside aria-label="סיכום" className="rounded-xl border bg-card lg:sticky lg:top-4">
      <div className="border-b px-4 py-5">
        <p className="text-sm text-muted-foreground">{report.from !== report.to ? "נטו בטווח" : isToday ? "נטו היום" : "נטו ביום"}</p>
        <Money amount={report.net} className="block text-4xl font-black leading-tight" />
        <p className="mt-1 text-sm">
          התקבל <Money amount={report.received} className="font-semibold" /> · הוחזר{" "}
          <Money amount={report.refunds} className="font-semibold text-destructive" />
        </p>
        {report.arbox.entries.length > 0 && (
          <p className="mt-2 text-sm text-muted-foreground">
            נמכר ב-Arbox: <Money amount={report.arbox.total} className="font-semibold text-foreground" /> (
            {report.arbox.entries.length} רכישות)
            {report.arbox.unknownCount > 0 && ` · ${report.arbox.unknownCount} ללא סכום`}
            {report.arbox.undoneCount > 0 && ` · ${report.arbox.undoneCount} בוטלו או הוחזרו`}
          </p>
        )}
      </div>

      {activeDays.length > 0 && (
        <SummarySection title="לפי ימים" meta={`${activeDays.length} ימים עם תנועה`}>
          <ul className="divide-y text-sm">
            {activeDays.map((d) => (
              <li key={d.day}>
                <Link
                  href={dayHref(d.day)}
                  className="flex items-center justify-between gap-3 rounded-md px-1 py-2 transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <span>
                    {shortDay(d.day)}
                    <span className="ms-2 text-xs text-muted-foreground tabular-nums">{d.count} תשלומים</span>
                  </span>
                  <Money amount={d.net} className="font-semibold" />
                </Link>
              </li>
            ))}
          </ul>
        </SummarySection>
      )}

      <SummarySection title="לפי אמצעי תשלום" meta={`${report.byMethod.length} אמצעים`}>
        {report.byMethod.length === 0 ? (
          <p className="text-sm text-muted-foreground">אין תשלומים בטווח</p>
        ) : (
          <ul className="space-y-3">
            {report.byMethod.map((m) => {
              const label = INCOME_METHOD_LABEL[m.method];
              const Icon = METHOD_ICON[m.method];
              return (
                <li key={m.method}>
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-1.5">
                      <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
                      {label}
                      <span className="text-xs text-muted-foreground tabular-nums">{m.count}</span>
                    </span>
                    <Money amount={m.total} className="font-semibold" />
                  </div>
                  {m.method !== "free" && (
                    <div className="mt-1 h-1.5 rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ inlineSize: `${(m.total / maxMethod) * 100}%` }} />
                    </div>
                  )}
                  {m.method === "card" && report.installmentsIls > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      מתוכם <Money amount={report.installmentsIls} /> בתשלומים
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </SummarySection>

      <SummarySection title="לפי סניף" meta={`${report.byBranch.length} סניפים`}>
        {report.byBranch.length > 1 && report.received > 0 && (
          <div className="mb-2 flex h-2 overflow-hidden rounded-full bg-muted">
            {report.byBranch.map((b, i) => (
              <div
                key={b.branchId}
                className={i === 0 ? "bg-primary" : "bg-primary/40"}
                style={{ inlineSize: `${(b.total / report.received) * 100}%` }}
              />
            ))}
          </div>
        )}
        <ul className="space-y-1 text-sm">
          {report.byBranch.map((b) => (
            <li key={b.branchId} className="flex justify-between gap-2">
              <span>
                {b.branchName} <span className="text-xs text-muted-foreground tabular-nums">{b.count}</span>
              </span>
              <Money amount={b.total} className="font-semibold" />
            </li>
          ))}
        </ul>
      </SummarySection>

      <SummarySection title="קופה לפי איש צוות" meta="מזומן, ביט, העברה וצ׳ק" openOnPhone>
        {report.staff.length === 0 ? (
          <p className="text-sm text-muted-foreground">אף איש צוות לא גבה כסף בטווח</p>
        ) : (
          <ul className="divide-y">
            {report.staff.map((s) => (
              <li key={s.staff.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-bold">{s.staff.name}</span>
                  <span className="text-sm">
                    <span className="text-xs text-muted-foreground">בידיים </span>
                    <Money amount={s.inHand} className="text-lg font-bold" />
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {[
                    s.cash > 0 && `${INCOME_METHOD_LABEL.cash} ${formatIls(s.cash)}`,
                    s.bit > 0 && `${INCOME_METHOD_LABEL.bit} ${formatIls(s.bit)}`,
                    s.transfer > 0 && `${INCOME_METHOD_LABEL.transfer} ${formatIls(s.transfer)}`,
                    s.check > 0 && `${INCOME_METHOD_LABEL.check} ${formatIls(s.check)}`,
                    s.freeGiven > 0 && `${s.freeGiven} ללא תשלום`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {s.cashRefundsOut > 0 && (
                  <p className="mt-1 rounded-md bg-destructive/10 px-2 py-1 text-xs text-destructive">
                    שילם החזר במזומן <Money amount={s.cashRefundsOut} />, ירד מהקופה
                  </p>
                )}
                {s.linksSent.length > 0 && (
                  <p className="mt-1 rounded-md bg-secondary px-2 py-1 text-xs">
                    קישורי אשראי שנשלחו:{" "}
                    {s.linksSent.map((l) => `${l.childName} ${formatIls(l.amountIls)}`).join(", ")} · לא עבר בידיים
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </SummarySection>
    </aside>
  );
}
