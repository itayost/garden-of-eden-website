"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { isValidUUID } from "@/lib/validations/common";
import { addCommunicationNoteSchema } from "@/lib/validations/communication-log";

type ActionResult =
  | { error: string; success?: never }
  | { success: true; error?: never };

export interface CommunicationNote {
  readonly id: string;
  readonly author_id: string;
  readonly author_name: string;
  readonly content: string;
  readonly created_at: string;
}

/**
 * Fetch all non-deleted communication notes for a trainee, newest first.
 * Staff-only (admin/trainer); RLS also enforces this.
 */
export async function getCommunicationNotes(
  traineeId: string,
): Promise<{ error: string | null; data: readonly CommunicationNote[] }> {
  if (!isValidUUID(traineeId)) {
    return { error: "מזהה משתמש לא תקין", data: [] };
  }

  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) {
    return { error: authError, data: [] };
  }

  const supabase = await createClient();

  const { data, error: dbError } = await supabase
    .from("trainee_communication_log")
    .select("id, author_id, author_name, content, created_at")
    .eq("trainee_id", traineeId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (dbError) {
    console.error("Error fetching communication notes:", dbError);
    return { error: "שגיאה בטעינת היסטוריית התקשורת", data: [] };
  }

  return { error: null, data: (data ?? []) as CommunicationNote[] };
}

/**
 * Add a free-text communication note for a trainee.
 * The note is stamped with the current staff member's id and name snapshot.
 */
export async function addCommunicationNote(
  traineeId: string,
  content: string,
): Promise<{ error: string | null; data: CommunicationNote | null }> {
  if (!isValidUUID(traineeId)) {
    return { error: "מזהה משתמש לא תקין", data: null };
  }

  const parsed = addCommunicationNoteSchema.safeParse({ content });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "קלט לא תקין",
      data: null,
    };
  }

  const { error: authError, user, profile } = await verifyAdminOrTrainer();
  if (authError) return { error: authError, data: null };

  const supabase = await createClient();

  const { data: inserted, error: insertError } = await supabase
    .from("trainee_communication_log")
    .insert({
      trainee_id: traineeId,
      author_id: user!.id,
      author_name: profile!.full_name?.trim() || "צוות",
      content: parsed.data.content,
    })
    .select("id, author_id, author_name, content, created_at")
    .single();

  if (insertError || !inserted) {
    console.error("Error adding communication note:", insertError);
    return { error: "שגיאה בשמירת ההערה", data: null };
  }

  revalidatePath(`/admin/users/${traineeId}`);
  return { error: null, data: inserted as CommunicationNote };
}

/**
 * Soft-delete a communication note.
 * Allowed for the note's author or any admin.
 */
export async function deleteCommunicationNote(
  noteId: string,
  traineeId: string,
): Promise<ActionResult> {
  if (!isValidUUID(noteId) || !isValidUUID(traineeId)) {
    return { error: "מזהה לא תקין" };
  }

  const { error: authError, user, profile } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  const supabase = await createClient();

  const { data: note, error: fetchError } = await supabase
    .from("trainee_communication_log")
    .select("author_id")
    .eq("id", noteId)
    .is("deleted_at", null)
    .maybeSingle();

  if (fetchError || !note) {
    return { error: "הערה לא נמצאה" };
  }

  // Permission: admins can delete any note; trainers only their own.
  if (profile!.role !== "admin" && note.author_id !== user!.id) {
    return { error: "אין הרשאה למחוק הערה זו" };
  }

  const { error: updateError } = await supabase
    .from("trainee_communication_log")
    .update({ deleted_at: new Date().toISOString(), deleted_by: user!.id })
    .eq("id", noteId)
    .is("deleted_at", null);

  if (updateError) {
    console.error("Error deleting communication note:", updateError);
    return { error: "שגיאה במחיקת ההערה" };
  }

  revalidatePath(`/admin/users/${traineeId}`);
  return { success: true };
}
