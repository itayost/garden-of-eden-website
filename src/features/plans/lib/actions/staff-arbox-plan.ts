"use server";

import { getBranchScopeAction, verifyAdminOrTrainer } from "@/lib/actions/shared";
import { assertTraineeInScope } from "@/lib/actions/shared/assert-trainee";
import { BRANCH_MANAGER_REQUIRED } from "@/lib/actions/shared/verify-branch-manager";
import { canManageBranches } from "@/lib/branches/branch-scope";
import { checkRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { toE164 } from "@/lib/plans/local-phone";
import { arboxTermsProblem } from "@/lib/plans/arbox-terms";
import { israelToday } from "@/lib/utils/tasks";
import { arboxPlanSchema, type ArboxPlanInput } from "@/lib/validations/plans-admin";
import { recordArboxPlan } from "../arbox-plan";
import { revalidateStaffSurfaces } from "../revalidate-staff";
import { checkTraineeSale } from "../trainee-sale";

export type ArboxPlanOutcome =
  | { ok: true; startsOn: string; endsOn: string }
  | { duplicate: { minutesAgo: number } }
  | { error: string };

/**
 * A plan paid in Arbox, for a trainee who already has an account: a repair
 * for a sale the nightly import missed, so Admins and Branch managers of the
 * plan's branch only. Arbox sales otherwise arrive through the import with
 * Arbox's real terms. Same checks as a cash payment, but no receipt,
 * agreement, or WhatsApp.
 */
export async function recordArboxPlanAction(input: ArboxPlanInput): Promise<ArboxPlanOutcome> {
  const { error: authError, user, profile: staff } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };
  const parsed = arboxPlanSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "קלט לא תקין" };
  const data = parsed.data;

  // A repair tool: refuse anyone who manages no branch before doing any work;
  // the plan's own branch is checked once the product is known.
  const scope = await getBranchScopeAction();
  if ("error" in scope) return { error: scope.error };
  const managed = scope.data.managedBranchIds;
  if (staff!.role !== "admin" && managed.length === 0) return { error: BRANCH_MANAGER_REQUIRED };

  const termsProblem = arboxTermsProblem(data, israelToday());
  if (termsProblem) return { error: termsProblem };

  const limit = await checkRateLimit(`arbox-plan:${user!.id}`, "general");
  if (limit.rateLimited) return { error: "יותר מדי פעולות. נסו שוב בעוד כמה דקות." };

  const scopeError = await assertTraineeInScope(data.traineeId);
  if (scopeError) return { error: scopeError };

  const db = createAdminClient();
  const sale = await checkTraineeSale(db, {
    traineeId: data.traineeId,
    productId: data.productId,
    isAdmin: staff?.role === "admin",
    confirmDuplicate: data.confirmDuplicate,
  });
  if (!("ok" in sale)) return sale;
  const { product, trainee } = sale;
  if (!canManageBranches(staff!.role, managed, [product.branch_id])) return { error: BRANCH_MANAGER_REQUIRED };

  const loginPhone = toE164(trainee.phone);
  const result = await recordArboxPlan(db, {
    product,
    trainee: {
      profileId: data.traineeId,
      loginPhone,
      name: trainee.full_name ?? "מתאמן",
      birthdate: trainee.birthdate,
      parentName: trainee.guardian_name ?? "הורה",
      parentPhone: trainee.guardian_phone ? toE164(trainee.guardian_phone) : loginPhone,
    },
    terms: {
      startsOn: data.startsOn,
      endsOn: data.endsOn,
      sessionsTotal: data.sessionsTotal,
      amountIls: data.amountIls,
    },
    reference: data.reference,
    actor: { id: user!.id, name: staff?.full_name ?? null },
  });
  if (!result.ok) return { error: result.error };
  revalidateStaffSurfaces(data.traineeId);
  return { ok: true, startsOn: result.startsOn, endsOn: result.endsOn };
}
