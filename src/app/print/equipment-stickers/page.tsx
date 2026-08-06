import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { StickerSheet } from "@/components/admin/equipment/StickerSheet";
import { listEquipmentAction } from "@/lib/actions/equipment";
import { verifyAdminOrTrainer } from "@/lib/actions/shared";

export const metadata: Metadata = {
  title: "מדבקות QR | Garden of Eden",
};

/**
 * Lives OUTSIDE the /admin layout on purpose: the admin chrome (sidebar, top
 * bar, tabs) has no print styling and would land on the A4 sticker sheet.
 * /print is not middleware-protected, so auth is enforced here.
 */
export default async function StickerPrintPage() {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) redirect("/auth/login?redirect=/print/equipment-stickers");

  const result = await listEquipmentAction();
  const equipment = ("success" in result ? result.data : []).filter(
    (item) => item.is_active,
  );

  return <StickerSheet equipment={equipment} />;
}
