import { describe, expect, test } from "vitest";
import { audienceText, dayMonth, ratingTone } from "../format";

describe("audienceText", () => {
  test("branches, then a year range when the years run in a row", () => {
    expect(audienceText(["חיפה", "קריית אתא"], [2015, 2013, 2014])).toBe(
      "חיפה, קריית אתא · ילידי 2013 עד 2015",
    );
  });

  test("separate years are listed when they do not run in a row", () => {
    expect(audienceText(["קריית אתא"], [2013, 2015])).toBe("קריית אתא · ילידי 2013, 2015");
  });

  test("two consecutive years read as a range too", () => {
    expect(audienceText(["קריית אתא"], [2014, 2013])).toBe("קריית אתא · ילידי 2013 עד 2014");
  });

  test("one year, or none", () => {
    expect(audienceText(["חיפה"], [2014])).toBe("חיפה · ילידי 2014");
    expect(audienceText(["חיפה"], [])).toBe("חיפה");
  });

  test("a repeated year is listed once", () => {
    expect(audienceText(["חיפה"], [2014, 2014])).toBe("חיפה · ילידי 2014");
  });

  test("branch names keep the order given", () => {
    expect(audienceText(["קריית אתא", "חיפה"], [])).toBe("קריית אתא, חיפה");
  });

  test("no branch names leaves only the years", () => {
    expect(audienceText([], [2014])).toBe("ילידי 2014");
  });
});

describe("dayMonth", () => {
  test("day then month", () => {
    expect(dayMonth("2026-11-05")).toBe("5.11");
  });

  test("strips the leading zero from the day and the month", () => {
    expect(dayMonth("2026-01-05")).toBe("5.1");
  });

  test("keeps two-digit days and months as they are", () => {
    expect(dayMonth("2026-10-29")).toBe("29.10");
    expect(dayMonth("2026-12-31")).toBe("31.12");
  });
});

describe("ratingTone", () => {
  test("5 is high, 4 mid, 3 soft, 2 and 1 low", () => {
    expect([5, 4, 3, 2, 1].map(ratingTone)).toEqual(["high", "mid", "soft", "low", "low"]);
  });
});
