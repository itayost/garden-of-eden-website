"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { typedFrom } from "@/lib/supabase/helpers";
import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import {
  bulkLeadRowSchema,
  bulkLeadImportSettingsSchema,
  type BulkLeadImportSettings,
} from "@/lib/validations/leads";
import type { ParsedLeadRow } from "@/lib/utils/parse-leads-paste";
import { leadNameKey, planLeadImport } from "@/lib/utils/plan-lead-import";

export interface BulkLeadsResult {
  readonly inserted: number;
  readonly skipped: number;
  readonly errors: ReadonlyArray<{ index: number; message: string }>;
}

const BATCH_SIZE = 100;

/**
 * Bulk-create leads pasted from a spreadsheet. Each row is validated; rows the
 * target tab already holds, or that repeat earlier in the paste, are skipped
 * and counted (planLeadImport); the rest are inserted in batches under the
 * chosen tab/source/status.
 */
export async function createLeadsBulk(
  rows: readonly ParsedLeadRow[],
  settings: BulkLeadImportSettings,
): Promise<BulkLeadsResult> {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) return { inserted: 0, skipped: 0, errors: [{ index: -1, message: authError }] };

  const parsedSettings = bulkLeadImportSettingsSchema.safeParse(settings);
  if (!parsedSettings.success) {
    return { inserted: 0, skipped: 0, errors: [{ index: -1, message: "הגדרות ייבוא לא תקינות" }] };
  }
  const { tab_id, source, status } = parsedSettings.data;

  const supabase = await createClient();

  // Tab must exist and be active.
  const { data: tab } = await typedFrom(supabase, "lead_tabs")
    .select("id")
    .eq("id", tab_id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!tab) {
    return { inserted: 0, skipped: 0, errors: [{ index: -1, message: "טאב לא נמצא" }] };
  }

  // Per-row validation.
  const errors: Array<{ index: number; message: string }> = [];
  const validRows: { row: typeof rows[number]; index: number }[] = [];
  rows.forEach((row, index) => {
    const parsed = bulkLeadRowSchema.safeParse(row);
    if (parsed.success) {
      validRows.push({ row, index });
    } else {
      errors.push({ index, message: parsed.error.issues[0]?.message ?? "שורה לא תקינה" });
    }
  });

  if (validRows.length === 0) {
    return { inserted: 0, skipped: 0, errors };
  }

  // Duplicates are checked against the target tab only: the same phone may
  // sit in another tab (a monthly list pasted again into a new tab).
  const rowsToCheck = validRows.map((v) => v.row);
  const phones = [...new Set(rowsToCheck.map((r) => r.phone).filter((p): p is string => p !== null))];
  const [phoneRead, nameRead] = await Promise.all([
    phones.length > 0
      ? typedFrom(supabase, "leads").select("phone").eq("tab_id", tab_id).in("phone", phones)
      : Promise.resolve({ data: [], error: null }),
    typedFrom(supabase, "leads").select("name").eq("tab_id", tab_id).is("phone", null),
  ]);
  if (phoneRead.error || nameRead.error) {
    console.error("Bulk leads duplicate check error:", phoneRead.error ?? nameRead.error);
    return { inserted: 0, skipped: 0, errors: [{ index: -1, message: "שגיאה בבדיקת כפילויות" }] };
  }

  const plan = planLeadImport(rowsToCheck, {
    phones: new Set((phoneRead.data ?? []).map((r: { phone: string }) => r.phone)),
    phonelessNames: new Set((nameRead.data ?? []).map((r: { name: string }) => leadNameKey(r.name))),
  });

  let skipped = plan.skipped;
  const payloads: Record<string, unknown>[] = plan.insert.map((row) => ({
    phone: row.phone,
    name: row.name,
    is_from_haifa: row.is_from_haifa,
    status,
    source,
    tab_id,
    note: row.note,
    club: row.club,
    birth_year: row.birth_year,
    additional_info: row.additional_info,
  }));

  let inserted = 0;
  for (let i = 0; i < payloads.length; i += BATCH_SIZE) {
    const batch = payloads.slice(i, i + BATCH_SIZE);
    const { data, error } = await typedFrom(supabase, "leads").insert(batch).select("id");
    if (!error) {
      inserted += data?.length ?? 0;
      continue;
    }

    // A single bad row (e.g. a duplicate phone added since the check) fails
    // the whole atomic chunk — retry row-by-row so the rest still save.
    console.error("Bulk leads insert error, retrying per-row:", error);
    for (const payload of batch) {
      const { data: one, error: rowErr } = await typedFrom(supabase, "leads")
        .insert(payload)
        .select("id");
      if (!rowErr) {
        inserted += one?.length ?? 0;
      } else if (rowErr.code === "23505") {
        skipped++; // unique-violation = phone already in this tab
      } else {
        errors.push({ index: -1, message: rowErr.message });
      }
    }
  }

  if (inserted > 0) revalidatePath("/admin/leads");

  return { inserted, skipped, errors };
}
