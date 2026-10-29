import { afterEach, describe, expect, test } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import type { SurveyListRow } from "../../../lib/queries";
import { SurveyListTable } from "../SurveyListTable";

const ROW: SurveyListRow = {
  id: "33333333-3333-4333-8333-333333333333",
  title: "איך היה לך באקדמיה?",
  state: "open",
  branchNames: ["קריית אתא"],
  birthYears: [],
  answered: 12,
  seen: 30,
  audience: 40,
  ratePct: 40,
  opensOn: "2026-10-22",
  closesOn: null,
  writerName: "עדן",
};

afterEach(cleanup);

describe("SurveyListTable: the answered column", () => {
  test("an open survey shows how many of those who saw it answered", () => {
    render(<SurveyListTable rows={[ROW]} />);
    expect(screen.getByText("12")).toBeTruthy();
    expect(screen.getByText("מתוך 30 שראו · 40%")).toBeTruthy();
  });

  test("an open survey nobody has seen says so instead of 0 out of 0", () => {
    render(<SurveyListTable rows={[{ ...ROW, answered: 0, seen: 0, ratePct: 0 }]} />);
    expect(screen.getByText("עוד אף אחד לא ראה")).toBeTruthy();
    expect(screen.queryByText(/מתוך 0 שראו/)).toBeNull();
  });

  test("a draft has not been sent and a scheduled survey has not opened", () => {
    render(
      <SurveyListTable
        rows={[
          { ...ROW, id: "a", state: "draft", seen: 0 },
          { ...ROW, id: "b", state: "scheduled", seen: 0, opensOn: "2026-11-02" },
        ]}
      />,
    );
    expect(screen.getByText("עוד לא נשלח")).toBeTruthy();
    expect(screen.getByText("ייפתח ב-2.11")).toBeTruthy();
    expect(screen.queryByText("עוד אף אחד לא ראה")).toBeNull();
  });
});

describe("SurveyListTable: where a row leads", () => {
  test("a draft opens in the builder and anything else in the results", () => {
    render(
      <SurveyListTable
        rows={[
          { ...ROW, id: "draft-1", title: "טיוטה", state: "draft" },
          { ...ROW, id: "open-1", title: "פתוח" },
        ]}
      />,
    );
    expect(screen.getByRole("link", { name: "טיוטה" }).getAttribute("href")).toBe("/admin/surveys/draft-1/edit");
    expect(screen.getByRole("link", { name: "פתוח" }).getAttribute("href")).toBe("/admin/surveys/open-1");
  });
});
