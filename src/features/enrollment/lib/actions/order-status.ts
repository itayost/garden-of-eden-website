"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/helpers";
import { isValidUUID } from "@/lib/validations/common";
import { israelToday } from "@/lib/utils/tasks";
import type { PlanStart } from "@/lib/plans/plan-queue";
import { loadPlanPlacement } from "@/features/plans/lib/queries";
import type { OrderStatus } from "@/types/plans";

/** The success page asks right after paying; later the start is not given out. */
const START_SHOWN_FOR_MS = 60 * 60 * 1000;

type StatusResult =
  | {
      status: OrderStatus;
      /** The Plan exists, or fulfillment failed and staff take over: either way, stop waiting. */
      settled: boolean;
      start: PlanStart | null;
    }
  | { error: string };

/**
 * Public by necessity: the parent on the success page has no session. For a
 * uuid the caller already holds it gives the status and, within an hour of
 * the Plan being created, when that Plan starts. Nothing else.
 */
export async function getOrderStatusAction(orderId: string): Promise<StatusResult> {
  if (!isValidUUID(orderId)) return { error: "מזהה הזמנה לא תקין" };

  const db = createAdminClient();
  const { data } = (await typedFrom(db, "orders")
    .select("status, fulfilled_at, fulfillment_error, profile_id")
    .eq("id", orderId)
    .maybeSingle()) as {
    data: {
      status: OrderStatus;
      fulfilled_at: string | null;
      fulfillment_error: string | null;
      profile_id: string | null;
    } | null;
  };

  if (!data) return { error: "ההזמנה לא נמצאה" };
  const settled = data.fulfilled_at !== null || data.fulfillment_error !== null;
  const fresh =
    data.fulfilled_at !== null && Date.now() - new Date(data.fulfilled_at).getTime() < START_SHOWN_FOR_MS;
  if (!fresh || !data.profile_id) return { status: data.status, settled, start: null };

  const placement = await loadPlanPlacement(db, data.profile_id, orderId, israelToday());
  return { status: data.status, settled, start: placement?.start ?? null };
}
