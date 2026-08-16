"use server";

import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { createClient } from "@/lib/supabase/server";
import { typedFrom } from "@/lib/supabase/helpers";
import { isValidUUID } from "@/lib/validations/common";
import {
  TEMPLATE_SELECT_WITH_EXERCISES,
  type SessionTemplate,
  type SessionTemplateSummary,
} from "@/types/session-template";

type TemplateResult =
  | { success: true; data: SessionTemplate | null }
  | { error: string };

type SummariesResult =
  | { success: true; data: SessionTemplateSummary[] }
  | { error: string };

/**
 * Every template with its exercise count, newest edit first.
 *
 * Loaded by both the templates tab and the session builder page, so it stays
 * a count-only query — the full exercise list is fetched on selection.
 */
export async function listTemplatesAction(): Promise<SummariesResult> {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  const supabase = await createClient();
  const { data, error } = await typedFrom(supabase, "session_templates")
    .select(
      "id, name, description, created_by_name, updated_at, exercises:session_template_exercises(id)",
    )
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("List session templates error:", error);
    return { error: "שגיאה בטעינת התבניות" };
  }

  const rows = (data ?? []) as {
    id: string;
    name: string;
    description: string | null;
    created_by_name: string;
    updated_at: string;
    exercises: { id: string }[];
  }[];

  return {
    success: true,
    data: rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      createdByName: row.created_by_name,
      exerciseCount: row.exercises?.length ?? 0,
      updatedAt: row.updated_at,
    })),
  };
}

/** One template with its exercises, ordered. Null = not found. */
export async function getTemplateAction(
  templateId: string,
): Promise<TemplateResult> {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  if (!isValidUUID(templateId)) return { error: "מזהה תבנית לא תקין" };

  const supabase = await createClient();
  const { data, error } = await typedFrom(supabase, "session_templates")
    .select(TEMPLATE_SELECT_WITH_EXERCISES)
    .eq("id", templateId)
    .maybeSingle();

  if (error) {
    console.error("Get session template error:", error);
    return { error: "שגיאה בטעינת התבנית" };
  }

  if (!data) return { success: true, data: null };

  const template = data as SessionTemplate;

  return {
    success: true,
    data: {
      ...template,
      exercises: [...(template.exercises ?? [])].sort(
        (a, b) => a.order_index - b.order_index,
      ),
    },
  };
}
