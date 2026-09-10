"use server";

import { revalidatePath } from "next/cache";
import { verifyAdmin } from "@/lib/actions/shared";
import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/helpers";
import { isValidUUID, UUID_REGEX } from "@/lib/validations/common";
import { productSchema, type ProductInput } from "@/lib/validations/plans-admin";
import type { PlanProduct } from "@/types/plans";

type ActionResult =
  | { success: true }
  | { error: string; fieldErrors?: Record<string, string[]> };

function revalidate(): void {
  revalidatePath("/admin/plans/products");
  revalidatePath("/admin/plans");
  revalidatePath("/join");
}

export async function listProductsAction(): Promise<PlanProduct[]> {
  const { error } = await verifyAdmin();
  if (error) return [];
  const { data } = (await typedFrom(createAdminClient(), "plan_products")
    .select("*")
    .order("order_index")) as { data: PlanProduct[] | null };
  return (data ?? []).map((p) => ({ ...p, price_ils: Number(p.price_ils) }));
}

/** No create and no delete: the catalog is the price sheet. Deactivate instead. */
export async function updateProductAction(id: string, input: ProductInput): Promise<ActionResult> {
  const { error: authError } = await verifyAdmin();
  if (authError) return { error: authError };
  if (!isValidUUID(id)) return { error: "מזהה מסלול לא תקין" };

  const validated = productSchema.safeParse(input);
  if (!validated.success) {
    return {
      error: "אימות נתונים נכשל",
      fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { error } = await typedFrom(createAdminClient(), "plan_products")
    .update(validated.data)
    .eq("id", id);
  if (error) return { error: "שגיאה בעדכון המסלול" };
  revalidate();
  return { success: true };
}

export async function reorderProductsAction(ids: string[]): Promise<ActionResult> {
  const { error: authError } = await verifyAdmin();
  if (authError) return { error: authError };
  if (!ids.length || ids.some((id) => !UUID_REGEX.test(id))) return { error: "רשימה לא תקינה" };

  const db = createAdminClient();
  for (const [index, id] of ids.entries()) {
    const { error } = await typedFrom(db, "plan_products")
      .update({ order_index: index })
      .eq("id", id);
    if (error) return { error: "שגיאה בסידור" };
  }
  revalidate();
  return { success: true };
}
