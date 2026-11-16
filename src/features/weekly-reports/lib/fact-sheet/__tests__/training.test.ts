import { describe, expect, test } from "vitest";
import { attendanceFacts, sessionFacts, tagFacts } from "../training";
import type { WeekRosterRow } from "../types";

function row(overrides: Partial<WeekRosterRow> = {}): WeekRosterRow {
  return {
    date: "2026-11-17",
    startTime: "17:00",
    focus: "מהירות",
    slotId: "slot-1",
    counts: true,
    lateCancel: false,
    trainerFirstNames: ["יוסי"],
    ...overrides,
  };
}

describe("attendanceFacts", () => {
  test("a Roster day and an Arbox entrance on one date are one day, the Roster's", () => {
    const facts = attendanceFacts([row()], [{ date: "2026-11-17", className: "קבוצתי" }]);
    expect(facts.total).toBe(1);
    expect(facts.days).toEqual([
      { date: "2026-11-17", weekday: "יום שלישי", focus: "מהירות", trainers: ["יוסי"], source: "יומן" },
    ]);
  });

  test("an Arbox entrance on another date is its own day", () => {
    const facts = attendanceFacts([row()], [{ date: "2026-11-15", className: "קבוצתי" }]);
    expect(facts.days.map((d) => [d.date, d.source])).toEqual([
      ["2026-11-15", "ארבוקס"],
      ["2026-11-17", "יומן"],
    ]);
    expect(facts.total).toBe(2);
  });

  test("a late cancel is counted and is not a day trained", () => {
    const facts = attendanceFacts([row(), row({ date: "2026-11-18", slotId: "slot-2", lateCancel: true })], []);
    expect(facts.lateCancels).toBe(1);
    expect(facts.total).toBe(1);
  });

  test("a row that does not count is not a day", () => {
    const facts = attendanceFacts([row({ counts: false })], []);
    expect(facts).toEqual({ total: 0, lateCancels: 0, days: [] });
  });

  test("two Slots on one date are one day with both Focuses and Trainers", () => {
    const facts = attendanceFacts(
      [
        row({ startTime: "18:00", slotId: "slot-2", focus: "כדרור", trainerFirstNames: ["דנה"] }),
        row(),
      ],
      [],
    );
    expect(facts.days).toEqual([
      { date: "2026-11-17", weekday: "יום שלישי", focus: "מהירות, כדרור", trainers: ["יוסי", "דנה"], source: "יומן" },
    ]);
  });

  test("a Trainer's surname never reaches the sheet", () => {
    const facts = attendanceFacts([row({ trainerFirstNames: ["יוסי כהן"] })], []);
    expect(facts.days[0].trainers).toEqual(["יוסי"]);
  });
});

describe("sessionFacts", () => {
  test("one entry per session, one line per exercise", () => {
    const facts = sessionFacts([
      {
        date: "2026-11-16",
        exercises: [
          { name: "סקוואט", category: "כוח", target: "3 סטים × 8" },
          { name: "קפיצות", category: null, target: "" },
        ],
      },
      { date: "2026-11-15", exercises: [] },
    ]);
    expect(facts).toEqual([
      {
        date: "2026-11-16",
        source: "אימון אישי",
        items: ["תרגיל: סקוואט (כוח), 3 סטים × 8", "תרגיל: קפיצות"],
      },
    ]);
  });
});

describe("tagFacts", () => {
  test("positive tags of one Slot with its note become one item", () => {
    const facts = tagFacts(
      [
        { slotId: "slot-1", date: "2026-11-17", tag: "technique" },
        { slotId: "slot-1", date: "2026-11-17", tag: "effort" },
      ],
      [{ slotId: "slot-1", date: "2026-11-17", note: "בעיטה ברגל שמאל" }],
    );
    expect(facts.holds).toEqual([]);
    expect(facts.progress).toEqual([
      {
        date: "2026-11-17",
        source: "תגיות מהאימון",
        label: "תגיות המאמן",
        details: "בעיטה ברגל שמאל",
        categories: ["השקיע", "טכניקה טובה"],
      },
    ]);
  });

  test("a caution tag holds and drops that Slot's note, while another Slot's note stays", () => {
    const facts = tagFacts(
      [
        { slotId: "slot-1", date: "2026-11-17", tag: "pain" },
        { slotId: "slot-1", date: "2026-11-17", tag: "effort" },
        { slotId: "slot-2", date: "2026-11-18", tag: "focus" },
      ],
      [
        { slotId: "slot-1", date: "2026-11-17", note: "PLANTED-PAIN-NOTE" },
        { slotId: "slot-2", date: "2026-11-18", note: "ריכוז מלא" },
      ],
    );
    expect(facts.holds).toEqual([{ code: "sensitive", text: "תגית כאב או פציעה מ-17/11" }]);
    expect(JSON.stringify(facts)).not.toContain("PLANTED-PAIN-NOTE");
    expect(JSON.stringify(facts.progress)).not.toContain("כאב");
    expect(facts.progress).toEqual([
      { date: "2026-11-17", source: "תגיות מהאימון", label: "תגיות המאמן", details: null, categories: ["השקיע"] },
      { date: "2026-11-18", source: "תגיות מהאימון", label: "תגיות המאמן", details: "ריכוז מלא", categories: ["ריכוז טוב"] },
    ]);
  });

  test("a Slot with only a caution tag gives a hold and no item", () => {
    const facts = tagFacts(
      [{ slotId: "slot-1", date: "2026-11-17", tag: "behavior" }],
      [{ slotId: "slot-1", date: "2026-11-17", note: "PLANTED-PAIN-NOTE" }],
    );
    expect(facts.progress).toEqual([]);
    expect(facts.holds).toEqual([{ code: "sensitive", text: "תגית התנהגות מ-17/11" }]);
    expect(JSON.stringify(facts.progress)).not.toContain("PLANTED");
  });

  test("a note on a Slot with no tag is not used", () => {
    const facts = tagFacts([], [{ slotId: "slot-1", date: "2026-11-17", note: "PLANTED-NOTE" }]);
    expect(facts).toEqual({ progress: [], holds: [] });
  });
});
