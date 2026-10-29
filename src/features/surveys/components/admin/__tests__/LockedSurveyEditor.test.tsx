import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import type { SurveyQuestion, SurveyRecord } from "../../../lib/types";
import { LockedSurveyEditor } from "../LockedSurveyEditor";

// Only the router and the server actions are stubbed.
const push = vi.fn();
const refresh = vi.fn();
const updateDetails = vi.fn();
const closeSurvey = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/features/surveys/lib/actions/update-survey-details", () => ({
  updateSurveyDetailsAction: (id: string, details: unknown) => updateDetails(id, details),
}));
vi.mock("@/features/surveys/lib/actions/close-survey", () => ({
  closeSurveyAction: (id: string) => closeSurvey(id),
}));

const TODAY = "2026-10-29";
const SURVEY_ID = "33333333-3333-4333-8333-333333333333";

const RECORD: SurveyRecord = {
  id: SURVEY_ID,
  title: "איך היה לך באקדמיה?",
  intro: "חמש שאלות קצרות",
  opensOn: "2026-10-22",
  closesOn: "2026-11-05",
  birthYears: [2013, 2014, 2015],
  branchIds: ["b-ka", "b-ha"],
  createdBy: "u1",
  createdAt: "2026-10-20T08:00:00Z",
  publishedAt: "2026-10-22T08:00:00Z",
  closedAt: null,
};

const QUESTIONS: SurveyQuestion[] = [
  { id: "q1", kind: "rating", text: "כמה נהנית?", required: true, lowLabel: null, highLabel: null, options: [] },
  {
    id: "q2",
    kind: "single_choice",
    text: "כמה פעמים בשבוע?",
    required: false,
    lowLabel: null,
    highLabel: null,
    options: [
      { id: "o1", label: "פעם אחת" },
      { id: "o2", label: "פעמיים" },
    ],
  },
];

function renderLocked(over: { record?: Partial<SurveyRecord>; responseCount?: number } = {}) {
  return render(
    <LockedSurveyEditor
      record={{ ...RECORD, ...over.record }}
      questions={QUESTIONS}
      responseCount={over.responseCount ?? 78}
      branchNames={["חיפה", "קריית אתא"]}
      today={TODAY}
    />,
  );
}

const dateInput = () => screen.getByLabelText("נסגר לא חובה") as HTMLInputElement;
const clickSave = () => fireEvent.click(screen.getAllByRole("button", { name: "שמירה" })[0]);

beforeEach(() => {
  for (const mock of [push, refresh, updateDetails, closeSurvey]) mock.mockReset();
  updateDetails.mockResolvedValue({ success: true });
  closeSurvey.mockResolvedValue({ success: true });
});

afterEach(cleanup);

describe("LockedSurveyEditor: what is locked", () => {
  test("says how many answered and what stays editable", () => {
    renderLocked();
    expect(
      screen.getByText(/השאלות והקהל נעולים כדי שהתוצאות יישארו השוואתיות\. אפשר לשנות כותרת, פתיח ותאריך סגירה\./),
    ).toBeTruthy();
    expect(screen.getByText("78 חניכים כבר ענו.")).toBeTruthy();
  });

  test("the singular for one Response", () => {
    renderLocked({ responseCount: 1 });
    expect(screen.getByText("חניך אחד כבר ענה.")).toBeTruthy();
  });

  test("shows the audience and every Question as text, with no field to change them", () => {
    renderLocked();
    expect(screen.getByText("חיפה, קריית אתא · ילידי 2013 עד 2015")).toBeTruthy();
    expect(screen.getByText("כמה נהנית?")).toBeTruthy();
    expect(screen.getByText("כמה פעמים בשבוע?")).toBeTruthy();
    expect(screen.getByText("בחירה אחת · לא חובה")).toBeTruthy();
    expect(screen.getByText("(2, נעולות)")).toBeTruthy();
    expect(screen.getAllByRole("textbox").map((box) => box.getAttribute("aria-label") ?? box.id)).toEqual([
      "locked-title",
      "locked-intro",
    ]);
    expect(screen.queryByRole("switch")).toBeNull();
  });
});

describe("LockedSurveyEditor: saving the details", () => {
  test("sends the title, intro and close date", async () => {
    renderLocked();
    fireEvent.change(screen.getByLabelText("כותרת"), { target: { value: "כותרת חדשה" } });
    fireEvent.change(dateInput(), { target: { value: "2026-11-12" } });
    clickSave();
    await waitFor(() => expect(updateDetails).toHaveBeenCalledTimes(1));
    expect(updateDetails).toHaveBeenCalledWith(SURVEY_ID, {
      title: "כותרת חדשה",
      intro: "חמש שאלות קצרות",
      closesOn: "2026-11-12",
    });
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  test("a blank intro and a cleared date are sent as nothing", async () => {
    renderLocked();
    fireEvent.change(screen.getByLabelText(/פתיח/), { target: { value: "  " } });
    fireEvent.change(dateInput(), { target: { value: "" } });
    clickSave();
    await waitFor(() => expect(updateDetails).toHaveBeenCalledTimes(1));
    expect(updateDetails).toHaveBeenCalledWith(SURVEY_ID, {
      title: "איך היה לך באקדמיה?",
      intro: null,
      closesOn: null,
    });
  });

  test("a refusal is shown and nothing is refreshed", async () => {
    updateDetails.mockResolvedValue({ error: "תאריך הסגירה כבר עבר" });
    renderLocked();
    clickSave();
    expect(await screen.findByRole("alert")).toHaveTextContent("תאריך הסגירה כבר עבר");
    expect(refresh).not.toHaveBeenCalled();
  });

  test("a save that throws reads as a failed save", async () => {
    updateDetails.mockRejectedValue(new Error("network"));
    renderLocked();
    clickSave();
    expect(await screen.findByRole("alert")).toHaveTextContent("השמירה נכשלה. נסו שוב.");
  });

  test("editing clears the refusal", async () => {
    updateDetails.mockResolvedValue({ error: "תאריך הסגירה כבר עבר" });
    renderLocked();
    clickSave();
    await screen.findByRole("alert");
    fireEvent.change(screen.getByLabelText("כותרת"), { target: { value: "כותרת אחרת" } });
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("LockedSurveyEditor: moving the close date of a survey that ended by date", () => {
  const ended = { closesOn: "2026-10-28" };

  test("a new date from today on says the survey opens again until then", () => {
    renderLocked({ record: ended });
    expect(screen.queryByText("סקר שנסגר לפי תאריך נפתח שוב עד התאריך החדש.")).toBeNull();
    fireEvent.change(dateInput(), { target: { value: "2026-11-12" } });
    expect(screen.getByText("סקר שנסגר לפי תאריך נפתח שוב עד התאריך החדש.")).toBeTruthy();
  });

  test("a date still in the past says nothing", () => {
    renderLocked({ record: ended });
    fireEvent.change(dateInput(), { target: { value: "2026-10-20" } });
    expect(screen.queryByText("סקר שנסגר לפי תאריך נפתח שוב עד התאריך החדש.")).toBeNull();
  });

  test("a survey that is still open has nothing to reopen", () => {
    renderLocked();
    fireEvent.change(dateInput(), { target: { value: "2026-11-12" } });
    expect(screen.queryByText("סקר שנסגר לפי תאריך נפתח שוב עד התאריך החדש.")).toBeNull();
  });

  test("clearing the date warns that it opens again with no end date", () => {
    renderLocked({ record: ended });
    expect(screen.queryByText("ייפתח שוב ללא תאריך סגירה")).toBeNull();
    fireEvent.change(dateInput(), { target: { value: "" } });
    expect(screen.getByText("ייפתח שוב ללא תאריך סגירה")).toBeTruthy();
    expect(screen.queryByText("סקר שנסגר לפי תאריך נפתח שוב עד התאריך החדש.")).toBeNull();
  });

  test("clearing the date of a survey that is still open warns of nothing", () => {
    renderLocked();
    fireEvent.change(dateInput(), { target: { value: "" } });
    expect(screen.queryByText("ייפתח שוב ללא תאריך סגירה")).toBeNull();
  });
});

describe("LockedSurveyEditor: closing now", () => {
  test("asks first, then closes the survey and opens its results", async () => {
    renderLocked();
    fireEvent.click(screen.getAllByRole("button", { name: "סגירה עכשיו" })[0]);
    expect(closeSurvey).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "סגירה" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/admin/surveys/${SURVEY_ID}`));
    expect(closeSurvey).toHaveBeenCalledWith(SURVEY_ID);
  });

  test("a survey that already ended by date has no close button, only save", () => {
    renderLocked({ record: { closesOn: "2026-10-28" } });
    expect(screen.queryByRole("button", { name: "סגירה עכשיו" })).toBeNull();
    expect(screen.getAllByRole("button", { name: "שמירה" }).length).toBeGreaterThan(0);
  });

  test("cancelling the confirmation closes nothing", () => {
    renderLocked();
    fireEvent.click(screen.getAllByRole("button", { name: "סגירה עכשיו" })[0]);
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "ביטול" }));
    expect(closeSurvey).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });
});
