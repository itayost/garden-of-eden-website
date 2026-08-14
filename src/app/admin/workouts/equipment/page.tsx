import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { EquipmentManager } from "@/components/admin/equipment/EquipmentManager";
import { listEquipmentWithUsageAction } from "@/lib/actions/equipment";
import { verifyAdminOrTrainer } from "@/lib/actions/shared";

export const metadata: Metadata = {
  title: "ציוד | Garden of Eden",
};

export default async function EquipmentPage() {
  const { error: authError, profile } = await verifyAdminOrTrainer();
  if (authError) redirect("/dashboard");

  const result = await listEquipmentWithUsageAction();
  const equipment = "success" in result ? result.data : [];
  const loadError = "error" in result ? result.error : null;

  return (
    <EquipmentManager
      equipment={equipment}
      loadError={loadError}
      isAdmin={profile!.role === "admin"}
    />
  );
}
