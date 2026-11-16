"use server";

import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { israelNow, loadWritableSlot, mayCorrect } from "@/lib/actions/shared/roster-slot";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isValidUUID } from "@/lib/validations/common";
import {
  quickTagNoteSchema,
  quickTagToggleSchema,
  type QuickTagNoteInput,
  type QuickTagToggleInput,
} from "@/lib/validations/quick-tags";
import { groupSlotTags, tagTargetRefusal, tagWindowRefusal, type SlotTags } from "../tags";

type Result = { success: true } | { error: string };

/** One Slot's Quick tags and notes, for the roster sheet's tag mode. */
export async function getSlotTagsAction(slotId: string): Promise<{ success: true; data: SlotTags } | { error: string }> {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };
  if (!isValidUUID(slotId)) return { error: "מזהה אימון לא תקין" };

  const loaded = await loadWritableSlot(await createClient(), slotId);
  if ("error" in loaded) return { error: loaded.error };

  const db = createAdminClient();
  const [{ data: tags, error: tagsError }, { data: notes, error: notesError }] = await Promise.all([
    db.from("slot_trainee_tags").select("trainee_id, tag").eq("slot_id", slotId),
    db.from("slot_trainee_notes").select("trainee_id, note").eq("slot_id", slotId),
  ]);
  if (tagsError || notesError) {
    console.error("[quick-tags] read failed:", tagsError?.message ?? notesError?.message);
    return { error: "שגיאה בטעינת התגיות" };
  }
  return { success: true, data: groupSlotTags(tags ?? [], notes ?? []) };
}

/**
 * Every write passes the same checks as correcting a past Roster: the caller
 * may write the Slot's branch, the Slot is inside the tag window, the caller
 * ran it or manages it, and the Trainee was there.
 */
async function writableTarget(
  slotId: string,
  traineeId: string,
): Promise<{ userId: string } | { error: string }> {
  const { error: authError, user, profile } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  const loaded = await loadWritableSlot(await createClient(), slotId);
  if ("error" in loaded) return { error: loaded.error };

  const windowRefusal = tagWindowRefusal(loaded.slot, israelNow());
  if (windowRefusal) return { error: windowRefusal };

  if (!(await mayCorrect(loaded, { userId: user!.id, role: profile!.role }))) {
    return { error: "רק המאמנים של האימון, מנהלי הסניף ומנהלים יכולים לסמן תגיות" };
  }

  const targetRefusal = tagTargetRefusal(loaded.slot.trainees, traineeId);
  if (targetRefusal) return { error: targetRefusal };

  return { userId: user!.id };
}

export async function toggleQuickTagAction(input: QuickTagToggleInput): Promise<Result> {
  const parsed = quickTagToggleSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "קלט לא תקין" };
  const { slotId, traineeId, tag, on } = parsed.data;

  const target = await writableTarget(slotId, traineeId);
  if ("error" in target) return target;

  const db = createAdminClient();
  const { error } = on
    ? await db
        .from("slot_trainee_tags")
        .upsert(
          { slot_id: slotId, trainee_id: traineeId, tag, created_by: target.userId },
          { onConflict: "slot_id,trainee_id,tag", ignoreDuplicates: true },
        )
    : await db.from("slot_trainee_tags").delete().eq("slot_id", slotId).eq("trainee_id", traineeId).eq("tag", tag);
  if (error) {
    console.error("[quick-tags] toggle failed:", error.message);
    return { error: "שגיאה בשמירת התגית" };
  }
  return { success: true };
}

export async function saveQuickTagNoteAction(input: QuickTagNoteInput): Promise<Result> {
  const parsed = quickTagNoteSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "קלט לא תקין" };
  const { slotId, traineeId, note } = parsed.data;

  const target = await writableTarget(slotId, traineeId);
  if ("error" in target) return target;

  const db = createAdminClient();
  const { error } =
    note === ""
      ? await db.from("slot_trainee_notes").delete().eq("slot_id", slotId).eq("trainee_id", traineeId)
      : await db.from("slot_trainee_notes").upsert(
          {
            slot_id: slotId,
            trainee_id: traineeId,
            note,
            updated_by: target.userId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "slot_id,trainee_id" },
        );
  if (error) {
    console.error("[quick-tags] note failed:", error.message);
    return { error: "שגיאה בשמירת ההערה" };
  }
  return { success: true };
}
