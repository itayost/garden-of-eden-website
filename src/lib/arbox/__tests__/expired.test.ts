import { describe, it, expect } from "vitest";
import {
  isEndDateInMonth,
  buildBackfillFromExpired,
  windowRange,
  expiredRowKey,
} from "../expired";
import { buildBookingIndex, type ExpiringMembershipEntry } from "../retention";

function expired(
  over: Partial<ExpiringMembershipEntry>,
): ExpiringMembershipEntry {
  return {
    user_id: null,
    name: "טסט",
    phone: null,
    membership_type_name: "מנוי מתקדמים חודש",
    end_date: "2026-06-10",
    ...over,
  };
}

const EMPTY_INDEX = buildBookingIndex([]);
const JUNE_KEYS = ["2026-06", "2026-05", "2026-04", "2026-03"];

describe("isEndDateInMonth", () => {
  it("accepts an end_date inside the report month", () => {
    expect(isEndDateInMonth("2026-06-17", "2026-06-01")).toBe(true);
  });

  it("rejects an end_date in a later month", () => {
    expect(isEndDateInMonth("2026-08-03", "2026-06-01")).toBe(false);
  });

  it("rejects an end_date in an earlier month", () => {
    expect(isEndDateInMonth("2026-05-31", "2026-06-01")).toBe(false);
  });

  it("rejects a null end_date", () => {
    expect(isEndDateInMonth(null, "2026-06-01")).toBe(false);
  });
});

describe("buildBackfillFromExpired", () => {
  it("drops rows whose end_date falls outside the report month", () => {
    const result = buildBackfillFromExpired(
      "2026-06-01",
      [
        expired({ name: "בפנים", end_date: "2026-06-05" }),
        expired({ name: "בחוץ", end_date: "2026-08-03" }),
      ],
      EMPTY_INDEX,
      JUNE_KEYS,
    );

    expect(result.data.monthly).toHaveLength(1);
    expect(result.data.monthly[0].name).toBe("בפנים");
  });

  it("routes each membership type to its category", () => {
    const result = buildBackfillFromExpired(
      "2026-06-01",
      [
        expired({ name: "א", membership_type_name: "מנוי מתקדמים חודש" }),
        expired({ name: "ב", membership_type_name: "מנוי פרו" }),
        expired({ name: "ג", membership_type_name: "כרטיסייה" }),
      ],
      EMPTY_INDEX,
      JUNE_KEYS,
    );

    expect(result.data.monthly.map((e) => e.name)).toEqual(["א"]);
    expect(result.data.pro.map((e) => e.name)).toEqual(["ב"]);
    expect(result.data.training_card.map((e) => e.name)).toEqual(["ג"]);
    expect(result.dropped).toHaveLength(0);
  });

  it("records unmapped membership types instead of silently dropping them", () => {
    const result = buildBackfillFromExpired(
      "2026-06-01",
      [
        expired({
          name: "עממי",
          membership_type_name: "מנוי עממי 3 פעמים בשבוע",
        }),
        expired({
          name: "מחנה",
          membership_type_name: "מחנה קיץ - הכנה לעונה",
        }),
      ],
      EMPTY_INDEX,
      JUNE_KEYS,
    );

    expect(result.data.monthly).toHaveLength(0);
    expect(result.data.pro).toHaveLength(0);
    expect(result.data.training_card).toHaveLength(0);
    expect(result.dropped).toHaveLength(2);
    expect(result.dropped.map((d) => d.membership_type_name)).toEqual([
      "מנוי עממי 3 פעמים בשבוע",
      "מחנה קיץ - הכנה לעונה",
    ]);
  });

  it("keeps cancelled memberships, which arrive as ordinary rows", () => {
    const result = buildBackfillFromExpired(
      "2026-06-01",
      [expired({ name: "מבוטל", end_date: "2026-06-02" })],
      EMPTY_INDEX,
      JUNE_KEYS,
    );

    expect(result.data.monthly).toHaveLength(1);
  });

  it("attaches attendance from the booking index, newest month first", () => {
    const index = buildBookingIndex([
      { user_id: 1, name: "רץ", phone: null, date: "2026-06-04", check_in: "Yes" },
      { user_id: 1, name: "רץ", phone: null, date: "2026-06-06", check_in: "Yes" },
      { user_id: 1, name: "רץ", phone: null, date: "2026-05-02", check_in: "Yes" },
    ]);

    const result = buildBackfillFromExpired(
      "2026-06-01",
      [expired({ user_id: 1, name: "רץ", end_date: "2026-06-10" })],
      index,
      JUNE_KEYS,
    );

    expect(result.data.monthly[0].attendance).toEqual([2, 1, null, null]);
  });

  it("returns an empty report when nothing falls in the month", () => {
    const result = buildBackfillFromExpired(
      "2026-06-01",
      [expired({ end_date: "2026-09-01" })],
      EMPTY_INDEX,
      JUNE_KEYS,
    );

    expect(result.data).toEqual({ monthly: [], pro: [], training_card: [] });
    expect(result.dropped).toHaveLength(0);
  });
});

describe("windowRange", () => {
  it("returns the leap-year-safe last day of February for a non-leap year", () => {
    expect(windowRange("2026-02")).toEqual({
      from: "2026-02-01",
      to: "2026-02-28",
    });
  });

  it("returns the last day of a 30-day month", () => {
    expect(windowRange("2026-04")).toEqual({
      from: "2026-04-01",
      to: "2026-04-30",
    });
  });
});

describe("expiredRowKey", () => {
  it("distinguishes two different cards held by the same member", () => {
    const cardOne = expired({
      user_id: 42,
      end_date: "2026-04-25",
      membership_type_name: "כרטיסייה",
    });
    const cardTwo = expired({
      user_id: 42,
      end_date: "2026-06-15",
      membership_type_name: "כרטיסייה",
    });

    expect(expiredRowKey(cardOne)).not.toBe(expiredRowKey(cardTwo));
  });

  it("produces the same key for the identical row returned by two different windows", () => {
    const fromAprilWindow = expired({
      user_id: 7,
      end_date: "2026-04-25",
      membership_type_name: "כרטיסייה",
    });
    const fromMayWindow = expired({
      user_id: 7,
      end_date: "2026-04-25",
      membership_type_name: "כרטיסייה",
    });

    expect(expiredRowKey(fromAprilWindow)).toBe(expiredRowKey(fromMayWindow));
  });
});
