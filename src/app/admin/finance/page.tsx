import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { verifyAdmin } from "@/lib/actions/shared";
import { israelToday } from "@/lib/utils/tasks";
import { BranchUrlFilter } from "@/features/branches/components/BranchUrlFilter";
import { loadFinanceBranches, loadIncomeReport } from "@/features/finance/lib/queries";
import { parseBranchParam, parseRange, MAX_RANGE_DAYS } from "@/features/finance/lib/range";
import { rangeLabel } from "@/features/finance/lib/format";
import { RangeControl } from "@/features/finance/components/RangeControl";
import { IncomeSummary } from "@/features/finance/components/IncomeSummary";
import { IncomeLedger } from "@/features/finance/components/IncomeLedger";

export const metadata: Metadata = { title: "הכנסות | Garden of Eden" };

interface PageProps {
  searchParams: Promise<{ range?: string; from?: string; to?: string; branch?: string }>;
}

export default async function FinanceIncomePage({ searchParams }: PageProps) {
  const { error } = await verifyAdmin();
  if (error) redirect("/admin");

  const params = await searchParams;
  const range = parseRange(params, israelToday());
  const branches = await loadFinanceBranches();
  const branchId = parseBranchParam(params.branch, branches.selling.map((b) => b.id));
  const result = await loadIncomeReport(range, branchId);

  const dayHref = (day: string) => {
    const query = new URLSearchParams({ range: "custom", from: day, to: day, ...(branchId ? { branch: branchId } : {}) });
    return `/admin/finance?${query.toString()}`;
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="mb-1 text-3xl font-bold">הכנסות</h1>
          <p className="text-muted-foreground">{rangeLabel(range)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <RangeControl key={`${range.preset}:${range.from}:${range.to}`} range={range} />
          {branches.selling.length > 1 && <BranchUrlFilter branches={branches.selling} />}
        </div>
      </header>

      {range.clipped && (
        <p className="text-sm text-warning-emphasis">הטווח ארוך מ-{MAX_RANGE_DAYS} ימים, ולכן מוצגים רק {MAX_RANGE_DAYS} הימים האחרונים שבו</p>
      )}
      {branches.notSelling.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {branches.notSelling.map((b) => b.nameHe).join(", ")} מנוהל ב-Arbox ולכן לא מופיע כאן. המעקב שלו ב
          <Link href="/admin/retention" className="underline underline-offset-4">
            שימור לקוחות
          </Link>
          .
        </p>
      )}

      {!result.success ? (
        <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 p-6 text-destructive">
          {result.error}
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)] lg:items-start">
          <IncomeSummary
            report={result.data}
            dayHref={dayHref}
            isToday={range.from === range.to && range.to === israelToday()}
          />
          <div className="min-w-0 space-y-2">
            <IncomeLedger report={result.data} />
            <p className="text-xs text-muted-foreground">
              תשלום כרטיס שהושלם בבדיקה מול פלאקארד נרשם ביום הבדיקה. תשלום כרטיס בתשלומים נספר במלואו ביום החיוב.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
