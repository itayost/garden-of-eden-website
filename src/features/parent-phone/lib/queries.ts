import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { israelDateStr } from "@/lib/utils/israel-time";
import { israelToday } from "@/lib/utils/tasks";
import { shouldAskParentPhone } from "./prompt";

export interface ParentPrompt {
  ask: boolean;
  /** "אני מעל 18" is offered only when the birthdate is unknown. */
  birthdateKnown: boolean;
}

const NO_PROMPT: ParentPrompt = { ask: false, birthdateKnown: true };

/**
 * Whether the dashboard should ask this Trainee for a parent phone. A failed
 * read asks nothing: a missing card must never break the dashboard.
 */
export async function loadParentPrompt(userId: string): Promise<ParentPrompt> {
  try {
    const { data, error } = await createAdminClient()
      .from("profiles")
      .select("role, guardian_phone, guardian_not_needed, birthdate, guardian_prompt_dismissed_at")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return NO_PROMPT;

    const ask = shouldAskParentPhone(
      {
        role: data.role,
        guardianPhone: data.guardian_phone,
        guardianNotNeeded: data.guardian_not_needed,
        birthdate: data.birthdate,
        dismissedOn: data.guardian_prompt_dismissed_at ? israelDateStr(data.guardian_prompt_dismissed_at) : null,
      },
      israelToday(),
    );
    return { ask, birthdateKnown: data.birthdate !== null };
  } catch (error) {
    console.error("[parent-phone] prompt unavailable:", error instanceof Error ? error.message : error);
    return NO_PROMPT;
  }
}
