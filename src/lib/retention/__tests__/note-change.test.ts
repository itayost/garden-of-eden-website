import { describe, expect, it } from "vitest";
import type { RetentionNote } from "@/lib/actions/admin-retention";
import { replaceKeyedNote, withNote, withTrainer } from "../note-change";

const NOW = "2026-11-11T12:00:00.000Z";

const saved = (overrides: Partial<RetentionNote> = {}): RetentionNote => ({
  note: "התקשרנו",
  note_color: "green",
  author_id: "author-1",
  updated_at: "2026-11-01T08:00:00.000Z",
  assigned_trainer_id: null,
  ...overrides,
});

describe("withNote", () => {
  it("trims the note, keeps the assigned trainer and stamps the time", () => {
    expect(withNote(saved({ assigned_trainer_id: "trainer-1" }), "  לחזור מחר ", "yellow", NOW)).toEqual({
      note: "לחזור מחר",
      note_color: "yellow",
      author_id: "author-1",
      updated_at: NOW,
      assigned_trainer_id: "trainer-1",
    });
  });

  it("removes the row when note, color and trainer are all empty", () => {
    expect(withNote(saved(), "  ", "none", NOW)).toBeNull();
  });

  it("keeps the row for an assigned trainer when the note is cleared", () => {
    expect(withNote(saved({ assigned_trainer_id: "trainer-1" }), "", "none", NOW)?.assigned_trainer_id).toBe("trainer-1");
  });

  it("starts a row where there was none", () => {
    expect(withNote(undefined, "חדש", "none", NOW)).toMatchObject({ note: "חדש", author_id: "", assigned_trainer_id: null });
  });
});

describe("withTrainer", () => {
  it("keeps the note and color", () => {
    expect(withTrainer(saved(), "trainer-2", NOW)).toMatchObject({ note: "התקשרנו", note_color: "green", assigned_trainer_id: "trainer-2", updated_at: NOW });
  });

  it("removes the row when the trainer is cleared and nothing else is left", () => {
    expect(withTrainer(saved({ note: "", note_color: "none", assigned_trainer_id: "trainer-1" }), null, NOW)).toBeNull();
  });
});

describe("replaceKeyedNote", () => {
  const key = { reportMonth: "2026-12-01", phone: "0529999999" };
  const rows = [
    { id: "a", noteKey: key, note: null },
    { id: "b", noteKey: { ...key, reportMonth: "2026-11-01" }, note: null },
    { id: "c", noteKey: { ...key, phone: "0521234567" }, note: null },
  ];

  it("updates only the rows on the same month and phone", () => {
    const next = replaceKeyedNote(rows, key, () => saved());
    expect(next.map((r) => r.note !== null)).toEqual([true, false, false]);
    expect(next[1]).toBe(rows[1]);
  });

  it("clears the note when the update removes the row", () => {
    const withSaved = [{ ...rows[0], note: saved() }];
    expect(replaceKeyedNote(withSaved, key, () => null)[0].note).toBeNull();
  });
});
