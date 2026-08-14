import { describe, expect, test } from "vitest";

import { buildScheduleWhatsAppText } from "@/lib/utils/schedule-text";
import type { ScheduleSlot, SlotTrainee } from "@/types/schedule";

let traineeCounter = 0;

function roster(names: string[]): SlotTrainee[] {
  return names.map((name, index) => ({
    id: `t-${++traineeCounter}`,
    slot_id: "s-1",
    trainee_id: null,
    trainee_name: name,
    order_index: index,
  }));
}

function slot(overrides: Partial<ScheduleSlot> = {}): ScheduleSlot {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    schedule_date: "2026-08-06",
    start_time: "15:00:00",
    trainer_id: "00000000-0000-0000-0000-000000000002",
    trainer_name: "דין",
    focus_he: "זריזות מהירות טכניקה עם כדור",
    location_he: null,
    trainees: roster(["נועם חלבי", "יהלי", "איתי"]),
    created_by: "00000000-0000-0000-0000-000000000003",
    created_at: "2026-08-06T05:00:00.000Z",
    updated_at: "2026-08-06T05:00:00.000Z",
    ...overrides,
  };
}

describe("buildScheduleWhatsAppText", () => {
  test("renders a single slot: time header, trainer line, focus line", () => {
    const result = buildScheduleWhatsAppText([slot()]);

    expect(result).toBe(
      "15:00\nדין: נועם חלבי, יהלי, איתי\nזריזות מהירות טכניקה עם כדור",
    );
  });

  test("includes the location in parentheses after the trainer name", () => {
    const result = buildScheduleWhatsAppText([slot({ location_he: "מגרש" })]);

    expect(result).toBe(
      "15:00\nדין (מגרש): נועם חלבי, יהלי, איתי\nזריזות מהירות טכניקה עם כדור",
    );
  });

  test("groups two slots under one time header, blank line between them", () => {
    const result = buildScheduleWhatsAppText([
      slot({ id: "a", trainer_name: "דין", focus_he: null, trainees: roster(["נדב", "רפאל"]) }),
      slot({
        id: "b",
        trainer_name: "לידור",
        focus_he: "כוח כללי אתלטיות",
        trainees: roster(["יאיר", "אלון"]),
      }),
    ]);

    expect(result).toBe(
      "15:00\nדין: נדב, רפאל\n\nלידור: יאיר, אלון\nכוח כללי אתלטיות",
    );
  });

  test("sorts times ascending and separates time groups with a blank line", () => {
    const result = buildScheduleWhatsAppText([
      slot({ id: "b", start_time: "16:00:00", trainer_name: "סלבה", focus_he: null, trainees: roster(["אייל"]) }),
      slot({ id: "a", start_time: "15:00:00", focus_he: null, trainees: roster(["נועם"]) }),
    ]);

    expect(result).toBe("15:00\nדין: נועם\n\n16:00\nסלבה: אייל");
  });

  test("renders a trainer-less slot as names only", () => {
    const result = buildScheduleWhatsAppText([
      slot({ trainer_id: null, trainer_name: null, focus_he: null, trainees: roster(["אדם", "מארק"]) }),
    ]);

    expect(result).toBe("15:00\nאדם, מארק");
  });

  test("keeps the location on a trainer-less slot", () => {
    const result = buildScheduleWhatsAppText([
      slot({
        trainer_id: null,
        trainer_name: null,
        location_he: "מגרש",
        focus_he: null,
        trainees: roster(["אדם", "מארק"]),
      }),
    ]);

    expect(result).toBe("15:00\n(מגרש): אדם, מארק");
  });

  test("omits the focus line when focus is missing", () => {
    const result = buildScheduleWhatsAppText([slot({ focus_he: null })]);

    expect(result).toBe("15:00\nדין: נועם חלבי, יהלי, איתי");
  });

  test("normalizes HH:MM:SS times to HH:MM", () => {
    const result = buildScheduleWhatsAppText([
      slot({ start_time: "09:30:00", focus_he: null, trainees: roster(["נועם"]) }),
    ]);

    expect(result).toBe("09:30\nדין: נועם");
  });

  test("orders roster names by order_index", () => {
    const trainees = roster(["ג", "א", "ב"]).map((t, i) => ({
      ...t,
      order_index: [2, 0, 1][i],
    }));

    const result = buildScheduleWhatsAppText([slot({ focus_he: null, trainees })]);

    expect(result).toBe("15:00\nדין: א, ב, ג");
  });

  test("returns an empty string for an empty day", () => {
    expect(buildScheduleWhatsAppText([])).toBe("");
  });

  // A day built from the weekly schedule seeds slots with a trainer and an hour
  // but no roster — the names are filled in afterwards. Until then the message
  // must not carry a dangling colon after the trainer.
  test("renders a rosterless slot as the header alone, no trailing colon", () => {
    const result = buildScheduleWhatsAppText([
      slot({ focus_he: null, trainees: [] }),
    ]);

    expect(result).toBe("15:00\nדין");
  });

  test("keeps the location and focus on a rosterless slot", () => {
    const result = buildScheduleWhatsAppText([
      slot({ location_he: "מגרש", trainees: [] }),
    ]);

    expect(result).toBe("15:00\nדין (מגרש)\nזריזות מהירות טכניקה עם כדור");
  });

  test("renders a rosterless, trainer-less slot as the focus alone", () => {
    const result = buildScheduleWhatsAppText([
      slot({ trainer_id: null, trainer_name: null, trainees: [] }),
    ]);

    expect(result).toBe("15:00\nזריזות מהירות טכניקה עם כדור");
  });

  test("renders a slot with nothing but an hour as just the hour", () => {
    const result = buildScheduleWhatsAppText([
      slot({
        trainer_id: null,
        trainer_name: null,
        focus_he: null,
        trainees: [],
      }),
    ]);

    expect(result).toBe("15:00");
  });
});
