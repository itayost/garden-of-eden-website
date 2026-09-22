import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Removes a slot's group workout and the sessions it fanned out.
 *
 * Always call this before deleting a slot. training_sessions.slot_id is ON
 * DELETE SET NULL and clear_slot_workout finds those sessions by slot_id, so
 * after the slot is gone nothing can ever take them back and every roster
 * member keeps a workout for an hour that no longer exists. Individually
 * edited and completed sessions are exempt inside the function, as everywhere
 * else.
 *
 * Not a "use server" module — every export in one of those must be an async
 * server action, and this is an internal helper. Import it directly.
 */
export async function clearSlotWorkout(
  supabase: SupabaseClient,
  slotId: string,
): Promise<{ error: string | null }> {
  const rpcClient = supabase as unknown as {
    rpc: (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ error: { message: string } | null }>;
  };

  const { error } = await rpcClient.rpc("clear_slot_workout", { p_slot_id: slotId });
  if (error) {
    console.error("clear_slot_workout failed:", error);
    return { error: error.message };
  }

  return { error: null };
}
