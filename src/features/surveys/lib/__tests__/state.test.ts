import { describe, expect, test } from "vitest";
import { matchesListFilter, parseListFilter, publishedOpensOn, surveyState } from "../state";

const TODAY = "2026-10-29";
const base = {
  publishedAt: "2026-10-22T08:00:00Z",
  closedAt: null,
  opensOn: "2026-10-22",
  closesOn: "2026-11-05",
};

describe("surveyState", () => {
  test("never published is a draft", () => {
    expect(surveyState({ ...base, publishedAt: null }, TODAY)).toBe("draft");
  });

  test("published with a future open date is scheduled", () => {
    expect(surveyState({ ...base, opensOn: "2026-11-01" }, TODAY)).toBe("scheduled");
  });

  test("published and opened is open", () => {
    expect(surveyState(base, TODAY)).toBe("open");
  });

  test("still open on its close date", () => {
    expect(surveyState({ ...base, closesOn: TODAY }, TODAY)).toBe("open");
  });

  test("ended the day after its close date", () => {
    expect(surveyState({ ...base, closesOn: "2026-10-28" }, TODAY)).toBe("ended");
  });

  test("closing by hand ends it whatever the dates", () => {
    expect(surveyState({ ...base, closedAt: "2026-10-29T09:00:00Z" }, TODAY)).toBe("ended");
  });

  test("no close date stays open", () => {
    expect(surveyState({ ...base, closesOn: null }, TODAY)).toBe("open");
  });
});

describe("publishedOpensOn", () => {
  test("a past open date moves to today", () => {
    expect(publishedOpensOn("2026-10-20", TODAY)).toBe(TODAY);
  });

  test("a future open date is kept", () => {
    expect(publishedOpensOn("2026-11-01", TODAY)).toBe("2026-11-01");
  });
});

describe("matchesListFilter", () => {
  test("open shows open and scheduled", () => {
    expect(matchesListFilter("open", "open")).toBe(true);
    expect(matchesListFilter("scheduled", "open")).toBe(true);
    expect(matchesListFilter("draft", "open")).toBe(false);
  });

  test("all shows everything", () => {
    expect(matchesListFilter("ended", "all")).toBe(true);
  });

  test("draft and ended show only their own state", () => {
    expect(matchesListFilter("draft", "draft")).toBe(true);
    expect(matchesListFilter("open", "draft")).toBe(false);
    expect(matchesListFilter("ended", "ended")).toBe(true);
    expect(matchesListFilter("open", "ended")).toBe(false);
  });
});

describe("parseListFilter", () => {
  test("a known filter name is kept", () => {
    expect(parseListFilter("open")).toBe("open");
    expect(parseListFilter("draft")).toBe("draft");
    expect(parseListFilter("ended")).toBe("ended");
    expect(parseListFilter("all")).toBe("all");
  });

  test("a missing, unknown or odd value falls back to all", () => {
    expect(parseListFilter(undefined)).toBe("all");
    expect(parseListFilter("")).toBe("all");
    expect(parseListFilter("scheduled")).toBe("all");
    expect(parseListFilter("OPEN")).toBe("all");
  });
});
