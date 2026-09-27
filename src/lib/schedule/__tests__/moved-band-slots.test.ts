import { describe, expect, test } from "vitest";

import { partitionMovedBandSlots } from "../moved-band-slots";

describe("partitionMovedBandSlots", () => {
  test("deletes empty days and detaches days someone is on", () => {
    const result = partitionMovedBandSlots([
      { id: "a", activeTrainees: 0 },
      { id: "b", activeTrainees: 2 },
      { id: "c", activeTrainees: 0 },
    ]);

    expect(result).toEqual({ deleteIds: ["a", "c"], detachIds: ["b"] });
  });

  test("returns nothing for no days", () => {
    expect(partitionMovedBandSlots([])).toEqual({ deleteIds: [], detachIds: [] });
  });
});
