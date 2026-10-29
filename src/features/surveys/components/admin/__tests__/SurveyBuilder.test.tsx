import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { emptyQuestion, newDraft } from "../../../lib/draft";
import type { SurveyDraft, SurveyState } from "../../../lib/types";
import { SurveyBuilder } from "../SurveyBuilder";

// Only the router and the server actions are stubbed: the builder's own state,
// its rules and the dialogs are real.
const push = vi.fn();
const replace = vi.fn();
const refresh = vi.fn();
const save = vi.fn();
const publish = vi.fn();
const unpublish = vi.fn();
const audienceYears = vi.fn();
const deleteSurvey = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace, refresh }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/features/surveys/lib/actions/save-survey", () => ({
  saveSurveyDraftAction: (id: string | null, draft: SurveyDraft) => save(id, draft),
}));
vi.mock("@/features/surveys/lib/actions/publish-survey", () => ({
  publishSurveyAction: (id: string) => publish(id),
  unpublishSurveyAction: (id: string) => unpublish(id),
}));
vi.mock("@/features/surveys/lib/actions/audience-years", () => ({
  audienceYearsAction: (ids: string[]) => audienceYears(ids),
}));
vi.mock("@/features/surveys/lib/actions/delete-survey", () => ({
  deleteSurveyAction: (id: string) => deleteSurvey(id),
}));
// The preview popup imports the Trainee's send action, which a preview never calls.
vi.mock("@/features/surveys/lib/actions/submit-survey", () => ({
  submitSurveyResponseAction: () => Promise.reject(new Error("a preview sends nothing")),
}));

const TODAY = "2026-10-29";
const KA = "11111111-1111-4111-8111-111111111111";
const HA = "22222222-2222-4222-8222-222222222222";
const SURVEY_ID = "33333333-3333-4333-8333-333333333333";
const BRANCHES = [
  { id: KA, nameHe: "קריית אתא" },
  { id: HA, nameHe: "חיפה" },
];

const COMPLETE: SurveyDraft = {
  ...newDraft(TODAY),
  title: "איך היה לך באקדמיה?",
  branchIds: [KA],
  closesOn: "2026-11-05",
  questions: [{ ...emptyQuestion("rating"), text: "כמה נהנית?" }],
};

function renderBuilder(over: { surveyId?: string | null; initial?: SurveyDraft; state?: SurveyState } = {}) {
  return render(
    <SurveyBuilder
      surveyId={over.surveyId ?? null}
      initial={over.initial ?? newDraft(TODAY)}
      state={over.state ?? "draft"}
      branches={BRANCHES}
      today={TODAY}
    />,
  );
}

const type = (name: string | RegExp, value: string) =>
  fireEvent.change(screen.getByRole("textbox", { name }), { target: { value } });
const click = (name: string | RegExp, index = 0) =>
  fireEvent.click(screen.getAllByRole("button", { name })[index]);
/** The header's button; the phone bar repeats each one after it. */
const headerButton = (name: string) => click(name, 0);
const questionTexts = () =>
  screen.getAllByRole("textbox", { name: /^טקסט שאלה/ }).map((input) => (input as HTMLInputElement).value);
const checklist = () => within(screen.getByRole("list", { name: "לפני פרסום" }));

beforeEach(() => {
  for (const mock of [push, replace, refresh, save, publish, unpublish, audienceYears, deleteSurvey]) {
    mock.mockReset();
  }
  save.mockResolvedValue({ success: true, surveyId: SURVEY_ID });
  publish.mockResolvedValue({ success: true });
  unpublish.mockResolvedValue({ success: true });
  deleteSurvey.mockResolvedValue({ success: true });
  audienceYears.mockResolvedValue({
    success: true,
    data: {
      years: [
        { year: 2014, count: 107 },
        { year: 2013, count: 98 },
      ],
      totalAllYears: 250,
    },
  });
  window.history.replaceState(null, "", "/admin/surveys/new");
});

afterEach(cleanup);

describe("SurveyBuilder: the publish checklist", () => {
  test("a new draft lists what it lacks, and each part turns to a check as it is filled", () => {
    renderBuilder();
    const list = checklist();
    expect(list.getByText("צריך כותרת של 2 עד 120 תווים")).toBeTruthy();
    expect(list.getByText("צריך לבחור לפחות סניף אחד")).toBeTruthy();
    expect(list.getByText("צריך לפחות שאלה אחת")).toBeTruthy();
    expect(list.getByText("תאריכים")).toBeTruthy();

    type("כותרת", "איך היה לך באקדמיה?");
    fireEvent.click(screen.getByRole("checkbox", { name: "קריית אתא" }));
    expect(list.getByText("כותרת וקהל")).toBeTruthy();

    click("דירוג 1 עד 5");
    expect(list.getByText("שאלה 1: צריך טקסט של 2 עד 300 תווים")).toBeTruthy();
    type("טקסט שאלה 1", "כמה נהנית?");
    expect(list.getByText("שאלה אחת")).toBeTruthy();
  });

  test("a blank option is named in the checklist", () => {
    renderBuilder();
    click("בחירה אחת");
    type("טקסט שאלה 1", "כמה פעמים?");
    type("תשובה 1 בשאלה 1", "פעם אחת");
    expect(checklist().getByText("שאלה 1: תשובה ריקה")).toBeTruthy();
  });
});

describe("SurveyBuilder: Questions", () => {
  test("adds a Question of each kind, in order, and the new one takes focus", () => {
    renderBuilder();
    click("דירוג 1 עד 5");
    click("בחירה אחת");
    click("כמה תשובות");
    click("טקסט חופשי");
    expect(screen.getByText("(4)")).toBeTruthy();
    expect(questionTexts()).toEqual(["", "", "", ""]);
    expect(screen.getByRole("textbox", { name: "טקסט שאלה 4" })).toHaveFocus();
    expect(screen.getByText("החניך כותב עד 1000 תווים")).toBeTruthy();
  });

  test("moves a Question up and down, and what was typed moves with it", () => {
    renderBuilder();
    click("טקסט חופשי");
    click("טקסט חופשי");
    type("טקסט שאלה 1", "ראשונה");
    type("טקסט שאלה 2", "שנייה");

    click("הזזת שאלה 2 למעלה");
    expect(questionTexts()).toEqual(["שנייה", "ראשונה"]);
    click("הזזת שאלה 1 למטה");
    expect(questionTexts()).toEqual(["ראשונה", "שנייה"]);
  });

  test("the first Question cannot move up and the last cannot move down", () => {
    renderBuilder();
    click("טקסט חופשי");
    click("טקסט חופשי");
    expect(screen.getByRole("button", { name: "הזזת שאלה 1 למעלה" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "הזזת שאלה 2 למטה" })).toBeDisabled();
  });

  test("deletes the Question it was pressed on", () => {
    renderBuilder();
    click("טקסט חופשי");
    click("טקסט חופשי");
    type("טקסט שאלה 1", "ראשונה");
    type("טקסט שאלה 2", "שנייה");
    click("מחיקת שאלה 1");
    expect(questionTexts()).toEqual(["שנייה"]);
  });

  test("stops offering new Questions at 20", () => {
    const nineteen = Array.from({ length: 19 }, (_, index) => ({
      ...emptyQuestion("text"),
      text: `שאלה מספר ${index + 1}`,
    }));
    renderBuilder({ initial: { ...newDraft(TODAY), questions: nineteen } });
    for (const kind of ["דירוג 1 עד 5", "בחירה אחת", "כמה תשובות", "טקסט חופשי"]) {
      expect(screen.getByRole("button", { name: kind })).toBeEnabled();
    }

    click("טקסט חופשי");
    expect(screen.getByText("(20)")).toBeTruthy();
    for (const kind of ["דירוג 1 עד 5", "בחירה אחת", "כמה תשובות", "טקסט חופשי"]) {
      expect(screen.getByRole("button", { name: kind })).toBeDisabled();
    }
  });

  test("a Question can be switched to be optional", () => {
    renderBuilder();
    click("טקסט חופשי");
    const required = screen.getByRole("switch", { name: "חובה לענות" });
    expect(required).toBeChecked();
    fireEvent.click(required);
    expect(required).not.toBeChecked();
  });
});

describe("SurveyBuilder: options", () => {
  function withChoice() {
    renderBuilder();
    click("בחירה אחת");
    type("תשובה 1 בשאלה 1", "פעם אחת");
    type("תשובה 2 בשאלה 1", "פעמיים");
  }
  const optionTexts = () =>
    screen.getAllByRole("textbox", { name: /^תשובה \d+ בשאלה 1$/ }).map((input) => (input as HTMLInputElement).value);

  test("a choice Question starts with two options and a rating with none", () => {
    renderBuilder();
    click("בחירה אחת");
    click("דירוג 1 עד 5");
    expect(screen.getAllByRole("textbox", { name: /^תשובה \d+ בשאלה 1$/ })).toHaveLength(2);
    expect(screen.queryByRole("textbox", { name: /^תשובה \d+ בשאלה 2$/ })).toBeNull();
    expect(screen.getByRole("textbox", { name: "תווית לדירוג 1 בשאלה 2" })).toBeTruthy();
  });

  test("adds an option, which takes focus, up to ten", () => {
    withChoice();
    click("הוספת תשובה");
    expect(screen.getByRole("textbox", { name: "תשובה 3 בשאלה 1" })).toHaveFocus();
    for (let count = 3; count < 10; count += 1) click("הוספת תשובה");
    expect(optionTexts()).toHaveLength(10);
    expect(screen.getByRole("button", { name: "הוספת תשובה" })).toBeDisabled();
  });

  test("moves an option, and what was typed moves with it", () => {
    withChoice();
    click("הזזת תשובה 1 למטה בשאלה 1");
    expect(optionTexts()).toEqual(["פעמיים", "פעם אחת"]);
    expect(screen.getByRole("button", { name: "הזזת תשובה 1 למעלה בשאלה 1" })).toBeDisabled();
  });

  test("removes the option it was pressed on", () => {
    withChoice();
    click("מחיקת תשובה 1 בשאלה 1");
    expect(optionTexts()).toEqual(["פעמיים"]);
  });

  test("a rating's end labels are typed beside the scale; a blank one is no label", () => {
    renderBuilder();
    click("דירוג 1 עד 5");
    type("תווית לדירוג 1 בשאלה 1", "בכלל לא");
    type("תווית לדירוג 5 בשאלה 1", "מאוד");
    type("תווית לדירוג 5 בשאלה 1", "");
    expect((screen.getByRole("textbox", { name: "תווית לדירוג 1 בשאלה 1" }) as HTMLInputElement).value).toBe("בכלל לא");
    expect((screen.getByRole("textbox", { name: "תווית לדירוג 5 בשאלה 1" }) as HTMLInputElement).value).toBe("");
  });

  test("a blank option is outlined only after a publish was tried", () => {
    withChoice();
    click("הוספת תשובה");
    expect(screen.queryByText("צריך למלא את התשובה או למחוק אותה")).toBeNull();
    headerButton("פרסום");
    expect(screen.getByText("צריך למלא את התשובה או למחוק אותה")).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "תשובה 3 בשאלה 1" })).toHaveAttribute("aria-invalid", "true");
  });
});

describe("SurveyBuilder: the audience", () => {
  test("ticking a branch asks for its birth years and shows each with its head count", async () => {
    renderBuilder();
    expect(audienceYears).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("checkbox", { name: "קריית אתא" }));
    expect(await screen.findByRole("button", { name: "2014, 107 חניכים" })).toBeTruthy();
    expect(audienceYears).toHaveBeenCalledWith([KA]);
    expect(screen.getByRole("button", { name: "2013, 98 חניכים" })).toBeTruthy();
    expect(screen.getByRole("status")).toHaveTextContent("יישלח ל-250 חניכים פעילים");
  });

  test("ticking a year narrows who it reaches, and unticking returns to every year", async () => {
    renderBuilder();
    fireEvent.click(screen.getByRole("checkbox", { name: "קריית אתא" }));
    const year = await screen.findByRole("button", { name: "2014, 107 חניכים" });
    fireEvent.click(year);
    expect(year).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("status")).toHaveTextContent("יישלח ל-107 חניכים פעילים");
    fireEvent.click(year);
    expect(screen.getByRole("status")).toHaveTextContent("יישלח ל-250 חניכים פעילים");
  });

  test("a server refusal to count is shown where the years would be", async () => {
    audienceYears.mockResolvedValue({ error: "מזהה לא תקין" });
    renderBuilder();
    fireEvent.click(screen.getByRole("checkbox", { name: "קריית אתא" }));
    expect(await screen.findByText("מזהה לא תקין")).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();
  });

  test("a slow answer for branches that were changed since does not replace the newer one", async () => {
    let resolveFirst: (value: unknown) => void = () => undefined;
    audienceYears.mockImplementationOnce(() => new Promise((resolve) => (resolveFirst = resolve)));
    audienceYears.mockResolvedValueOnce({
      success: true,
      data: { years: [{ year: 2010, count: 5 }], totalAllYears: 5 },
    });
    renderBuilder();
    fireEvent.click(screen.getByRole("checkbox", { name: "קריית אתא" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "חיפה" }));
    expect(await screen.findByRole("button", { name: "2010, 5 חניכים" })).toBeTruthy();

    await act(async () => {
      resolveFirst({ success: true, data: { years: [{ year: 2001, count: 1 }], totalAllYears: 1 } });
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(screen.queryByRole("button", { name: "2001, 1 חניכים" })).toBeNull();
    expect(screen.getByRole("button", { name: "2010, 5 חניכים" })).toBeTruthy();
  });
});

describe("SurveyBuilder: saving a draft", () => {
  test("saves the draft as typed, without publishing", async () => {
    renderBuilder({ initial: COMPLETE });
    headerButton("שמירה כטיוטה");
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save).toHaveBeenCalledWith(null, COMPLETE);
    expect(publish).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  test("the first save moves the address to the edit page, and the next save goes to the same Survey", async () => {
    renderBuilder({ initial: COMPLETE });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("סקר חדש");
    headerButton("שמירה כטיוטה");
    await waitFor(() => expect(window.location.pathname).toBe(`/admin/surveys/${SURVEY_ID}/edit`));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("עריכת סקר");
    headerButton("שמירה כטיוטה");
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    expect(save).toHaveBeenLastCalledWith(SURVEY_ID, COMPLETE);
    expect(replace).not.toHaveBeenCalled();
  });

  test("a draft can be saved while it is still incomplete", async () => {
    renderBuilder();
    headerButton("שמירה כטיוטה");
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  });

  test("a refusal is shown, and cleared when something is edited", async () => {
    save.mockResolvedValue({ error: "השמירה נכשלה. נסו שוב." });
    renderBuilder({ initial: COMPLETE });
    headerButton("שמירה כטיוטה");
    expect(await screen.findByRole("alert")).toHaveTextContent("השמירה נכשלה. נסו שוב.");
    type("כותרת", "איך היה לך באקדמיה, באמת?");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  test("a save that throws reads as a failed save", async () => {
    save.mockRejectedValue(new Error("network"));
    renderBuilder({ initial: COMPLETE });
    headerButton("שמירה כטיוטה");
    expect(await screen.findByRole("alert")).toHaveTextContent("השמירה נכשלה. נסו שוב.");
  });
});

describe("SurveyBuilder: publishing", () => {
  test("with something missing, nothing is sent and every problem is listed", () => {
    renderBuilder();
    headerButton("פרסום");
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("צריך כותרת של 2 עד 120 תווים");
    expect(alert).toHaveTextContent("צריך לבחור לפחות סניף אחד");
    expect(alert).toHaveTextContent("צריך לפחות שאלה אחת");
    expect(save).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });

  test("saves, then publishes, then opens the Survey's page", async () => {
    renderBuilder({ initial: COMPLETE });
    headerButton("פרסום");
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/admin/surveys/${SURVEY_ID}`));
    expect(save).toHaveBeenCalledWith(null, COMPLETE);
    expect(publish).toHaveBeenCalledWith(SURVEY_ID);
    expect(save.mock.invocationCallOrder[0]).toBeLessThan(publish.mock.invocationCallOrder[0]);
  });

  test("a second press while it is going does nothing", async () => {
    renderBuilder({ initial: COMPLETE });
    headerButton("פרסום");
    headerButton("פרסום");
    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
    expect(save).toHaveBeenCalledTimes(1);
  });

  test("every problem the server refuses with is listed, and nothing is opened", async () => {
    publish.mockResolvedValue({ error: "צריך כותרת של 2 עד 120 תווים · צריך לפחות שאלה אחת" });
    renderBuilder({ initial: COMPLETE });
    headerButton("פרסום");
    const alert = await screen.findByRole("alert");
    expect(within(alert).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "צריך כותרת של 2 עד 120 תווים",
      "צריך לפחות שאלה אחת",
    ]);
    expect(push).not.toHaveBeenCalled();
  });

  test("a failed save stops before publishing", async () => {
    save.mockResolvedValue({ error: "אין הרשאה לסקר הזה" });
    renderBuilder({ initial: COMPLETE });
    headerButton("פרסום");
    expect(await screen.findByRole("alert")).toHaveTextContent("אין הרשאה לסקר הזה");
    expect(publish).not.toHaveBeenCalled();
  });

  test("a publish that fails after the first save keeps the saved Survey for the next try", async () => {
    publish.mockResolvedValueOnce({ error: "הסקר השתנה בינתיים. נסו שוב." });
    renderBuilder({ initial: COMPLETE });
    headerButton("פרסום");
    await screen.findByRole("alert");
    headerButton("פרסום");
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/admin/surveys/${SURVEY_ID}`));
    expect(save).toHaveBeenNthCalledWith(2, SURVEY_ID, COMPLETE);
  });
});

describe("SurveyBuilder: a Survey that is already published", () => {
  test("offers save and return to draft, not publish", () => {
    renderBuilder({ surveyId: SURVEY_ID, initial: COMPLETE, state: "open" });
    expect(screen.queryByRole("button", { name: "פרסום" })).toBeNull();
    expect(screen.getAllByRole("button", { name: "שמירה" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "החזרה לטיוטה" }).length).toBeGreaterThan(0);
  });

  test("returning to draft asks the server and refreshes the page", async () => {
    renderBuilder({ surveyId: SURVEY_ID, initial: COMPLETE, state: "open" });
    headerButton("החזרה לטיוטה");
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(unpublish).toHaveBeenCalledWith(SURVEY_ID);
  });

  test("saving keeps it published: nothing is published again", async () => {
    renderBuilder({ surveyId: SURVEY_ID, initial: COMPLETE, state: "open" });
    headerButton("שמירה");
    await waitFor(() => expect(save).toHaveBeenCalledWith(SURVEY_ID, COMPLETE));
    expect(publish).not.toHaveBeenCalled();
  });
});

describe("SurveyBuilder: preview and delete", () => {
  test("the preview is off until there is a Question to show", () => {
    renderBuilder();
    expect(screen.getAllByRole("button", { name: "תצוגה מקדימה" })[0]).toBeDisabled();
  });

  test("the preview opens the popup with the draft and sends nothing", () => {
    renderBuilder({ initial: COMPLETE });
    headerButton("תצוגה מקדימה");
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("איך היה לך באקדמיה?")).toBeTruthy();
    expect(save).not.toHaveBeenCalled();
  });

  test("a new Survey has nothing to delete yet", () => {
    renderBuilder();
    expect(screen.queryByRole("button", { name: "מחיקת הסקר" })).toBeNull();
  });

  test("deleting asks first, then removes the Survey and goes back to the list", async () => {
    renderBuilder({ surveyId: SURVEY_ID, initial: COMPLETE });
    fireEvent.click(screen.getByRole("button", { name: "מחיקת הסקר" }));
    expect(deleteSurvey).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "מחיקה" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/surveys"));
    expect(deleteSurvey).toHaveBeenCalledWith(SURVEY_ID);
  });
});
