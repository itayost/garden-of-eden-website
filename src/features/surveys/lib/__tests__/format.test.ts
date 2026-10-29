import { describe, expect, test } from "vitest";
import {
  answeredText,
  audienceSummary,
  audienceText,
  datesSummary,
  fixCountText,
  joinDot,
  questionCountLabel,
  ratingTone,
  reachCount,
  reachText,
  yearChoices,
} from "../format";

describe("audienceText", () => {
  test("branches, then a year range when the years run in a row", () => {
    expect(audienceText(["חיפה", "קריית אתא"], [2015, 2013, 2014])).toBe(
      "חיפה, קריית אתא · ילידי 2013 עד 2015",
    );
  });

  test("separate years are listed when they do not run in a row", () => {
    expect(audienceText(["קריית אתא"], [2013, 2015])).toBe("קריית אתא · ילידי 2013, 2015");
  });

  test("two years are listed, even when they run in a row", () => {
    expect(audienceText(["קריית אתא"], [2014, 2013])).toBe("קריית אתא · ילידי 2013, 2014");
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

describe("joinDot", () => {
  test("joins the parts with a middle dot between spaces", () => {
    expect(joinDot(["נפתח 22.10", "נסגר 5.11"])).toBe("נפתח 22.10 · נסגר 5.11");
  });

  test("leaves empty parts out, wherever they are", () => {
    expect(joinDot(["", "קריית אתא", "", "ילידי 2014"])).toBe("קריית אתא · ילידי 2014");
  });

  test("one part is returned as it is, and no part gives an empty text", () => {
    expect(joinDot(["חיפה"])).toBe("חיפה");
    expect(joinDot([])).toBe("");
    expect(joinDot(["", ""])).toBe("");
  });
});

describe("ratingTone", () => {
  test("5 is high, 4 mid, 3 soft, 2 and 1 low", () => {
    expect([5, 4, 3, 2, 1].map(ratingTone)).toEqual(["high", "mid", "soft", "low", "low"]);
  });
});

describe("questionCountLabel", () => {
  test("a count of questions, and the singular for one", () => {
    expect(questionCountLabel(1)).toBe("שאלה אחת");
    expect(questionCountLabel(2)).toBe("2 שאלות");
    expect(questionCountLabel(5)).toBe("5 שאלות");
    expect(questionCountLabel(20)).toBe("20 שאלות");
  });
});

const YEARS = [
  { year: 2015, count: 105 },
  { year: 2014, count: 107 },
  { year: 2013, count: 98 },
];

describe("reachCount", () => {
  test("no year ticked reaches every eligible Trainee, those without a birthdate included", () => {
    expect(reachCount([], YEARS, 320)).toBe(320);
  });

  test("ticked years reach the Trainees born in them", () => {
    expect(reachCount([2014, 2015], YEARS, 320)).toBe(212);
  });

  test("a ticked year nobody was born in counts for nothing", () => {
    expect(reachCount([2010], YEARS, 320)).toBe(0);
    expect(reachCount([2010, 2013], YEARS, 320)).toBe(98);
  });
});

describe("yearChoices", () => {
  test("the eligible years as they came, newest first", () => {
    expect(yearChoices(YEARS, [])).toEqual(YEARS);
  });

  test("a ticked year that is not eligible any more stays, with no one in it, so it can be unticked", () => {
    expect(yearChoices(YEARS, [2012, 2014])).toEqual([...YEARS, { year: 2012, count: 0 }]);
  });

  test("an absent year is placed among the others by year, newest first", () => {
    const withGap = [
      { year: 2015, count: 5 },
      { year: 2013, count: 4 },
    ];
    expect(yearChoices(withGap, [2014])).toEqual([
      { year: 2015, count: 5 },
      { year: 2014, count: 0 },
      { year: 2013, count: 4 },
    ]);
  });
});

describe("reachText", () => {
  test("says how many active Trainees get the Survey", () => {
    expect(reachText(310)).toBe("יישלח ל-310 חניכים פעילים");
    expect(reachText(0)).toBe("יישלח ל-0 חניכים פעילים");
  });

  test("the singular for one", () => {
    expect(reachText(1)).toBe("יישלח לחניך פעיל אחד");
  });
});

describe("answeredText", () => {
  test("says how many Trainees already answered", () => {
    expect(answeredText(78)).toBe("78 חניכים כבר ענו");
  });

  test("the singular for one", () => {
    expect(answeredText(1)).toBe("חניך אחד כבר ענה");
  });
});

describe("fixCountText", () => {
  test("how many things are left to fix, and the singular for one", () => {
    expect(fixCountText(1)).toBe("דבר אחד לתקן");
    expect(fixCountText(3)).toBe("3 דברים לתקן");
  });
});

describe("datesSummary", () => {
  test("the open day, and the close day when there is one", () => {
    expect(datesSummary("2026-10-22", "2026-11-05")).toBe("נפתח 22.10 · נסגר 5.11");
    expect(datesSummary("2026-10-22", null)).toBe("נפתח 22.10");
  });
});

describe("audienceSummary", () => {
  test("branches, years and how many Trainees, on one line", () => {
    expect(audienceSummary(["חיפה", "קריית אתא"], [2013, 2014, 2015], 310)).toBe(
      "חיפה, קריית אתא · ילידי 2013 עד 2015 · 310 חניכים",
    );
  });

  test("leaves the count out until it is known", () => {
    expect(audienceSummary(["קריית אתא"], [], null)).toBe("קריית אתא");
  });

  test("says so when no branch is chosen", () => {
    expect(audienceSummary([], [], null)).toBe("לא נבחר סניף");
  });

  test("the singular for one Trainee", () => {
    expect(audienceSummary(["קריית אתא"], [], 1)).toBe("קריית אתא · חניך אחד");
  });
});
