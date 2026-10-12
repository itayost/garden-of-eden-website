import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { verifyAdmin } from "@/lib/actions/shared";
import { BranchUrlFilter } from "@/features/branches/components/BranchUrlFilter";
import { loadEndingSoon, loadFinanceBranches } from "@/features/finance/lib/queries";
import { parseBranchParam } from "@/features/finance/lib/range";
import { endingCounts, filterEnding, parseEndingFilter, type EndingFilter } from "@/features/finance/lib/ending-soon";
import { EndingFilters } from "@/features/finance/components/EndingFilters";
import { EndingList } from "@/features/finance/components/EndingList";

export const metadata: Metadata = { title: "מסתיימים בקרוב | Garden of Eden" };

interface PageProps {
  searchParams: Promise<{ branch?: string; show?: string }>;
}

const TITLES: Record<EndingFilter, string> = {
  all: "לפי דחיפות",
  link: "קישור ממתין",
  reminded: "קיבלו תזכורת",
  arbox: "שולם ב-Arbox",
  expired: "פגו לאחרונה",
};

export default async function EndingSoonPage({ searchParams }: PageProps) {
  const { error } = await verifyAdmin();
  if (error) redirect("/admin");

  const params = await searchParams;
  const show = parseEndingFilter(params.show);
  const branches = await loadFinanceBranches();
  const branchId = parseBranchParam(params.branch, branches.selling.map((b) => b.id));
  const result = await loadEndingSoon(branchId);

  const hrefFor = (filter: EndingFilter) => {
    const query = new URLSearchParams({ ...(filter !== "all" ? { show: filter } : {}), ...(branchId ? { branch: branchId } : {}) });
    const qs = query.toString();
    return qs ? `/admin/finance/ending-soon?${qs}` : "/admin/finance/ending-soon";
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="mb-1 text-3xl font-bold">מסתיימים בקרוב</h1>
          <p className="text-muted-foreground">
            מסלול שמסתיים בעוד 7 ימים או פחות, או כרטיסייה עם 2 אימונים או פחות. ההורה מקבל תזכורת לבד ב-3 ימים או אימון אחד.
          </p>
        </div>
        {branches.selling.length > 1 && <BranchUrlFilter branches={branches.selling} />}
      </header>

      {!result.success ? (
        <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 p-6 text-destructive">
          {result.error}
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)] lg:items-start">
          <EndingFilters counts={endingCounts(result.data)} active={show} hrefFor={hrefFor} />
          <div className="space-y-6">
            <EndingList rows={filterEnding(result.data, show)} title={TITLES[show]} empty="אין כרגע אף חניך ברשימה הזאת" />
            {show === "all" && result.data.expired.length > 0 && (
              <EndingList rows={result.data.expired} title="פגו לאחרונה" empty="" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
