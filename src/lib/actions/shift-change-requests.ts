"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { typedFrom } from "@/lib/supabase/helpers";
import { verifyAdmin, verifyAdminOrTrainer } from "./shared/verify-admin";
import { isValidUUID } from "@/lib/validations/common";
import {
  validateShiftChangeRequestInput,
  type ShiftChangeRequestInput,
} from "@/lib/validations/shift-change-requests";
import { israelDateStr } from "@/lib/utils/israel-time";
import type {
  ShiftChangeRequest,
  ShiftChangeRequestStatus,
  TrainerShift,
} from "@/types/database";

type ApprovalMode = "edit" | "retro_insert" | "retro_merge";

type ActionResult<T = undefined> =
  | { success: true; data?: T; error?: never }
  | { success?: never; error: string };

const REQUESTS_TABLE = "shift_change_requests";
const SHIFTS_TABLE = "trainer_shifts";
const ACTIVITY_TABLE = "activity_logs";

// =====================================================
// Trainer-facing actions
// =====================================================

export async function submitShiftChangeRequestAction(
  input: ShiftChangeRequestInput
): Promise<ActionResult<{ id: string }>> {
  const auth = await verifyAdminOrTrainer();
  if (auth.error) return { error: auth.error };
  const user = auth.user!;
  const profile = auth.profile!;

  const validation = validateShiftChangeRequestInput(input);
  if (!validation.valid) return { error: validation.error };

  const supabase = await createClient();

  let originalStart: string | null = null;
  let originalEnd: string | null = null;

  if (input.type === "edit") {
    const { data: target, error: targetError } = await typedFrom(supabase, SHIFTS_TABLE)
      .select("id, trainer_id, start_time, end_time")
      .eq("id", input.target_shift_id)
      .maybeSingle();

    if (targetError) {
      console.error("submitShiftChangeRequest: load target error:", targetError);
      return { error: "שגיאה בטעינת המשמרת" };
    }
    if (!target) return { error: "המשמרת לא נמצאה" };
    if ((target as TrainerShift).trainer_id !== user.id) {
      return { error: "אין לך הרשאה לבקש שינוי במשמרת זו" };
    }

    originalStart = (target as TrainerShift).start_time;
    originalEnd = (target as TrainerShift).end_time;

    const { data: existing } = await typedFrom(supabase, REQUESTS_TABLE)
      .select("id")
      .eq("target_shift_id", input.target_shift_id)
      .eq("status", "pending")
      .maybeSingle();
    if (existing) {
      return { error: "כבר קיימת בקשה ממתינה למשמרת זו" };
    }
  } else {
    // SQL-prefilter to a 26-hour window around the requested start (covers DST + day boundary),
    // then verify exact Israel-day match in JS to avoid timezone math in the query.
    const reqStartMs = new Date(input.requested_start_time).getTime();
    const windowMs = 26 * 60 * 60 * 1000;
    const requestedDay = israelDateStr(input.requested_start_time);

    const { data: existing } = await typedFrom(supabase, REQUESTS_TABLE)
      .select("id, requested_start_time")
      .eq("trainer_id", user.id)
      .eq("request_type", "retro_add")
      .eq("status", "pending")
      .gte("requested_start_time", new Date(reqStartMs - windowMs).toISOString())
      .lte("requested_start_time", new Date(reqStartMs + windowMs).toISOString());

    const conflict = (existing as { requested_start_time: string }[] | null)?.find(
      (row) => israelDateStr(row.requested_start_time) === requestedDay
    );
    if (conflict) {
      return { error: "כבר קיימת בקשת הוספת משמרת ממתינה לתאריך זה" };
    }
  }

  const trainerName = profile.full_name ?? "";

  const { data: inserted, error: insertError } = await typedFrom(supabase, REQUESTS_TABLE)
    .insert({
      trainer_id: user.id,
      trainer_name: trainerName,
      request_type: input.type,
      target_shift_id: input.type === "edit" ? input.target_shift_id : null,
      original_start_time: originalStart,
      original_end_time: originalEnd,
      requested_start_time: input.requested_start_time,
      requested_end_time: input.requested_end_time,
      reason: input.reason ?? null,
      status: "pending",
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    console.error("submitShiftChangeRequest: insert error:", insertError);
    return { error: "שגיאה בשמירת הבקשה" };
  }

  const requestId = (inserted as { id: string }).id;

  await typedFrom(supabase, ACTIVITY_TABLE).insert({
    user_id: user.id,
    action: "shift_change_request_created",
    actor_id: user.id,
    actor_name: trainerName,
    metadata: {
      request_id: requestId,
      type: input.type,
      target_shift_id: input.type === "edit" ? input.target_shift_id : null,
      requested_start: input.requested_start_time,
      requested_end: input.requested_end_time,
      reason: input.reason ?? null,
    },
  });

  revalidatePath("/admin/shifts");
  return { success: true, data: { id: requestId } };
}

export async function cancelShiftChangeRequestAction(
  requestId: string
): Promise<ActionResult> {
  const auth = await verifyAdminOrTrainer();
  if (auth.error) return { error: auth.error };
  const user = auth.user!;
  const profile = auth.profile!;

  if (!isValidUUID(requestId)) return { error: "מזהה לא תקין" };

  const supabase = await createClient();

  const { data: updated, error } = await typedFrom(supabase, REQUESTS_TABLE)
    .update({ status: "cancelled" })
    .eq("id", requestId)
    .eq("trainer_id", user.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("cancelShiftChangeRequest: update error:", error);
    return { error: "שגיאה בביטול הבקשה" };
  }
  if (!updated) {
    return { error: "הבקשה כבר טופלה או לא קיימת" };
  }

  await typedFrom(supabase, ACTIVITY_TABLE).insert({
    user_id: user.id,
    action: "shift_change_request_cancelled",
    actor_id: user.id,
    actor_name: profile.full_name ?? "",
    metadata: { request_id: requestId },
  });

  revalidatePath("/admin/shifts");
  return { success: true };
}

/**
 * The subset of a request a trainer is allowed to see. Decision fields
 * (decision_note, decided_by, decided_at, applied_shift_id) are excluded so an
 * admin's verdict and its reasoning never reach the trainer's browser.
 */
export type MyShiftChangeRequest = Pick<
  ShiftChangeRequest,
  | "id"
  | "request_type"
  | "target_shift_id"
  | "original_start_time"
  | "original_end_time"
  | "requested_start_time"
  | "requested_end_time"
  | "reason"
  | "status"
  | "created_at"
>;

const MY_REQUEST_COLUMNS =
  "id, request_type, target_shift_id, original_start_time, original_end_time, requested_start_time, requested_end_time, reason, status, created_at";

export async function getMyShiftChangeRequestsAction(): Promise<
  ActionResult<MyShiftChangeRequest[]>
> {
  const auth = await verifyAdminOrTrainer();
  if (auth.error) return { error: auth.error };
  const user = auth.user!;

  const supabase = await createClient();

  // Pending only: once an admin decides, the request drops out of the
  // trainer's view entirely. RLS enforces the same rule server-side.
  const { data, error } = await typedFrom(supabase, REQUESTS_TABLE)
    .select(MY_REQUEST_COLUMNS)
    .eq("trainer_id", user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("getMyShiftChangeRequests: fetch error:", error);
    return { error: "שגיאה בטעינת הבקשות" };
  }

  return { success: true, data: (data ?? []) as MyShiftChangeRequest[] };
}

// =====================================================
// Admin-facing actions
// =====================================================

export type ShiftChangeRequestWithPreview = ShiftChangeRequest & {
  merge_preview:
    | { existing_shift_id: string; existing_start: string; existing_end: string | null }
    | null;
};

export async function getShiftChangeRequestsAction(filter?: {
  status?: ShiftChangeRequestStatus | "all";
}): Promise<ActionResult<ShiftChangeRequestWithPreview[]>> {
  const auth = await verifyAdmin();
  if (auth.error) return { error: auth.error };

  const supabase = await createClient();

  let query = typedFrom(supabase, REQUESTS_TABLE)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  const status = filter?.status ?? "pending";
  if (status !== "all") {
    query = query.eq("status", status);
  }

  const { data: requests, error } = await query;
  if (error) {
    console.error("getShiftChangeRequests: fetch error:", error);
    return { error: "שגיאה בטעינת הבקשות" };
  }

  const rows = (requests ?? []) as ShiftChangeRequest[];

  const retroAddRows = rows.filter(
    (r) => r.request_type === "retro_add" && r.status === "pending"
  );
  if (retroAddRows.length === 0) {
    return {
      success: true,
      data: rows.map((r) => ({ ...r, merge_preview: null })),
    };
  }

  const trainerIds = Array.from(new Set(retroAddRows.map((r) => r.trainer_id)));
  const requestedTimes = retroAddRows.map((r) =>
    new Date(r.requested_start_time).getTime()
  );
  const windowMs = 26 * 60 * 60 * 1000;
  const rangeStart = new Date(Math.min(...requestedTimes) - windowMs).toISOString();
  const rangeEnd = new Date(Math.max(...requestedTimes) + windowMs).toISOString();

  const { data: shifts } = await typedFrom(supabase, SHIFTS_TABLE)
    .select("id, trainer_id, start_time, end_time")
    .in("trainer_id", trainerIds)
    .gte("start_time", rangeStart)
    .lte("start_time", rangeEnd);

  const shiftsByTrainer = new Map<string, TrainerShift[]>();
  ((shifts ?? []) as TrainerShift[]).forEach((s) => {
    const list = shiftsByTrainer.get(s.trainer_id) ?? [];
    list.push(s);
    shiftsByTrainer.set(s.trainer_id, list);
  });

  const enriched: ShiftChangeRequestWithPreview[] = rows.map((r) => {
    if (r.request_type !== "retro_add" || r.status !== "pending") {
      return { ...r, merge_preview: null };
    }
    const requestDay = israelDateStr(r.requested_start_time);
    const trainerShifts = shiftsByTrainer.get(r.trainer_id) ?? [];
    const sameDay = trainerShifts.filter(
      (s) => israelDateStr(s.start_time) === requestDay
    );
    if (sameDay.length === 1) {
      return {
        ...r,
        merge_preview: {
          existing_shift_id: sameDay[0].id,
          existing_start: sameDay[0].start_time,
          existing_end: sameDay[0].end_time,
        },
      };
    }
    return { ...r, merge_preview: null };
  });

  return { success: true, data: enriched };
}

export async function getPendingShiftChangeRequestsCountAction(): Promise<
  ActionResult<{ count: number }>
> {
  const auth = await verifyAdmin();
  if (auth.error) return { error: auth.error };

  const supabase = await createClient();

  const { count, error } = await typedFrom(supabase, REQUESTS_TABLE)
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  if (error) {
    console.error("getPendingShiftChangeRequestsCount: error:", error);
    return { error: "שגיאה בספירת הבקשות" };
  }

  return { success: true, data: { count: count ?? 0 } };
}

export async function approveShiftChangeRequestAction(
  requestId: string,
  note?: string
): Promise<ActionResult<{ applied_shift_id: string; mode: ApprovalMode }>> {
  const auth = await verifyAdmin();
  if (auth.error) return { error: auth.error };
  const user = auth.user!;
  const adminProfile = auth.adminProfile!;

  if (!isValidUUID(requestId)) return { error: "מזהה לא תקין" };

  const supabase = await createClient();

  const { data: requestRow, error: loadError } = await typedFrom(supabase, REQUESTS_TABLE)
    .select("*")
    .eq("id", requestId)
    .maybeSingle();

  if (loadError) {
    console.error("approveShiftChangeRequest: load error:", loadError);
    return { error: "שגיאה בטעינת הבקשה" };
  }
  if (!requestRow) return { error: "הבקשה לא נמצאה" };

  const request = requestRow as ShiftChangeRequest;

  // RPC isn't in the generated Database types yet, so cast through unknown.
  const { data: rpcData, error: rpcError } = await (
    supabase as unknown as {
      rpc: (
        name: string,
        params: Record<string, unknown>
      ) => Promise<{
        data: { applied_shift_id: string; mode: string }[] | null;
        error: { message: string } | null;
      }>;
    }
  ).rpc("approve_shift_change_request", {
    p_request_id: requestId,
    p_actor_id: user.id,
    p_note: note ?? null,
  });

  if (rpcError) {
    const message = rpcError.message || "שגיאה באישור הבקשה";
    console.error("approveShiftChangeRequest: rpc error:", rpcError);
    return { error: message };
  }

  const result = Array.isArray(rpcData) ? rpcData[0] : null;
  const appliedShiftId = result?.applied_shift_id ?? null;
  const mode = (result?.mode ?? null) as ApprovalMode | null;

  if (!appliedShiftId || !mode) {
    return { error: "שגיאה לא צפויה באישור הבקשה" };
  }

  await typedFrom(supabase, ACTIVITY_TABLE).insert({
    user_id: request.trainer_id,
    action: "shift_change_request_approved",
    actor_id: user.id,
    actor_name: adminProfile.full_name ?? "",
    metadata: {
      request_id: requestId,
      mode,
      applied_shift_id: appliedShiftId,
      note: note ?? null,
    },
    changes: [
      {
        field: "start_time",
        old_value: request.original_start_time,
        new_value: request.requested_start_time,
      },
      {
        field: "end_time",
        old_value: request.original_end_time,
        new_value: request.requested_end_time,
      },
    ],
  });

  revalidatePath("/admin/shifts");
  return {
    success: true,
    data: { applied_shift_id: appliedShiftId, mode },
  };
}

export async function rejectShiftChangeRequestAction(
  requestId: string,
  note?: string
): Promise<ActionResult> {
  const auth = await verifyAdmin();
  if (auth.error) return { error: auth.error };
  const user = auth.user!;
  const adminProfile = auth.adminProfile!;

  if (!isValidUUID(requestId)) return { error: "מזהה לא תקין" };

  const supabase = await createClient();

  const { data: updated, error } = await typedFrom(supabase, REQUESTS_TABLE)
    .update({
      status: "rejected",
      decided_by: user.id,
      decided_at: new Date().toISOString(),
      decision_note: note ?? null,
    })
    .eq("id", requestId)
    .eq("status", "pending")
    .select("id, trainer_id")
    .maybeSingle();

  if (error) {
    console.error("rejectShiftChangeRequest: update error:", error);
    return { error: "שגיאה בדחיית הבקשה" };
  }
  if (!updated) {
    return { error: "הבקשה כבר טופלה" };
  }

  const row = updated as { id: string; trainer_id: string };

  await typedFrom(supabase, ACTIVITY_TABLE).insert({
    user_id: row.trainer_id,
    action: "shift_change_request_rejected",
    actor_id: user.id,
    actor_name: adminProfile.full_name ?? "",
    metadata: { request_id: requestId, note: note ?? null },
  });

  revalidatePath("/admin/shifts");
  return { success: true };
}
