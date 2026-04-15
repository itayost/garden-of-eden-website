"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { typedFrom } from "@/lib/supabase/helpers";
import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import {
  createChurnedCustomerSchema,
  updateChurnedCustomerSchema,
  bulkRowSchema,
  churnedIdSchema,
  type CreateChurnedCustomerInput,
  type UpdateChurnedCustomerInput,
  type NoteColor,
} from "@/lib/validations/churned-customers";

export interface ChurnedCustomer {
  readonly id: string;
  readonly name: string;
  readonly end_date: string;
  readonly note: string;
  readonly note_color: NoteColor;
  readonly author_id: string;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface ActionError {
  readonly error: string;
}

export interface ActionOk<T> {
  readonly data: T;
  readonly error: null;
}

type ActionResult<T> = ActionOk<T> | { data: null; error: string };

const REVALIDATE_PATH = "/admin/retention";
const CHURNED_COLUMNS =
  "id, name, end_date, note, note_color, author_id, created_at, updated_at";
const LIST_LIMIT = 5000;

export async function listChurnedCustomers(): Promise<
  readonly ChurnedCustomer[]
> {
  const { error } = await verifyAdminOrTrainer();
  if (error) return [];

  const supabase = await createClient();
  const { data } = await typedFrom(supabase, "churned_customers")
    .select(CHURNED_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(LIST_LIMIT);

  return (data ?? []) as unknown as ChurnedCustomer[];
}

export async function createChurnedCustomer(
  input: CreateChurnedCustomerInput,
): Promise<ActionResult<ChurnedCustomer>> {
  const { error: authError, user } = await verifyAdminOrTrainer();
  if (authError) return { data: null, error: authError };

  const parsed = createChurnedCustomerSchema.safeParse(input);
  if (!parsed.success) return { data: null, error: "קלט לא תקין" };

  const supabase = await createClient();
  const { data, error: dbError } = await typedFrom(supabase, "churned_customers")
    .insert({
      name: parsed.data.name,
      end_date: parsed.data.endDate,
      note: parsed.data.note,
      note_color: parsed.data.noteColor,
      author_id: user!.id,
    })
    .select(CHURNED_COLUMNS)
    .single();

  if (dbError) {
    console.error("[ChurnedCustomers] Create error:", dbError);
    return { data: null, error: "שגיאה בשמירה" };
  }

  revalidatePath(REVALIDATE_PATH);
  return { data: data as unknown as ChurnedCustomer, error: null };
}

export interface BulkResult {
  readonly inserted: readonly ChurnedCustomer[];
  readonly errors: ReadonlyArray<{ index: number; message: string }>;
}

export async function createChurnedCustomersBulk(
  rows: ReadonlyArray<{ name: string; endDate: string }>,
): Promise<BulkResult> {
  const { error: authError, user } = await verifyAdminOrTrainer();
  if (authError) return { inserted: [], errors: [{ index: -1, message: authError }] };

  const validRows: Array<{ name: string; endDate: string }> = [];
  const errors: Array<{ index: number; message: string }> = [];

  rows.forEach((row, index) => {
    const parsed = bulkRowSchema.safeParse(row);
    if (parsed.success) {
      validRows.push(parsed.data);
    } else {
      errors.push({
        index,
        message: parsed.error.issues[0]?.message ?? "קלט לא תקין",
      });
    }
  });

  if (validRows.length === 0) {
    return { inserted: [], errors };
  }

  const supabase = await createClient();
  const { data, error: dbError } = await typedFrom(supabase, "churned_customers")
    .insert(
      validRows.map((r) => ({
        name: r.name,
        end_date: r.endDate,
        note: "",
        note_color: "none",
        author_id: user!.id,
      })),
    )
    .select(CHURNED_COLUMNS);

  if (dbError) {
    console.error("[ChurnedCustomers] Bulk insert error:", dbError);
    return {
      inserted: [],
      errors: [...errors, { index: -1, message: "שגיאה בשמירה מרוכזת" }],
    };
  }

  revalidatePath(REVALIDATE_PATH);
  return {
    inserted: (data ?? []) as unknown as ChurnedCustomer[],
    errors,
  };
}

export async function updateChurnedCustomer(
  id: string,
  patch: UpdateChurnedCustomerInput,
): Promise<ActionResult<ChurnedCustomer>> {
  const { error: authError, user, profile } = await verifyAdminOrTrainer();
  if (authError) return { data: null, error: authError };

  const parsedId = churnedIdSchema.safeParse(id);
  if (!parsedId.success) return { data: null, error: "מזהה לא תקין" };

  const parsedPatch = updateChurnedCustomerSchema.safeParse(patch);
  if (!parsedPatch.success) return { data: null, error: "קלט לא תקין" };

  const supabase = await createClient();

  const { data: existing } = await typedFrom(supabase, "churned_customers")
    .select("author_id")
    .eq("id", parsedId.data)
    .maybeSingle();
  if (!existing) return { data: null, error: "רשומה לא נמצאה" };

  const isAdmin = profile!.role === "admin";
  const isAuthor = existing.author_id === user!.id;
  if (!isAdmin && !isAuthor) {
    return { data: null, error: "אין הרשאה לערוך רשומה זו" };
  }

  const updateRow: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (parsedPatch.data.name !== undefined) updateRow.name = parsedPatch.data.name;
  if (parsedPatch.data.endDate !== undefined) updateRow.end_date = parsedPatch.data.endDate;
  if (parsedPatch.data.note !== undefined) updateRow.note = parsedPatch.data.note;
  if (parsedPatch.data.noteColor !== undefined) updateRow.note_color = parsedPatch.data.noteColor;

  const { data, error: dbError } = await typedFrom(supabase, "churned_customers")
    .update(updateRow)
    .eq("id", parsedId.data)
    .select(CHURNED_COLUMNS)
    .single();

  if (dbError) {
    console.error("[ChurnedCustomers] Update error:", dbError);
    return { data: null, error: "שגיאה בעדכון" };
  }

  revalidatePath(REVALIDATE_PATH);
  return { data: data as unknown as ChurnedCustomer, error: null };
}

export async function deleteChurnedCustomer(
  id: string,
): Promise<{ success: true } | { error: string }> {
  const { error: authError, user, profile } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  const parsedId = churnedIdSchema.safeParse(id);
  if (!parsedId.success) return { error: "מזהה לא תקין" };

  const supabase = await createClient();
  const { data: existing } = await typedFrom(supabase, "churned_customers")
    .select("author_id")
    .eq("id", parsedId.data)
    .maybeSingle();
  if (!existing) return { error: "רשומה לא נמצאה" };

  const isAdmin = profile!.role === "admin";
  const isAuthor = existing.author_id === user!.id;
  if (!isAdmin && !isAuthor) {
    return { error: "אין הרשאה למחוק רשומה זו" };
  }

  const { error: dbError } = await typedFrom(supabase, "churned_customers")
    .delete()
    .eq("id", parsedId.data);

  if (dbError) {
    console.error("[ChurnedCustomers] Delete error:", dbError);
    return { error: "שגיאה במחיקה" };
  }

  revalidatePath(REVALIDATE_PATH);
  return { success: true };
}
