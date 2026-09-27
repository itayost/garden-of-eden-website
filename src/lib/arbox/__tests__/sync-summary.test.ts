import { describe, expect, test } from "vitest";

import { arboxSyncSummary, type ArboxSyncCounts } from "../sync-summary";

function counts(overrides: Partial<ArboxSyncCounts> = {}): ArboxSyncCounts {
  return { usersCreated: 0, plansCreated: 0, plansMerged: 0, purchasesFailed: 0, ...overrides };
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
    expect(arboxSyncSummary(counts({ usersCreated: 1, plansCreated: 1, plansMerged: 1 }))).toBe(
      "Arbox סונכרן: מתאמן חדש אחד, מסלול אחד נוסף, מסלול אחד עודכן",
    );
  });

  test("reports updated plans in plural", () => {
    expect(arboxSyncSummary(counts({ plansMerged: 4 }))).toBe("Arbox סונכרן: 4 מסלולים עודכנו");
  });

  test("reports purchases that did not go through", () => {
    expect(arboxSyncSummary(counts({ plansCreated: 1, purchasesFailed: 2 }))).toBe(
      "Arbox סונכרן: מסלול אחד נוסף, 2 רכישות לא נקלטו",
    );
  });
});
