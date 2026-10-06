import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export interface TrainerOption {
  id: string;
  full_name: string | null;
}

/**
 * Active, non-deleted trainers and admins (Branch managers are trainers), by
 * name; null when the read failed. The post-training report reads it with
 * the service role in its server page (trainees may not read admin profiles
 * under RLS), so only names and ids reach the browser and no endpoint exists.
 */
export async function loadStaffOptions(db: SupabaseClient<Database>): Promise<TrainerOption[] | null> {
  const { data, error } = await db
    .from("profiles")
    .select("id, full_name")
    .in("role", ["trainer", "admin"])
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("full_name", { ascending: true });
  if (error) {
    console.error("List trainers error:", error);
    return null;
  }
  return data ?? [];
}
