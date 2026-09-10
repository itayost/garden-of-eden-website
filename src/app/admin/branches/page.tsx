import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { verifyAdmin } from "@/lib/actions/shared";
import { listBranchesWithCountsAction } from "@/features/branches/lib/actions/admin-branches";
import { BranchesClient } from "@/features/branches/components/admin/BranchesClient";

export const metadata: Metadata = {
  title: "ניהול סניפים | Garden of Eden",
};

export default async function AdminBranchesPage() {
  const { error } = await verifyAdmin();
  if (error) redirect("/admin");

  const branches = await listBranchesWithCountsAction();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">ניהול סניפים</h1>
        <p className="text-muted-foreground">
          הסניפים שהאקדמיה פועלת בהם. כל מאמן ומתאמן משויך לסניף אחד או לשניהם.
        </p>
      </div>

      <BranchesClient initialBranches={branches} />
    </div>
  );
}
