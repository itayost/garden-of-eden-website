import { afterEach, describe, expect, test } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NuqsTestingAdapter, type UrlUpdateEvent } from "nuqs/adapters/testing";

import { build, questions } from "../../../lib/__tests__/fixtures";
import { AnswerGrid } from "../AnswerGrid";

// Nothing is mocked: the report is built by the real function from the shared fixture.
// jsdom applies no CSS, so the desktop table and the phone cards are both in the page;
// the table is picked out by its role.
const report = build();

afterEach(cleanup);

function renderGrid(over: { rowCount?: number; page?: number; rows?: typeof report.rows } = {}) {
  const updates: UrlUpdateEvent[] = [];
  render(
    <NuqsTestingAdapter onUrlUpdate={(event) => updates.push(event)}>
      <AnswerGrid
        questions={questions}
        summaries={report.questions}
        rows={over.rows ?? report.rows}
        answeredTotal={report.totals.answered}
        rowCount={over.rowCount ?? report.rowCount}
        page={over.page ?? 1}
      />
    </NuqsTestingAdapter>,
  );
  return updates;
}

const table = () => screen.getByRole("table");

describe("AnswerGrid: the table", () => {
  test("a column per Question, headed by its number, text and kind, and the sent column", () => {
    renderGrid();
    const headers = within(table()).getAllByRole("columnheader");
    expect(headers).toHaveLength(6);
    expect(headers[0]).toHaveTextContent("חניך");
    expect(headers[1]).toHaveTextContent("1כמה נהנית?דירוג 1 עד 5");
    expect(headers[2]).toHaveTextContent("2כמה פעמים?בחירה אחת");
    expect(headers[3]).toHaveTextContent("3מה עוזר?כמה תשובות");
    expect(headers[4]).toHaveTextContent("4מה לשנות?טקסט חופשי");
    expect(headers[5]).toHaveTextContent("נשלח");
  });

  test("a row per Response: the Trainee, the answers and when it was sent", () => {
    renderGrid();
    const rows = within(table()).getAllByRole("row");
    // The header, the summary row, then the three Responses newest first.
    expect(rows).toHaveLength(5);
    const first = within(rows[2]);
    expect(first.getByText("יונתן לוי")).toBeTruthy();
    expect(first.getByText("קריית אתא · 2014")).toBeTruthy();
    expect(first.getByText("פעמיים")).toBeTruthy();
    expect(first.getByText("תרגילי כדור")).toBeTruthy();
    expect(first.getByText("משחקונים")).toBeTruthy();
    expect(first.getByText("יותר משחקים")).toBeTruthy();
    expect(first.getByText("28.10 · 17:42")).toBeTruthy();
  });

  test("a Question left unanswered says so in its cell", () => {
    renderGrid();
    // אורי skipped the optional free-text Question.
    const row = within(within(table()).getAllByRole("row")[3]);
    expect(row.getByText("אורי בן דוד")).toBeTruthy();
    expect(row.getByText("לא ענה")).toBeTruthy();
  });

  test("the summary row sums up every Response, not only the page", () => {
    renderGrid();
    const summary = within(within(table()).getAllByRole("row")[1]);
    expect(summary.getByText("סיכום")).toBeTruthy();
    expect(summary.getByText("כל 3 העונים")).toBeTruthy();
    // Ratings 5, 4 and 2 average 3.67.
    expect(summary.getByText("3.7")).toBeTruthy();
    // Two of the three picked "פעמיים" for the single choice Question, one picked "פעם אחת".
    const choice = within(summary.getAllByRole("cell")[2]);
    expect(choice.getByText("67%")).toBeTruthy();
    expect(choice.getByText("33%")).toBeTruthy();
    expect(summary.getAllByRole("cell")[4]).toHaveTextContent("1 כתבו");
  });
});

describe("AnswerGrid: a Question's full results", () => {
  const openQuestion = (name: RegExp) =>
    fireEvent.click(within(table()).getByRole("button", { name }));

  test("a choice Question lists every option with its count and share", async () => {
    renderGrid();
    openQuestion(/כמה פעמים\?/);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("כמה פעמים?")).toBeTruthy();
    expect(within(dialog).getByText("פעם אחת")).toBeTruthy();
    expect(within(dialog).getByText("33%")).toBeTruthy();
    expect(within(dialog).getByText("פעמיים")).toBeTruthy();
    expect(within(dialog).getByText("67%")).toBeTruthy();
    expect(within(dialog).queryByText(/ולכן האחוזים מסתכמים ביותר מ-100%/)).toBeNull();
  });

  test("a multiple choice Question says its shares add up past 100%", async () => {
    renderGrid();
    openQuestion(/מה עוזר\?/);
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText("אפשר היה לבחור כמה תשובות, ולכן האחוזים מסתכמים ביותר מ-100%."),
    ).toBeTruthy();
  });

  test("a rating shows its average, the five counts and the end labels", async () => {
    renderGrid();
    openQuestion(/כמה נהנית\?/);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("3.7")).toBeTruthy();
    expect(within(dialog).getByText("ממוצע מתוך 5")).toBeTruthy();
    expect(within(dialog).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "01",
      "12",
      "03",
      "14",
      "15",
    ]);
    expect(within(dialog).getByText("בכלל לא")).toBeTruthy();
    expect(within(dialog).getByText("מאוד")).toBeTruthy();
  });

  test("a free text Question lists every answer with who wrote it", async () => {
    renderGrid();
    openQuestion(/מה לשנות\?/);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("יותר משחקים")).toBeTruthy();
    expect(within(dialog).getByText("יונתן לוי")).toBeTruthy();
    expect(within(dialog).getByText(/קריית אתא · 2014 · 28\.10/)).toBeTruthy();
  });
});

describe("AnswerGrid: one Response", () => {
  test("a row opens every answer of that Trainee and the way to their page", async () => {
    renderGrid();
    fireEvent.click(within(table()).getByRole("button", { name: /יונתן לוי/ }));
    const dialog = await screen.findByRole("dialog");

    expect(within(dialog).getByText("יונתן לוי")).toBeTruthy();
    expect(within(dialog).getByText(/נשלח 28\.10 · 17:42/)).toBeTruthy();
    for (const question of questions) {
      expect(within(dialog).getByText(question.text)).toBeTruthy();
    }
    expect(within(dialog).getByText("יותר משחקים")).toBeTruthy();
    expect(within(dialog).getByRole("link", { name: "לדף החניך" })).toHaveAttribute(
      "href",
      "/admin/users/p1",
    );
  });

  test("clicking anywhere on the row opens it, not only the name", async () => {
    renderGrid();
    fireEvent.click(within(table()).getByText("28.10 · 17:42"));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("יונתן לוי")).toBeTruthy();
  });
});

describe("AnswerGrid: the phone cards", () => {
  test("a card per Trainee lists the answers by Question number", () => {
    renderGrid();
    const articles = screen.getAllByRole("article");
    expect(articles).toHaveLength(3);
    const first = within(articles[0]);
    expect(first.getByText("יונתן לוי")).toBeTruthy();
    expect(first.getAllByText(/שאלה [1-4]/).map((label) => label.textContent)).toEqual([
      "שאלה 1",
      "שאלה 2",
      "שאלה 3",
      "שאלה 4",
    ]);
    expect(first.getByText("28.10 · 17:42")).toBeTruthy();
  });

  test("a card opens the Response", async () => {
    renderGrid();
    fireEvent.click(within(screen.getAllByRole("article")[1]).getByRole("button"));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("אורי בן דוד")).toBeTruthy();
  });
});

describe("AnswerGrid: paging", () => {
  test("no pager for a single page", () => {
    renderGrid();
    expect(screen.queryByRole("button", { name: "עמוד הבא" })).toBeNull();
  });

  test("says which rows are shown, and the next page goes into the address", async () => {
    const updates = renderGrid({ rowCount: 45, page: 2 });
    expect(screen.getByText("מציג 21 עד 40 מתוך 45")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "עמוד הבא" }));
    await waitFor(() => expect(updates.length).toBe(1));
    expect(updates[0].searchParams.get("page")).toBe("3");
    expect(updates[0].options.shallow).toBe(false);
  });

  test("back to the first page leaves the address bare", async () => {
    const updates = renderGrid({ rowCount: 45, page: 2 });
    fireEvent.click(screen.getByRole("button", { name: "עמוד קודם" }));
    await waitFor(() => expect(updates.length).toBe(1));
    expect(updates[0].searchParams.has("page")).toBe(false);
  });
});
