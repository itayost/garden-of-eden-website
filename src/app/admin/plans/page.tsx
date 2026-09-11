import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getBranchScopeAction, verifyAdminOrTrainer } from "@/lib/actions/shared";
import { allowedBranches } from "@/lib/branches/resolve-branch";
import { isMorningConfigured } from "@/lib/morning/config";
import { listActiveBranchOptionsAction } from "@/features/branches/lib/actions/list-branches";
import { BranchUrlFilter } from "@/features/branches/components/BranchUrlFilter";
import { listPlansAction } from "@/features/plans/lib/actions/admin-plans";
import { PlansTable } from "@/features/plans/components/admin/PlansTable";
import { NewTraineeSheet } from "@/features/plans/components/staff/NewTraineeSheet";
import { listSellableProductsAction } from "@/features/plans/lib/actions/staff-payment";
import { Button } from "@/components/ui/button";
import { isValidUUID } from "@/lib/validations/common";
import { PLAN_STATUS_LABELS_HE, type PlanStatus } from "@/types/plans";

export const metadata: Metadata = { title: "מסלולים | Garden of Eden" };

const STATUSES: PlanStatus[] = ["active", "ending_soon", "expired", "cancelled"];

interface PageProps {
  searchParams: Promise<{ branch?: string; status?: string }>;
}

export default async function AdminPlansPage({ searchParams }: PageProps) {
  const { error, profile } = await verifyAdminOrTrainer();
  if (error) redirect("/admin");
  const isAdmin = profile!.role === "admin";
  const scopeResult = await getBranchScopeAction();
  if ("error" in scopeResult) redirect("/admin");

  const params = await searchParams;
  const status = STATUSES.find((s) => s === params.status);
  const branchId = params.branch && isValidUUID(params.branch) ? params.branch : undefined;
  const [rows, allBranches, products] = await Promise.all([
    listPlansAction({ branchId, status }),
    listActiveBranchOptionsAction(),
    listSellableProductsAction(),
  ]);
  const branches = allowedBranches(scopeResult.data.scope, allBranches);

  const statusHref = (s: PlanStatus | undefined) => {
    const query = new URLSearchParams();
    if (s) query.set("status", s);
    if (params.branch) query.set("branch", params.branch);
    const qs = query.toString();
    return qs ? `/admin/plans?${qs}` : "/admin/plans";
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">מסלולים</h1>
          <p className="text-muted-foreground">מי קנה מה, עד מתי, וכמה אימונים נוצלו</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdmin && (
            <>
              <Button variant="outline" asChild>
                <Link href="/admin/plans/products">קטלוג</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/admin/orders">הזמנות</Link>
              </Button>
            </>
          )}
          {products.length > 0 && (
            <NewTraineeSheet products={products} morningConfigured={isMorningConfigured()} isAdmin={isAdmin} />
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <BranchUrlFilter branches={branches} className="w-48" />
        <div className="flex flex-wrap gap-1">
          <Button size="sm" variant={status === undefined ? "default" : "outline"} asChild>
            <Link href={statusHref(undefined)}>הכל</Link>
          </Button>
          {STATUSES.map((s) => (
            <Button key={s} size="sm" variant={status === s ? "default" : "outline"} asChild>
              <Link href={statusHref(s)}>{PLAN_STATUS_LABELS_HE[s]}</Link>
            </Button>
          ))}
        </div>
      </div>
      <PlansTable rows={rows} isAdmin={isAdmin} />
    </div>
  );
}
