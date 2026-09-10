import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { verifyAdminOrTrainer, getBranchScopeAction } from "@/lib/actions/shared";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadAllBranches } from "@/features/branches/lib/memberships";
import { isInBranchScope } from "@/lib/branches/branch-scope";
import { SafetyProtocol } from "@/features/safety/components/SafetyProtocol";
import { PrintButton } from "@/features/safety/components/PrintButton";

export const metadata: Metadata = { title: "נוהל בטיחות וחירום | Garden of Eden" };

export default async function SafetyPage() {
  const { error } = await verifyAdminOrTrainer();
  if (error) redirect("/dashboard");

  const scopeResult = await getBranchScopeAction();
  if ("error" in scopeResult) redirect("/dashboard");
  const scope = scopeResult.data.scope;

  // Manager phones are read through the service role (the page is gated
  // above); a trainer sees the managers of their own branches only.
  const branches = (await loadAllBranches(createAdminClient())).filter(
    (b) => b.is_active && isInBranchScope(scope, [b.id]),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold">
            <ShieldAlert className="h-7 w-7 text-destructive" />
            נוהל בטיחות וחירום
          </h1>
          <p className="text-muted-foreground">מסמך פנימי לצוות האימון</p>
        </div>
        <PrintButton />
      </div>
      <SafetyProtocol branches={branches} />
    </div>
  );
}
