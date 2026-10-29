import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { SurveyActions } from "../SurveyActions";

// Only the router, the toasts and the two server actions are stubbed.
const push = vi.fn();
const refresh = vi.fn();
const closeSurvey = vi.fn();
const deleteSurvey = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/features/surveys/lib/actions/close-survey", () => ({
  closeSurveyAction: (id: string) => closeSurvey(id),
}));
vi.mock("@/features/surveys/lib/actions/delete-survey", () => ({
  deleteSurveyAction: (id: string) => deleteSurvey(id),
}));

const SURVEY_ID = "33333333-3333-4333-8333-333333333333";
const ROWS = [{ "שם": "יונתן", "שנתון": "2014" }];

function renderActions(over: Partial<Parameters<typeof SurveyActions>[0]> = {}) {
  return render(
    <SurveyActions
      surveyId={SURVEY_ID}
      canEdit
      canClose
      canDelete
      responseCount={78}
      csvRows={ROWS}
      csvFileName="survey-2026-10-29.csv"
      {...over}
    />,
  );
}

beforeEach(() => {
  closeSurvey.mockResolvedValue({ success: true });
  deleteSurvey.mockResolvedValue({ success: true });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("SurveyActions: what is offered", () => {
  test("everything an Admin may do to an open Survey, in the order edit, close, delete, CSV", () => {
    renderActions();
    expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual([
      "סגירה עכשיו",
      "מחיקה",
      "CSV",
    ]);
    expect(screen.getByRole("link", { name: "עריכה" })).toHaveAttribute(
      "href",
      `/admin/surveys/${SURVEY_ID}/edit`,
    );
  });

  test("a viewer who may not edit gets only the export", () => {
    renderActions({ canEdit: false, canClose: false, canDelete: false });
    expect(screen.queryByRole("link", { name: "עריכה" })).toBeNull();
    expect(screen.queryByRole("button", { name: "סגירה עכשיו" })).toBeNull();
    expect(screen.queryByRole("button", { name: "מחיקה" })).toBeNull();
    expect(screen.getByRole("button", { name: "CSV" })).toBeTruthy();
  });

  test("an ended Survey cannot be closed again", () => {
    renderActions({ canClose: false });
    expect(screen.queryByRole("button", { name: "סגירה עכשיו" })).toBeNull();
    expect(screen.getByRole("button", { name: "מחיקה" })).toBeTruthy();
  });
});

describe("SurveyActions: closing now", () => {
  test("asks first, then closes the Survey and refreshes the page", async () => {
    renderActions();
    fireEvent.click(screen.getByRole("button", { name: "סגירה עכשיו" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("לסגור את הסקר עכשיו?")).toBeTruthy();
    expect(closeSurvey).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: "סגירה" }));
    await waitFor(() => expect(closeSurvey).toHaveBeenCalledWith(SURVEY_ID));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(push).not.toHaveBeenCalled();
  });

  test("cancelling closes nothing", async () => {
    renderActions();
    fireEvent.click(screen.getByRole("button", { name: "סגירה עכשיו" }));
    fireEvent.click(await screen.findByRole("button", { name: "ביטול" }));
    expect(closeSurvey).not.toHaveBeenCalled();
  });

  test("a refusal keeps the page where it is", async () => {
    closeSurvey.mockResolvedValue({ error: "הסקר כבר נסגר" });
    renderActions();
    fireEvent.click(screen.getByRole("button", { name: "סגירה עכשיו" }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "סגירה" }));
    await waitFor(() => expect(closeSurvey).toHaveBeenCalled());
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe("SurveyActions: deleting", () => {
  test("says how many Responses go with the Survey, then deletes it and goes back to the list", async () => {
    renderActions({ responseCount: 78 });
    fireEvent.click(screen.getByRole("button", { name: "מחיקה" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(
      within(dialog).getByText("הסקר, השאלות שלו ו-78 התשובות שנשלחו אליו יימחקו, ואי אפשר לשחזר אותם."),
    ).toBeTruthy();
    expect(deleteSurvey).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: "מחיקה" }));
    await waitFor(() => expect(deleteSurvey).toHaveBeenCalledWith(SURVEY_ID));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/surveys"));
  });

  test("a Survey nobody answered says only the Survey goes", async () => {
    renderActions({ responseCount: 0 });
    fireEvent.click(screen.getByRole("button", { name: "מחיקה" }));
    expect(
      within(await screen.findByRole("alertdialog")).getByText("הסקר והשאלות שלו יימחקו, ואי אפשר לשחזר אותם."),
    ).toBeTruthy();
  });

  test("a refusal stays on the page", async () => {
    deleteSurvey.mockResolvedValue({ error: "אי אפשר למחוק סקר שיש עליו תשובות" });
    renderActions();
    fireEvent.click(screen.getByRole("button", { name: "מחיקה" }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "מחיקה" }));
    await waitFor(() => expect(deleteSurvey).toHaveBeenCalled());
    expect(push).not.toHaveBeenCalled();
  });
});
