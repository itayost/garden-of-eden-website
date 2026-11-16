import { describe, expect, it } from "vitest";
import type { SlotTrainee } from "@/types/schedule";
import { groupSlotTags, isCautionTag, tagTargetRefusal, tagWindowRefusal } from "../tags";

const SLOT = { schedule_date: "2026-11-15", start_time: "17:00:00", called_off_at: null };
const at = (date: string, hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return { date, minutes: h * 60 + m };
};

describe("tagWindowRefusal", () => {
  it("refuses before the Slot starts", () => {
    expect(tagWindowRefusal(SLOT, at("2026-11-15", "16:59"))).toBe("אפשר לסמן תגיות רק אחרי תחילת האימון");
  });

  it("opens at the start and stays open through the next day", () => {
    expect(tagWindowRefusal(SLOT, at("2026-11-15", "17:00"))).toBeNull();
    expect(tagWindowRefusal(SLOT, at("2026-11-16", "23:59"))).toBeNull();
  });

  it("closes two days later", () => {
    expect(tagWindowRefusal(SLOT, at("2026-11-17", "00:00"))).toBe("אפשר לסמן תגיות עד סוף היום שאחרי האימון");
  });

  it("refuses a Called off Slot at any time", () => {
    const calledOff = { ...SLOT, called_off_at: "2026-11-15T16:00:00Z" };
    expect(tagWindowRefusal(calledOff, at("2026-11-15", "18:00"))).toBe("האימון סומן כבוטל, אין מה לסמן");
  });
});

const row = (overrides: Partial<SlotTrainee>): SlotTrainee => ({
  id: "row-1",
  slot_id: "slot-1",
  trainee_id: "trainee-1",
  trainee_name: "יובל",
  order_index: 0,
  source: "staff",
  booked_at: null,
  cancelled_at: null,
  late_cancel: false,
  reminded_at: null,
  ...overrides,
});

describe("tagTargetRefusal", () => {
  const refusal = "המתאמן לא היה ברשימה של האימון הזה";

  it("accepts an active linked row", () => {
    expect(tagTargetRefusal([row({})], "trainee-1")).toBeNull();
  });

  it("refuses a late cancel and a recorded removal", () => {
    expect(tagTargetRefusal([row({ cancelled_at: "2026-11-15T10:00:00Z", late_cancel: true })], "trainee-1")).toBe(refusal);
    expect(
      tagTargetRefusal([row({ cancelled_at: "2026-11-15T18:00:00Z", removed_at: "2026-11-15T18:00:00Z" })], "trainee-1"),
    ).toBe(refusal);
  });

  it("refuses someone not on the Roster and never matches a free-text name", () => {
    expect(tagTargetRefusal([row({ trainee_id: null })], "trainee-1")).toBe(refusal);
    expect(tagTargetRefusal([row({})], "trainee-2")).toBe(refusal);
  });
});

describe("isCautionTag", () => {
  it("marks only the two staff tags", () => {
    expect(isCautionTag("pain")).toBe(true);
    expect(isCautionTag("behavior")).toBe(true);
    expect(isCautionTag("effort")).toBe(false);
  });
});

describe("groupSlotTags", () => {
  it("orders tags as the chips, drops unknown ones and keeps notes", () => {
    const grouped = groupSlotTags(
      [
        { trainee_id: "a", tag: "personal_best" },
        { trainee_id: "a", tag: "effort" },
        { trainee_id: "a", tag: "dancing" },
      ],
      [
        { trainee_id: "a", note: "בעיטה ברגל שמאל" },
        { trainee_id: "b", note: "ריכוז" },
      ],
    );
    expect(grouped).toEqual({
      a: { tags: ["effort", "personal_best"], note: "בעיטה ברגל שמאל" },
      b: { tags: [], note: "ריכוז" },
    });
  });
});
