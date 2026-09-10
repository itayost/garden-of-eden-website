"use server";

import { cache } from "react";
import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { createAdminClient } from "@/lib/supabase/admin";
import { israelToday } from "@/lib/utils/tasks";
import type { StaffPlanBadge } from "@/types/plans";
import { loadPlansWithUsage } from "../queries";

/**
 * Plan status and a medical flag for a set of trainees, for roster chips and
 * the users list. Service role: a trainer cannot read trainee_plans or the
 * health columns through RLS. Gated on verifyAdminOrTrainer; callers only
 * pass ids they are already allowed to display.
 */
export const loadPlanStatusesForStaff = cache(
  async (profileIds: readonly string[]): Promise<Record<string, StaffPlanBadge>> => {
    const { error } = await verifyAdminOrTrainer();
    if (error || profileIds.length === 0) return {};

    const db = createAdminClient();
    const [plans, { data: profiles }] = await Promise.all([
      loadPlansWithUsage(db, profileIds, israelToday()),
      db.from("profiles").select("id, medical_notes").in("id", [...profileIds]),
    ]);
    const medical = new Set((profiles ?? []).filter((p) => p.medical_notes).map((p) => p.id));

    const result: Record<string, StaffPlanBadge> = {};
    for (const [profileId, { plan, sessionsUsed, status }] of plans) {
      result[profileId] = {
        status,
        sessionsLeft:
          plan.sessions_total === null ? null : Math.max(plan.sessions_total - sessionsUsed, 0),
        endsOn: plan.ends_on,
        hasMedicalNotes: medical.has(profileId),
      };
    }
    // A trainee with medical notes but no plan (all of חיפה) still gets the flag.
    for (const id of medical) {
      if (!result[id]) {
        result[id] = { status: "active", sessionsLeft: null, endsOn: "", hasMedicalNotes: true };
      }
    }
    return result;
  },
);
