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

export interface BulkLeadsResult {
  readonly inserted: number;
  readonly skipped: number;
  readonly errors: ReadonlyArray<{ index: number; message: string }>;
}

const BATCH_SIZE = 100;

/**
 * Bulk-create leads pasted from a spreadsheet. Each row is validated; rows whose
 * phone already exists (in the DB or earlier in the same paste) are skipped and
 * counted; the rest are inserted in batches under the chosen tab/source/status.
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

  // Dedup against existing DB phones (one query) and within the batch.
  const phones = validRows
    .map((v) => v.row.phone)
    .filter((p): p is string => p !== null);

  const seen = new Set<string>();
  if (phones.length > 0) {
    const { data: existingRows } = await typedFrom(supabase, "leads")
      .select("phone")
      .in("phone", phones);
    for (const r of existingRows ?? []) {
      if (r.phone) seen.add(r.phone as string);
    }
  }

  let skipped = 0;
  const payloads: Record<string, unknown>[] = [];
  for (const { row } of validRows) {
    if (row.phone) {
      if (seen.has(row.phone)) {
        skipped++;
        continue;
      }
      seen.add(row.phone);
    }
    payloads.push({
      phone: row.phone,
      name: row.name,
      is_from_haifa: row.is_from_haifa,
      status,
      source,
      tab_id,
      note: row.note,
      club: row.club,
      birth_year: row.birth_year,
    });
  }

  let inserted = 0;
  for (let i = 0; i < payloads.length; i += BATCH_SIZE) {
    const batch = payloads.slice(i, i + BATCH_SIZE);
    const { data, error } = await typedFrom(supabase, "leads").insert(batch).select("id");
    if (error) {
      console.error("Bulk leads insert error:", error);
      errors.push({ index: -1, message: `שגיאה בשמירת קבוצה (${batch.length} שורות)` });
      continue;
    }
    inserted += data?.length ?? 0;
  }

  if (inserted > 0) revalidatePath("/admin/leads");

  return { inserted, skipped, errors };
}
