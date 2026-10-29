import { describe, expect, test } from "vitest";
import type { QuestionSummary } from "../report";
import {
  averageText,
  branchYearText,
  clampPage,
  daysLeft,
  daysLeftText,
  deleteDescription,
  displayName,
  initialsOf,
  israelClock,
  israelDayMonth,
  lastPage,
  pageSlice,
  percentOf,
  runDatesText,
  scaledHeights,
  segmentCounts,
  sentAtText,
  summaryValueText,
  topOptions,
  yearOptions,
} from "../results-view";

describe("initialsOf", () => {
  test("the first letters of the first two words", () => {
    expect(initialsOf("יונתן לוי")).toBe("יל");
    expect(initialsOf("אורי בן דוד")).toBe("אב");
  });

  test("one word gives one letter, extra spaces are ignored", () => {
    expect(initialsOf("מאיה")).toBe("מ");
    expect(initialsOf("  נועם   אזולאי ")).toBe("נא");
  });

  test("a blank name has no initials to show", () => {
    expect(initialsOf("")).toBe("?");
    expect(initialsOf("   ")).toBe("?");
  });
});

describe("displayName", () => {
  test("the name as it is, or a stand-in for a profile with no name", () => {
    expect(displayName("יונתן לוי")).toBe("יונתן לוי");
    expect(displayName("")).toBe("חניך ללא שם");
    expect(displayName("  ")).toBe("חניך ללא שם");
  });
});

describe("Israel time of a moment", () => {
  test("clock and day in Israel time, not UTC", () => {
    expect(israelClock("2026-10-28T15:42:00.000Z")).toBe("17:42");
    expect(israelDayMonth("2026-10-28T15:42:00.000Z")).toBe("28.10");
  });

  test("late evening UTC is already the next Israel day, midnight reads 00", () => {
    expect(israelClock("2026-10-28T22:30:00Z")).toBe("00:30");
    expect(israelDayMonth("2026-10-28T22:30:00Z")).toBe("29.10");
  });

  test("the sent column reads day, then time", () => {
    expect(sentAtText("2026-10-28T15:42:00Z")).toBe("28.10 · 17:42");
    expect(sentAtText("2026-11-05T06:11:00Z")).toBe("5.11 · 08:11");
  });
});

describe("segmentCounts", () => {
  test("answered, saw and did not answer, never saw", () => {
    expect(segmentCounts({ audience: 310, seen: 96, answered: 78, ratePct: 81 })).toEqual({
      answered: 78,
      seen: 18,
      unseen: 214,
    });
  });
});

describe("paging", () => {
  test("a page holds 20 and there is always at least one page", () => {
    expect(lastPage(0)).toBe(1);
    expect(lastPage(20)).toBe(1);
    expect(lastPage(21)).toBe(2);
    expect(lastPage(78)).toBe(4);
  });

  test("a page past the end falls back to the last one", () => {
    expect(clampPage(9, 78)).toBe(4);
    expect(clampPage(2, 78)).toBe(2);
    expect(clampPage(5, 0)).toBe(1);
  });

  test("pageSlice takes the rows of one page, clamped", () => {
    const items = Array.from({ length: 45 }, (_, i) => i);
    expect(pageSlice(items, 1)).toEqual(items.slice(0, 20));
    expect(pageSlice(items, 3)).toEqual(items.slice(40, 45));
    expect(pageSlice(items, 99)).toEqual(items.slice(40, 45));
    expect(pageSlice([], 1)).toEqual([]);
  });
});

describe("percentOf", () => {
  test("a share of the whole, unrounded, 0 for an empty whole", () => {
    expect(percentOf(1, 4)).toBe(25);
    expect(percentOf(1, 3)).toBeCloseTo(33.33, 1);
    expect(percentOf(0, 0)).toBe(0);
  });
});

describe("dates under the title", () => {
  test("days left count to the close day, which is still open", () => {
    expect(daysLeft("2026-11-05", "2026-10-29")).toBe(7);
    expect(daysLeft("2026-10-29", "2026-10-29")).toBe(0);
  });

  test("days left wording", () => {
    expect(daysLeftText(7)).toBe("נשארו 7 ימים");
    expect(daysLeftText(2)).toBe("נשארו 2 ימים");
    expect(daysLeftText(1)).toBe("נשאר יום אחד");
    expect(daysLeftText(0)).toBe("נסגר היום");
  });

  const dates = { opensOn: "2026-10-22", closesOn: "2026-11-05", closedAt: null };

  test("an open Survey with a close date shows both ends and the days left", () => {
    expect(runDatesText(dates, "open", "2026-10-29")).toBe("22.10 עד 5.11 · נשארו 7 ימים");
  });

  test("an ended Survey shows both ends and no days left", () => {
    expect(runDatesText(dates, "ended", "2026-11-09")).toBe("22.10 עד 5.11");
  });

  test("a Survey closed early ends on the day it was closed", () => {
    const closed = { ...dates, closedAt: "2026-10-30T09:00:00Z" };
    expect(runDatesText(closed, "ended", "2026-11-09")).toBe("22.10 עד 30.10");
  });

  test("without a close date it only says when it opened", () => {
    const open = { opensOn: "2026-10-22", closesOn: null, closedAt: null };
    expect(runDatesText(open, "open", "2026-10-29")).toBe("נפתח 22.10");
  });

  test("a scheduled Survey has not opened yet", () => {
    const later = { opensOn: "2026-11-02", closesOn: null, closedAt: null };
    expect(runDatesText(later, "scheduled", "2026-10-29")).toBe("ייפתח 2.11");
  });
});

describe("branchYearText", () => {
  test("branches then the year, joined with a dot", () => {
    expect(branchYearText(["חיפה"], 2014)).toBe("חיפה · 2014");
    expect(branchYearText(["חיפה", "קריית אתא"], 2014)).toBe("חיפה, קריית אתא · 2014");
  });

  test("a missing part is left out", () => {
    expect(branchYearText([], 2014)).toBe("2014");
    expect(branchYearText(["חיפה"], null)).toBe("חיפה");
    expect(branchYearText([], null)).toBe("");
  });
});

describe("yearOptions", () => {
  test("newest first", () => {
    expect(yearOptions([2013, 2015, 2014], null)).toEqual([2015, 2014, 2013]);
  });

  test("the chosen year stays offered even when nobody has it", () => {
    expect(yearOptions([2015, 2013], 2014)).toEqual([2015, 2014, 2013]);
    expect(yearOptions([2015, 2014], 2014)).toEqual([2015, 2014]);
  });
});

const choice = (counts: number[]): QuestionSummary => ({
  questionId: "q",
  answered: counts.reduce((a, b) => a + b, 0),
  kind: "single_choice",
  options: counts.map((count, i) => ({
    optionId: `o${i}`,
    label: `אפשרות ${i + 1}`,
    count,
    pct: 0,
  })),
});

describe("topOptions", () => {
  test("the options with the most answers first, ties in the authored order", () => {
    const summary = choice([3, 7, 7, 1]);
    if (summary.kind !== "single_choice") throw new Error("fixture");
    expect(topOptions(summary.options, 2).map((o) => o.label)).toEqual(["אפשרות 2", "אפשרות 3"]);
  });

  test("an option nobody picked is not a top answer", () => {
    const summary = choice([0, 4, 0]);
    if (summary.kind !== "single_choice") throw new Error("fixture");
    expect(topOptions(summary.options, 2).map((o) => o.label)).toEqual(["אפשרות 2"]);
  });
});

describe("scaledHeights", () => {
  test("the tallest count gets the full height and the rest scale to it", () => {
    expect(scaledHeights([2, 4, 1, 0, 4], 28, 3)).toEqual([14, 28, 7, 3, 28]);
  });

  test("a small count never drops below the minimum, and all zeros stay at the minimum", () => {
    expect(scaledHeights([1, 100], 28, 3)).toEqual([3, 28]);
    expect(scaledHeights([0, 0, 0, 0, 0], 28, 3)).toEqual([3, 3, 3, 3, 3]);
  });
});

describe("averageText", () => {
  test("one decimal, and a dash when nobody rated", () => {
    expect(averageText(4.2)).toBe("4.2");
    expect(averageText(4)).toBe("4.0");
    expect(averageText(null)).toBe("–");
  });
});

describe("summaryValueText", () => {
  test("a rating shows its average out of 5", () => {
    const rating: QuestionSummary = {
      questionId: "q",
      answered: 5,
      kind: "rating",
      average: 4.2,
      counts: [0, 0, 1, 2, 2],
    };
    expect(summaryValueText(rating)).toBe("4.2 מתוך 5");
    expect(summaryValueText({ ...rating, answered: 0, average: null })).toBe("אין דירוגים");
  });

  test("a choice shows its top answer and share", () => {
    const summary = choice([1, 3]);
    if (summary.kind !== "single_choice") throw new Error("fixture");
    const withPct: QuestionSummary = {
      ...summary,
      options: summary.options.map((o) => ({ ...o, pct: o.count * 25 })),
    };
    expect(summaryValueText(withPct)).toBe("אפשרות 2 · 75%");
    expect(summaryValueText(choice([0, 0]))).toBe("אין תשובות");
  });

  test("free text shows how many wrote something", () => {
    const text: QuestionSummary = { questionId: "q", answered: 29, kind: "text", texts: [] };
    expect(summaryValueText(text)).toBe("29 כתבו");
  });
});

describe("deleteDescription", () => {
  test("says how many Responses go with the Survey", () => {
    expect(deleteDescription(78)).toBe(
      "הסקר, השאלות שלו ו-78 התשובות שנשלחו אליו יימחקו, ואי אפשר לשחזר אותם.",
    );
    expect(deleteDescription(1)).toBe(
      "הסקר, השאלות שלו והתשובה היחידה שנשלחה אליו יימחקו, ואי אפשר לשחזר אותם.",
    );
    expect(deleteDescription(0)).toBe("הסקר והשאלות שלו יימחקו, ואי אפשר לשחזר אותם.");
  });
});
