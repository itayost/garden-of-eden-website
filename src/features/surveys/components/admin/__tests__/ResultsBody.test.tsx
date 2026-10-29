import { afterEach, describe, expect, test } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";

import { audience as fixtureAudience, build, filters, HA, person, questions } from "../../../lib/__tests__/fixtures";
import type { ReportFilters, ReportSegment } from "../../../lib/report";
import { ResultsBody } from "../ResultsBody";

// Nothing is mocked: every report here comes from the real buildSurveyReport.
afterEach(cleanup);

function renderBody(
  segment: ReportSegment,
  over: Partial<Parameters<typeof build>[0]> = {},
  page = 1,
  extra: Partial<ReportFilters> = {},
  narrowed = false,
) {
  const report = build({ ...over, filters: { ...filters, segment, page, ...extra } });
  render(
    <NuqsTestingAdapter>
      <ResultsBody report={report} questions={questions} segment={segment} page={page} narrowed={narrowed} />
    </NuqsTestingAdapter>,
  );
}

describe("ResultsBody: the answered segment", () => {
  test("shows the grid when there are Responses", () => {
    renderBody("answered");
    expect(screen.getByRole("table")).toBeTruthy();
  });

  test("nobody has answered yet", () => {
    renderBody("answered", { responses: [] });
    expect(screen.getByText("עוד אף אחד לא ענה")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  test("a search that matches no Response says nobody is here, not that nobody answered", () => {
    renderBody("answered", {}, 1, { search: "אין כזה" });
    expect(screen.getByText("אין כאן אף אחד")).toBeTruthy();
    expect(screen.queryByText("עוד אף אחד לא ענה")).toBeNull();
  });

  test("a birth year nobody answered in says nobody is here, not that nobody answered", () => {
    renderBody("answered", {}, 1, { birthYear: 2001 }, true);
    expect(screen.getByText("אין כאן אף אחד")).toBeTruthy();
    expect(screen.queryByText("עוד אף אחד לא ענה")).toBeNull();
  });

  test("with no filter and no Response it still says nobody has answered yet", () => {
    renderBody("answered", { responses: [] }, 1, {}, false);
    expect(screen.getByText("עוד אף אחד לא ענה")).toBeTruthy();
  });
});

describe("ResultsBody: the people lists", () => {
  test("saw but did not answer: name, branch, birth year, when they first saw it, and a link", () => {
    renderBody("seen");
    // p2 saw it at 09:00 UTC on 27.10 and p5 on 28.10; neither answered.
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("תמר חדד");
    expect(items[0]).toHaveTextContent("קריית אתא, חיפה · 2014");
    expect(items[0]).toHaveTextContent("ראה ב-28.10");
    expect(items[1]).toHaveTextContent("מאיה גבאי");
    expect(items[1]).toHaveTextContent("ראה ב-27.10");
    expect(within(items[1]).getByRole("link")).toHaveAttribute("href", "/admin/users/p2");
  });

  test("never saw it: the same list without a date", () => {
    renderBody("unseen");
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("נועם אזולאי");
    expect(items[1]).toHaveTextContent("רועי מלכה");
    expect(screen.queryByText(/ראה ב-/)).toBeNull();
    expect(within(items[0]).getByRole("link")).toHaveAttribute("href", "/admin/users/p4");
  });

  test("a Trainee with no birth year or no name is still listed", () => {
    renderBody("unseen", { audience: [person("x", "", [HA], null)] });
    expect(screen.getByText("חניך ללא שם")).toBeTruthy();
    expect(screen.getByText("חיפה")).toBeTruthy();
  });

  test("nobody in the list", () => {
    renderBody("seen", { seen: [] });
    expect(screen.getByText("אין כאן אף אחד")).toBeTruthy();
    expect(screen.queryByRole("list")).toBeNull();
  });

  test("a long list is paged by 20 and says which rows are shown", () => {
    const many = Array.from({ length: 45 }, (_, i) => person(`n${i}`, `חניך ${i}`, [HA], 2014));
    renderBody("unseen", { audience: [...fixtureAudience, ...many] }, 3);
    // 45 more than the two Trainees of the fixture who never saw it.
    expect(screen.getAllByRole("listitem")).toHaveLength(7);
    expect(screen.getByText("מציג 41 עד 47 מתוך 47")).toBeTruthy();
  });

  test("a page past the end shows the last one", () => {
    const many = Array.from({ length: 45 }, (_, i) => person(`n${i}`, `חניך ${i}`, [HA], 2014));
    renderBody("unseen", { audience: [...fixtureAudience, ...many] }, 99);
    expect(screen.getAllByRole("listitem")).toHaveLength(7);
    expect(screen.getByText("מציג 41 עד 47 מתוך 47")).toBeTruthy();
  });
});
