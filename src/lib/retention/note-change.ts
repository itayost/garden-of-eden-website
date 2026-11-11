/**
 * The client's copy of a retention note after a save, matching what the
 * server stores (upsertRetentionNote, setRetentionTrainer): a row with no
 * note, no color and no trainer is deleted, so it becomes null here.
 */
import type { RetentionNote } from "@/lib/actions/admin-retention";
import type { NoteColor } from "@/lib/validations/churned-customers";
import type { RetentionNoteKey } from "./note-key";

const isEmpty = (note: string, color: NoteColor, trainerId: string | null) =>
  note.trim() === "" && color === "none" && trainerId === null;

export function withNote(
  existing: RetentionNote | undefined,
  note: string,
  noteColor: NoteColor,
  now: string,
): RetentionNote | null {
  const trainerId = existing?.assigned_trainer_id ?? null;
  if (isEmpty(note, noteColor, trainerId)) return null;
  return {
    note: note.trim(),
    note_color: noteColor,
    author_id: existing?.author_id ?? "",
    updated_at: now,
    assigned_trainer_id: trainerId,
  };
}

export function withTrainer(
  existing: RetentionNote | undefined,
  trainerId: string | null,
  now: string,
): RetentionNote | null {
  const note = existing?.note ?? "";
  const color: NoteColor = existing?.note_color ?? "none";
  if (isEmpty(note, color, trainerId)) return null;
  return {
    note,
    note_color: color,
    author_id: existing?.author_id ?? "",
    updated_at: now,
    assigned_trainer_id: trainerId,
  };
}

export type NoteUpdate = (existing: RetentionNote | undefined) => RetentionNote | null;

interface KeyedNoteRow {
  readonly noteKey: RetentionNoteKey;
  readonly note: RetentionNote | null;
}

/** Applies a note change to every row on the same month and phone; other rows stay the same objects. */
export function replaceKeyedNote<R extends KeyedNoteRow>(rows: readonly R[], key: RetentionNoteKey, update: NoteUpdate): R[] {
  return rows.map((row) =>
    row.noteKey.reportMonth === key.reportMonth && row.noteKey.phone === key.phone
      ? { ...row, note: update(row.note ?? undefined) }
      : row,
  );
}
