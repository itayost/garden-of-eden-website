import { afterEach, describe, expect, test } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { build } from "../../../lib/__tests__/fixtures";
import { SummaryStrip } from "../SummaryStrip";

// Nothing is mocked: the report comes from the real buildSurveyReport.
afterEach(cleanup);

describe("SummaryStrip", () => {
  const report = build();

  test("the answered number, the rate among those who saw it, and the three counts", () => {
    render(<SummaryStrip totals={report.totals} byBranch={report.byBranch} />);
    const strip = screen.getByRole("region", { name: "סיכום התשובות" });
    // The Audience is 6 Trainees plus p7, who answered and has since left it: 7. Five saw it (p7 answered).
    expect(report.totals).toEqual({ audience: 7, seen: 5, answered: 3, ratePct: 60 });
    expect(strip.querySelector("p b")).toHaveTextContent("3");
    expect(strip).toHaveTextContent("ענו · 60% מ-5 שראו");
    expect(strip).toHaveTextContent("ענו 3");
    expect(strip).toHaveTextContent("ראו ולא ענו 2");
    expect(strip).toHaveTextContent("לא ראו 2");
  });

  test("the bar is drawn out of the Audience and says its numbers to a screen reader", () => {
    render(<SummaryStrip totals={report.totals} byBranch={report.byBranch} />);
    const bar = screen.getByRole("img", { name: /מתוך 7 חניכים: ענו 3, ראו ולא ענו 2, לא ראו 2/ });
    const [answered, seenOnly] = Array.from(bar.children) as HTMLElement[];
    expect(parseFloat(answered.style.inlineSize)).toBeCloseTo((3 / 7) * 100, 1);
    expect(parseFloat(seenOnly.style.inlineSize)).toBeCloseTo((2 / 7) * 100, 1);
  });

  test("answered out of seen for each branch", () => {
    render(<SummaryStrip totals={report.totals} byBranch={report.byBranch} />);
    for (const branch of report.byBranch) {
      expect(screen.getByText(`${branch.answered}/${branch.seen}`)).toBeTruthy();
    }
  });

  test("an empty Survey draws no NaN", () => {
    const empty = build({ responses: [], seen: [], audience: [] });
    render(<SummaryStrip totals={empty.totals} byBranch={empty.byBranch} />);
    const bar = screen.getByRole("img");
    expect(Array.from(bar.children).map((child) => (child as HTMLElement).style.inlineSize)).toEqual(["0%", "0%"]);
  });
});
