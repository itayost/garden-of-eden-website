import { createClient } from "@/lib/supabase/server";
import { typedFrom } from "@/lib/supabase/helpers";
import { isSaturdayInIsrael } from "@/lib/utils/israel-time";

const MAX_SHIFT_HOURS = 12;
const MAX_TIMESTAMP_AGE_MS = 2 * 60 * 60 * 1000; // 2 hours

interface SyncAction {
  type: "clock_in" | "clock_out";
  clientTimestamp: string;
}

function resolveTimestamp(
  clientTimestamp: string
): { value: string } | { error: string } {
  const parsed = new Date(clientTimestamp);
  if (isNaN(parsed.getTime())) {
    return { value: new Date().toISOString() };
  }

  const now = Date.now();

  if (parsed.getTime() > now + 60_000) {
    return { value: new Date().toISOString() };
  }

  if (now - parsed.getTime() > MAX_TIMESTAMP_AGE_MS) {
    return { error: "expired" };
  }

  return { value: parsed.toISOString() };
}

/**
 * POST /api/shifts/sync
 *
 * Processes queued shift actions (clock_in/clock_out) sent via
 * navigator.sendBeacon or Service Worker Background Sync.
 *
 * Body: { actions: SyncAction[] }
 * Auth: via Supabase session cookies (same-origin)
 */
export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify trainer/admin role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "trainer" && profile.role !== "admin")) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { actions?: SyncAction[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const actions = body.actions;
  if (!Array.isArray(actions) || actions.length === 0) {
    return Response.json({ error: "No actions" }, { status: 400 });
  }

  // Cap at 10 actions per request to prevent abuse
  const toProcess = actions.slice(0, 10);
  const results: { type: string; status: string; error?: string }[] = [];

  for (const action of toProcess) {
    if (action.type !== "clock_in" && action.type !== "clock_out") {
      results.push({ type: action.type, status: "error", error: "invalid_type" });
      continue;
    }

    const timestamp = resolveTimestamp(action.clientTimestamp);

    if ("error" in timestamp) {
      // Log expired action for admin notification
      await typedFrom(supabase, "failed_shift_syncs").insert({
        trainer_id: user.id,
        trainer_name: (profile.full_name as string) || "מאמן",
        action_type: action.type,
        client_timestamp: action.clientTimestamp,
        failure_reason: "expired",
      });
      results.push({ type: action.type, status: "expired" });
      continue;
    }

    if (action.type === "clock_in") {
      if (isSaturdayInIsrael()) {
        results.push({ type: "clock_in", status: "error", error: "saturday" });
        continue;
      }

      // Check for existing active shift
      const { data: existingShift } = await supabase
        .from("trainer_shifts")
        .select("id")
        .eq("trainer_id", user.id)
        .is("end_time", null)
        .maybeSingle();

      if (existingShift) {
        results.push({ type: "clock_in", status: "error", error: "already_active" });
        continue;
      }

      const { error: insertError } = await supabase
        .from("trainer_shifts")
        .insert({
          trainer_id: user.id,
          trainer_name: (profile.full_name as string) || "מאמן",
          start_time: timestamp.value,
        });

      if (insertError) {
        console.error("[shift-sync] Clock in error:", insertError);
        results.push({ type: "clock_in", status: "error", error: "db_error" });
      } else {
        results.push({ type: "clock_in", status: "ok" });
      }
    } else {
      // clock_out
      const { data: activeShift } = await supabase
        .from("trainer_shifts")
        .select("id, start_time")
        .eq("trainer_id", user.id)
        .is("end_time", null)
        .maybeSingle();

      if (!activeShift) {
        results.push({ type: "clock_out", status: "error", error: "no_active_shift" });
        continue;
      }

      const startTime = new Date(activeShift.start_time);
      const endTime = new Date(timestamp.value);
      const hoursDiff =
        (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
      const flagForReview = hoursDiff > MAX_SHIFT_HOURS;

      const { error: updateError } = await supabase
        .from("trainer_shifts")
        .update({
          end_time: timestamp.value,
          flagged_for_review: flagForReview,
        })
        .eq("id", activeShift.id);

      if (updateError) {
        console.error("[shift-sync] Clock out error:", updateError);
        results.push({ type: "clock_out", status: "error", error: "db_error" });
      } else {
        results.push({ type: "clock_out", status: "ok" });
      }
    }
  }

  return Response.json({ results });
}
