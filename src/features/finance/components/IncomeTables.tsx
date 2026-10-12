import { FileText, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatIls } from "@/lib/utils/money";
import { israelDateStr } from "@/lib/utils/israel-time";
import { safeReceiptUrl, shortDay, timeOf } from "../lib/format";
import type { ArboxEntry, IncomePayment, IncomeRefund } from "../lib/income";

const METHOD_LABEL = { cash: "מזומן", card: "אשראי", bit: "ביט", transfer: "העברה", free: "ללא תשלום" } as const;
const REFUND_METHOD_LABEL = { card: "אשראי", cash: "מזומן", transfer: "העברה", bit: "ביט", arbox: "Arbox", none: "ללא" } as const;
const REFUND_KIND_LABEL = { void: "ביטול רישום", cancellation: "ביטול מסלול" } as const;

const Money = ({ amount, className }: { amount: number; className?: string }) => (
  <span dir="ltr" className={`tabular-nums ${className ?? ""}`}>
    {formatIls(amount)}
  </span>
);

const when = (iso: string, day: string, multiDay: boolean) => (multiDay ? `${shortDay(day)} ${timeOf(iso)}` : timeOf(iso));

function takenBy(p: IncomePayment): string {
  if (p.collector.kind === "online") return "אונליין";
  if (p.collector.kind === "link") return `קישור · ${p.collector.staff.name}`;
  return p.collector.staff.name;
}

function AmountCell({ p }: { p: IncomePayment }) {
  const undone = p.status === "voided" || p.status === "refunded";
  return (
    <div>
      <Money amount={p.amountIls} className={`font-semibold ${undone ? "line-through decoration-muted-foreground" : ""}`} />
      {p.status === "voided" && <Badge variant="destructive" className="ms-2">בוטל</Badge>}
      {p.status === "refunded" && <Badge variant="outline" className="ms-2">הוחזר</Badge>}
      {p.incomeMethod === "card" && p.installments > 1 && (
        <div className="text-xs text-muted-foreground">{p.installments} תשלומים</div>
      )}
      {p.listPriceIls !== null && (
        <div className="text-xs text-muted-foreground">
          <Money amount={p.listPriceIls} className="line-through" /> · {p.discountReason}
        </div>
      )}
    </div>
  );
}

export function PaymentsTable({ payments, multiDay }: { payments: IncomePayment[]; multiDay: boolean }) {
  if (payments.length === 0) {
    return <p className="px-4 py-12 text-center text-muted-foreground">לא נרשם תשלום בטווח הזה</p>;
  }
  return (
    <>
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-start">שעה</TableHead>
              <TableHead className="text-start">חניך / הורה</TableHead>
              <TableHead className="text-start">מסלול</TableHead>
              <TableHead className="text-start">סניף</TableHead>
              <TableHead className="text-start">אמצעי</TableHead>
              <TableHead className="text-start">סכום</TableHead>
              <TableHead className="text-start">התקבל ע״י</TableHead>
              <TableHead className="text-start">קבלה</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="tabular-nums text-muted-foreground">{when(p.paidAt, p.day, multiDay)}</TableCell>
                <TableCell>
                  <div className="font-medium">{p.childName}</div>
                  <div className="text-xs text-muted-foreground">{p.parentName}</div>
                </TableCell>
                <TableCell>{p.planName}</TableCell>
                <TableCell>{p.branchName}</TableCell>
                <TableCell>
                  {METHOD_LABEL[p.incomeMethod]}
                  {p.reference && <div className="text-xs text-muted-foreground">אסמכתא {p.reference}</div>}
                </TableCell>
                <TableCell>
                  <AmountCell p={p} />
                </TableCell>
                <TableCell>{takenBy(p)}</TableCell>
                <TableCell>
                  {safeReceiptUrl(p.receiptUrl) ? (
                    <a href={safeReceiptUrl(p.receiptUrl) ?? undefined} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline" aria-label={`קבלה של ${p.childName}`}>
                      <FileText className="h-4 w-4" aria-hidden />
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground">אין</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ul className="divide-y md:hidden">
        {payments.map((p) => (
          <li key={p.id} className="flex justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <div className="font-medium">
                <span className="me-2 text-sm text-muted-foreground tabular-nums">{when(p.paidAt, p.day, multiDay)}</span>
                {p.childName}
              </div>
              <div className="text-xs text-muted-foreground">
                {p.planName} · {p.branchName}
              </div>
              <div className="text-xs text-muted-foreground">התקבל ע״י {takenBy(p)}</div>
            </div>
            <div className="shrink-0 text-end">
              <AmountCell p={p} />
              <div className="text-xs text-muted-foreground">{METHOD_LABEL[p.incomeMethod]}</div>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

export function RefundsTable({ refunds, multiDay }: { refunds: IncomeRefund[]; multiDay: boolean }) {
  if (refunds.length === 0) {
    return <p className="px-4 py-12 text-center text-muted-foreground">לא נרשם החזר בטווח הזה</p>;
  }
  return (
    <ul className="divide-y">
      {refunds.map((r) => (
        <li key={r.id} className="grid gap-1 px-4 py-3 md:grid-cols-[6rem_1fr_8rem_8rem_10rem] md:items-center">
          <span className="tabular-nums text-muted-foreground">{when(r.createdAt, r.day, multiDay)}</span>
          <div>
            <div className="font-medium">{r.childName}</div>
            <div className="text-xs text-muted-foreground">
              {r.planName} · {REFUND_KIND_LABEL[r.kind]} · {r.salePaidAt ? `נמכר ${shortDay(israelDateStr(r.salePaidAt))}` : "ללא הזמנה"}
            </div>
          </div>
          <Money amount={-r.amountIls} className="font-semibold text-destructive" />
          <span className="text-sm">
            {REFUND_METHOD_LABEL[r.method]} · {r.createdBy.name}
          </span>
          {r.creditNoteNumber ? (
            <span className="text-sm tabular-nums">זיכוי {r.creditNoteNumber}</span>
          ) : r.amountIls > 0 ? (
            <Badge className="w-fit bg-warning text-warning-foreground hover:bg-warning">
              <TriangleAlert className="me-1 h-3 w-3" aria-hidden />
              חסר זיכוי
            </Badge>
          ) : (
            <span className="text-sm text-muted-foreground">ללא זיכוי</span>
          )}
        </li>
      ))}
    </ul>
  );
}

export function ArboxTable({ entries }: { entries: ArboxEntry[] }) {
  if (entries.length === 0) {
    return <p className="px-4 py-12 text-center text-muted-foreground">אין רכישות Arbox בטווח הזה</p>;
  }
  return (
    <div>
      <p className="px-4 pt-3 text-sm text-muted-foreground">
        נרכשו ושולמו ב-Arbox ונקלטו הלילה. הן לא נספרות בהכנסות; התאריך הוא יום הרכישה ב-Arbox.
      </p>
      <ul className="divide-y">
        {entries.map((e) => {
          const undone = e.status !== "paid";
          const importedOn = israelDateStr(e.paidAt);
          return (
          <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div>
              <div className="font-medium">{e.childName}</div>
              <div className="text-xs text-muted-foreground">
                {e.planName} · נרכש {shortDay(e.day)}
                {importedOn !== e.day && ` · נקלט ${shortDay(importedOn).split(" ")[1]}`}
              </div>
            </div>
            <div className="shrink-0 text-end">
              {e.unknownAmount ? (
                <Badge variant="outline">סכום לא ידוע</Badge>
              ) : (
                <Money amount={e.amountIls} className={`font-semibold ${undone ? "line-through decoration-muted-foreground" : ""}`} />
              )}
              {e.status === "voided" && <Badge variant="destructive" className="ms-2">בוטל</Badge>}
              {e.status === "refunded" && <Badge variant="outline" className="ms-2">הוחזר</Badge>}
            </div>
          </li>
          );
        })}
      </ul>
    </div>
  );
}
