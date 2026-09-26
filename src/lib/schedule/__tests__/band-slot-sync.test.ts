import { describe, expect, test } from "vitest";

import { bandSlotSyncs, type BandCopy } from "../band-slot-sync";

function band(overrides: Partial<BandCopy> = {}): BandCopy {
  return {
    start_time: "18:45:00",
    label_he: "אימון התקפה גילאי 12 עד 14",
    location_he: "קריית אתא - דרך חיפה 18",
    ...overrides,
  };
}

describe("bandSlotSyncs", () => {
  test("returns nothing when the band's copied fields did not change", () => {
    expect(bandSlotSyncs(band(), band({ start_time: "18:45" }))).toEqual([]);
  });

  test("a new label moves the slot title from the old label to the new one", () => {
    const before = band();
    const after = band({ start_time: "18:45", label_he: "אימון התקפה גילאי 2017-2016" });

    expect(bandSlotSyncs(before, after)).toEqual([
      {
        column: "focus_he",
        from: "אימון התקפה גילאי 12 עד 14",
        to: "אימון התקפה גילאי 2017-2016",
      },
    ]);
  });

  test("a new start time is written in the slot column's HH:MM:SS form", () => {
    const after = band({ start_time: "19:00" });

    expect(bandSlotSyncs(band(), after)).toEqual([
      { column: "start_time", from: "18:45:00", to: "19:00:00" },
    ]);
  });

  test("a label added to an unlabelled band syncs from null", () => {
    const after = band({ start_time: "18:45", label_he: "טכניקה" });

    expect(bandSlotSyncs(band({ label_he: null }), after)).toEqual([
      { column: "focus_he", from: null, to: "טכניקה" },
    ]);
  });

  test("a cleared location syncs to null", () => {
    const after = band({ start_time: "18:45", location_he: null });

    expect(bandSlotSyncs(band(), after)).toEqual([
      { column: "location_he", from: "קריית אתא - דרך חיפה 18", to: null },
    ]);
  });

  test("every changed field is listed, in a stable order", () => {
    const after = { start_time: "17:30", label_he: "חדש", location_he: "מגרש ב" };

    expect(bandSlotSyncs(band(), after).map((s) => s.column)).toEqual([
      "start_time",
      "focus_he",
      "location_he",
    ]);
  });
});
