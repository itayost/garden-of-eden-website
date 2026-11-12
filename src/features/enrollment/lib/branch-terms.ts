import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { landingBranchByName } from "@/lib/branches/landing-branches";
import { termsFor } from "../../../../content/terms";

/**
 * The terms version an agreement for this branch records: the branch's own
 * תקנון (content/terms.ts). Throws when the branch cannot be read, so an
 * agreement is never stamped with another branch's terms by accident.
 */
export async function termsVersionOf(db: SupabaseClient, branchId: string): Promise<string> {
  const { data, error } = await db.from("branches").select("name_he").eq("id", branchId).maybeSingle();
  if (error) throw new Error(`branch ${branchId} lookup failed: ${error.message}`);
  return termsFor(landingBranchByName((data as { name_he: string } | null)?.name_he)?.key).version;
}
