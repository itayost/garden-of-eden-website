import { describe, expect, test } from "vitest";

import { arboxSyncSummary, type ArboxSyncCounts } from "../sync-summary";

function counts(overrides: Partial<ArboxSyncCounts> = {}): ArboxSyncCounts {
  return { usersCreated: 0, plansCreated: 0, plansPastTheirEnd: 0, purchasesFailed: 0, ...overrides };
}

describe("arboxSyncSummary", () => {
  test("says nothing changed when nothing did", () => {
    expect(arboxSyncSummary(counts())).toBe("Arbox סונכרן: אין שינויים");
  });

  test("counts new trainees and new plans in plural", () => {
    expect(arboxSyncSummary(counts({ usersCreated: 2, plansCreated: 3 }))).toBe(
      "Arbox סונכרן: 2 מתאמנים חדשים, 3 מסלולים נוספו",
    );
  });

  test("uses the singular for one", () => {
    expect(arboxSyncSummary(counts({ usersCreated: 1, plansCreated: 1 }))).toBe(
      "Arbox סונכרן: מתאמן חדש אחד, מסלול אחד נוסף",
    );
  });

  test("warns about a plan queued past its own Arbox end, which will never run", () => {
    expect(arboxSyncSummary(counts({ plansCreated: 2, plansPastTheirEnd: 1 }))).toBe(
      "Arbox סונכרן: 2 מסלולים נוספו, מסלול אחד ממתין בתור מעבר לתאריך הסיום שלו ב-Arbox",
    );
  });

  test("reports purchases that did not go through", () => {
    expect(arboxSyncSummary(counts({ plansCreated: 1, purchasesFailed: 2 }))).toBe(
      "Arbox סונכרן: מסלול אחד נוסף, 2 רכישות לא נקלטו",
    );
  });
});
