import { describe, expect, test } from "vitest";
import { buildFactSheet } from "../fact-sheet/build";
import { emptyWeek, ME, OTHER, shiftReport } from "../fact-sheet/__tests__/fixtures";
import { newSensitiveHolds, sensitiveHoldsNow } from "../sensitive-recheck";
import type { WeekTag } from "../fact-sheet/types";

const injury = shiftReport({ report_date: "2026-11-19", injuries_trainee_ids: [ME], injuries_details: "PLANTED-INJURY" });
const pain: WeekTag = { slotId: "slot-9", date: "2026-11-19", tag: "pain" };
const effort: WeekTag = { slotId: "slot-9", date: "2026-11-19", tag: "effort" };

describe("sensitiveHoldsNow", () => {
  test("an injury entry naming the Trainee and a caution tag both hold", () => {
    const holds = sensitiveHoldsNow([injury], [pain], ME);
    expect(holds).toHaveLength(2);
    expect(holds.every((hold) => hold.code === "sensitive")).toBe(true);
    expect(JSON.stringify(holds)).not.toContain("PLANTED-INJURY");
  });

  test("a positive tag and an entry about another child do not", () => {
    expect(sensitiveHoldsNow([injury], [effort], OTHER)).toEqual([]);
  });

  test("it gives the same texts the Fact sheet build gave", () => {
    const built = buildFactSheet(emptyWeek({ shiftReports: [injury], tags: [pain] })).holds.filter(
      (hold) => hold.code === "sensitive",
    );
    expect(sensitiveHoldsNow([injury], [pain], ME)).toEqual(built);
  });
});

describe("newSensitiveHolds", () => {
  test("nothing new when the report already holds them", () => {
    const now = sensitiveHoldsNow([injury], [pain], ME);
    expect(newSensitiveHolds(now, now)).toEqual([]);
  });

  test("an entry filed after the report was written is new", () => {
    const atWriting = sensitiveHoldsNow([], [], ME);
    const now = sensitiveHoldsNow([injury], [pain], ME);
    expect(newSensitiveHolds(atWriting, now)).toEqual(now);
  });

  test("text problems and manual holds never count as the sensitive ones a person saw", () => {
    const now = sensitiveHoldsNow([], [pain], ME);
    const stored = [{ code: "manual" as const, text: now[0].text }];
    expect(newSensitiveHolds(stored, now)).toEqual(now);
  });

  test("a hold found twice is returned once", () => {
    const now = sensitiveHoldsNow([], [pain], ME);
    expect(newSensitiveHolds([], [...now, ...now])).toEqual(now);
  });
});
