"use server";

import { revalidatePath } from "next/cache";
import { verifyAdmin } from "@/lib/actions/shared";
import { createAdminClient } from "@/lib/supabase/admin";
import { metricMapSchema, type MetricMapInput } from "@/lib/validations/book-metric-map";

const SAVE_FAILED = "שמירת המיפוי נכשלה, נסו שוב";

type SaveResult = { success: true } | { error: string };

type Db = ReturnType<typeof createAdminClient>;

/** Whether every id is a parameter of the book; throws when the read fails. */
async function allParametersExist(db: Db, ids: readonly string[]): Promise<boolean> {
  if (ids.length === 0) return true;
  const { data, error } = await db.from("book_parameters").select("id").in("id", [...ids]);
  if (error) throw new Error(`book_parameters read failed: ${error.message}`);
  return new Set((data ?? []).map((row) => row.id)).size === ids.length;
}

/**
 * Replaces the metric's pairs with the list: the pairs of parameters not in
 * it go, then the missing ones are added (a pair already there stays as it
 * was, with its first `created_by`). The ids are UUIDs checked by the schema.
 */
async function replacePairs(db: Db, metricKey: string, ids: readonly string[], userId: string): Promise<void> {
  const remove = db.from("book_parameter_metrics").delete().eq("metric_key", metricKey);
  const { error: deleteError } = await (ids.length > 0
    ? remove.not("parameter_id", "in", `(${ids.join(",")})`)
    : remove);
  if (deleteError) throw new Error(`book_parameter_metrics delete failed: ${deleteError.message}`);
  if (ids.length === 0) return;

  const { error: insertError } = await db.from("book_parameter_metrics").upsert(
    ids.map((parameterId) => ({ parameter_id: parameterId, metric_key: metricKey, created_by: userId })),
    { onConflict: "parameter_id,metric_key", ignoreDuplicates: true },
  );
  if (insertError) throw new Error(`book_parameter_metrics insert failed: ${insertError.message}`);
}

/**
 * Saves which Development book parameters train one Goal metric, for the
 * metric-to-book map editor. Admins only.
 */
export async function saveMetricParametersAction(input: MetricMapInput): Promise<SaveResult> {
  const auth = await verifyAdmin();
  if (auth.error !== null) return { error: auth.error };

  const parsed = metricMapSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "נתונים לא תקינים" };
  const { metricKey, parameterIds } = parsed.data;

  const db = createAdminClient();
  try {
    if (!(await allParametersExist(db, parameterIds))) return { error: "פרמטר לא נמצא" };
    await replacePairs(db, metricKey, parameterIds, auth.user.id);
  } catch (error) {
    console.error("[development-book] metric map save failed:", error instanceof Error ? error.message : error);
    return { error: SAVE_FAILED };
  }

  revalidatePath("/admin/book/metrics");
  return { success: true };
}
