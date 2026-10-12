import { describe, expect, test } from "vitest";
import {
  endingCounts,
  endingSoonCount,
  filterEnding,
  parseEndingFilter,
  splitEnding,
  type EndingInput,
} from "../ending-soon";

const TODAY = "2026-10-12";

function queue(overrides: Partial<EndingInput> = {}): EndingInput {
  return {
    profileId: "p-1",
    status: "active",
    endsOn: "2026-12-31",
    sessionsLeft: null,
    cardsOnly: false,
    booked: 0,
    reminded: false,
    linkWaiting: false,
    frozen: null,
    paidInArbox: false,
    ...overrides,
  };
}

describe("ending by date", () => {
  test("7 days left is in; 8 is out", () => {
    expect(splitEnding([queue({ endsOn: "2026-10-19" })], TODAY).ending).toHaveLength(1);
    expect(splitEnding([queue({ endsOn: "2026-10-20" })], TODAY).ending).toHaveLength(0);
  });
  test("ending today is in, with 0 days left", () => {
    expect(splitEnding([queue({ endsOn: TODAY, status: "ending_soon" })], TODAY).ending[0]).toMatchObject({ by: "date", daysLeft: 0 });
  });
  test("a queue with a renewal behind it ends far out and is not listed", () => {
    expect(splitEnding([queue({ endsOn: "2026-12-20" })], TODAY).ending).toEqual([]);
  });
});

describe("ending by sessions", () => {
  test("a cards-only queue with 2 left is in; 3 is out", () => {
    expect(splitEnding([queue({ cardsOnly: true, sessionsLeft: 2 })], TODAY).ending[0]).toMatchObject({ by: "sessions" });
    expect(splitEnding([queue({ cardsOnly: true, sessionsLeft: 3 })], TODAY).ending).toEqual([]);
  });
  test("a mixed queue uses the date rule only", () => {
    expect(splitEnding([queue({ cardsOnly: false, sessionsLeft: 1 })], TODAY).ending).toEqual([]);
  });
});

describe("statuses", () => {
  test("cancelled queues are never listed", () => {
    const split = splitEnding([queue({ status: "cancelled", endsOn: "2026-10-13" })], TODAY);
    expect(split).toEqual({ ending: [], expired: [] });
  });
  test("expired 0 to 14 days ago is recently expired; 15 is not", () => {
    const split = splitEnding(
      [
        queue({ profileId: "t", status: "expired", endsOn: "2026-10-12" }),
        queue({ profileId: "a", status: "expired", endsOn: "2026-10-11" }),
        queue({ profileId: "b", status: "expired", endsOn: "2026-09-28" }),
        queue({ profileId: "c", status: "expired", endsOn: "2026-09-27" }),
      ],
      TODAY,
    );
    expect(split.expired.map((e) => [e.profileId, e.daysAgo])).toEqual([
      ["t", 0],
      ["a", 1],
      ["b", 14],
    ]);
  });
});

describe("order and count", () => {
  const inputs = [
    queue({ profileId: "far", endsOn: "2026-10-19" }),
    queue({ profileId: "near", endsOn: "2026-10-13" }),
    queue({ profileId: "card0", cardsOnly: true, sessionsLeft: 0, endsOn: "2026-10-16" }),
    queue({ profileId: "card2", cardsOnly: true, sessionsLeft: 2, endsOn: "2026-10-16" }),
    queue({ profileId: "gone", status: "expired", endsOn: "2026-10-10" }),
  ];
  test("most urgent first: days left, then sessions left", () => {
    expect(splitEnding(inputs, TODAY).ending.map((e) => e.profileId)).toEqual(["near", "card0", "card2", "far"]);
  });
  test("the badge counts only the ending group", () => {
    expect(endingSoonCount(inputs, TODAY)).toBe(4);
  });
});

describe("filters", () => {
  const split = splitEnding(
    [
      queue({ profileId: "link", endsOn: "2026-10-14", linkWaiting: true }),
      queue({ profileId: "rem", endsOn: "2026-10-14", reminded: true }),
      queue({ profileId: "arbox", cardsOnly: true, sessionsLeft: 1, paidInArbox: true }),
      queue({ profileId: "gone", status: "expired", endsOn: "2026-10-05" }),
    ],
    TODAY,
  );
  test("counts per filter", () => {
    expect(endingCounts(split)).toEqual({ all: 3, byDate: 2, bySessions: 1, link: 1, reminded: 1, arbox: 1, expired: 1 });
  });
  test("each filter narrows the list", () => {
    expect(filterEnding(split, "link").map((e) => e.profileId)).toEqual(["link"]);
    expect(filterEnding(split, "reminded").map((e) => e.profileId)).toEqual(["rem"]);
    expect(filterEnding(split, "arbox").map((e) => e.profileId)).toEqual(["arbox"]);
    expect(filterEnding(split, "expired").map((e) => e.profileId)).toEqual(["gone"]);
    expect(filterEnding(split, "all")).toHaveLength(3);
  });
  test("an unknown ?show= is all", () => {
    expect(parseEndingFilter("nope")).toBe("all");
    expect(parseEndingFilter(undefined)).toBe("all");
    expect(parseEndingFilter("expired")).toBe("expired");
  });
});

describe("extra fields ride through", () => {
  test("display fields on the input come back on the entry", () => {
    const withName = { ...queue({ endsOn: "2026-10-14" }), traineeName: "ליה כהן" };
    expect(splitEnding([withName], TODAY).ending[0].traineeName).toBe("ליה כהן");
  });
});
