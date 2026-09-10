"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/helpers";
import { isValidUUID } from "@/lib/validations/common";
import type { OrderStatus } from "@/types/plans";

type StatusResult = { status: OrderStatus; fulfilled: boolean } | { error: string };

/**
 * Public by necessity: the parent on the success page has no session. It
 * leaks nothing beyond a status for a uuid the caller already holds.
 */
export async function getOrderStatusAction(orderId: string): Promise<StatusResult> {
  if (!isValidUUID(orderId)) return { error: "מזהה הזמנה לא תקין" };

  const { data } = (await typedFrom(createAdminClient(), "orders")
    .select("status, fulfilled_at")
    .eq("id", orderId)
    .maybeSingle()) as { data: { status: OrderStatus; fulfilled_at: string | null } | null };

  if (!data) return { error: "ההזמנה לא נמצאה" };
  return { status: data.status, fulfilled: data.fulfilled_at !== null };
}
