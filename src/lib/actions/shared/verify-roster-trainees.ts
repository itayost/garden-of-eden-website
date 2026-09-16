import { listProfileIdsInBranches } from "@/features/branches/lib/memberships";
import { createAdminClient } from "@/lib/supabase/admin";

/*
 * Not a "use server" module on purpose: exported from one, this helper would
 * become a callable server action that skips verifyAdminOrTrainer. Callers
 * are server actions that already verified the caller.
 */

/**
 * Verifies every linked roster entry points at a real, active trainee.
 *
 * The schema only checks UUID shape and the FK accepts any profile id, so
 * without this a crafted call could plant an admin's — or a deactivated
 * trainee's — id in a roster. The row would look linked on the board but
 * behave as free text and dead-end in the session builder, which filters on
 * role. Cheap to get right here, and the actor set is now every trainer.
 *
 * Admin client for the same reason as resolveTrainerName: a trainer cannot
 * read trainee rows through RLS. Callers are gated on verifyAdminOrTrainer.
 */
export async function verifyRosterTrainees(
  trainees: { traineeId: string | null; name: string }[],
  branchId: string,
): Promise<{ error: string | null }> {
  const ids = trainees
    .map((entry) => entry.traineeId)
    .filter((id): id is string => id !== null);

  // An all-free-text roster is legitimate — those names have no account.
  if (ids.length === 0) return { error: null };

  const db = createAdminClient();
  const [{ data, error }, members] = await Promise.all([
    db
      .from("profiles")
      .select("id")
      .in("id", ids)
      .eq("role", "trainee")
      .eq("is_active", true)
      .is("deleted_at", null),
    listProfileIdsInBranches(db, [branchId]),
  ]);

  if (error) {
    console.error("Verify roster trainees error:", error);
    return { error: "שגיאה באימות רשימת המתאמנים" };
  }

  // The schema already rejects duplicate ids, so a matching count means every
  // id resolved to a distinct active trainee.
  if ((data?.length ?? 0) !== ids.length) {
    return { error: "אחד המתאמנים ברשימה אינו קיים או אינו פעיל" };
  }

  // The pick-list only offers this branch's trainees; a direct call must not
  // roster someone from another branch.
  const memberSet = new Set(members);
  if (!ids.every((id) => memberSet.has(id))) {
    return { error: "אחד המתאמנים ברשימה אינו בסניף הזה" };
  }

  return { error: null };
}
