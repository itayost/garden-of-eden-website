import { afterEach, describe, expect, test } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

import { build, questions } from "../../../lib/__tests__/fixtures";
import { PhoneSummaryList } from "../PhoneSummaryList";

// Nothing is mocked: the report comes from the real buildSurveyReport.
afterEach(cleanup);

describe("PhoneSummaryList", () => {
  const report = build();

  test("a line per Question with its number, text and what it got", () => {
    render(<PhoneSummaryList questions={questions} summaries={report.questions} />);
    const lines = screen.getAllByRole("button");
    expect(lines).toHaveLength(4);
    expect(lines[0]).toHaveTextContent("כמה נהנית?");
    expect(lines[0]).toHaveTextContent("3.7 מתוך 5");
    expect(lines[1]).toHaveTextContent("פעמיים · 67%");
    expect(lines[3]).toHaveTextContent("1 כתבו");
  });

  test("tapping a line opens that Question's full results", async () => {
    render(<PhoneSummaryList questions={questions} summaries={report.questions} />);
    screen.getAllByRole("button")[2].click();
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("מה עוזר?")).toBeTruthy();
    expect(within(dialog).getByText(/ולכן האחוזים מסתכמים ביותר מ-100%/)).toBeTruthy();
  });
});
