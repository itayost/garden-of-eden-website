import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { israelToday } from "@/lib/utils/tasks";
import { snoozeKey } from "../../../lib/offer";
import type { OfferableSurvey } from "../../../lib/types";
import { SurveyPrompt } from "../SurveyPrompt";

// Only the router and the two server actions are stubbed: the prompt's own
// state, the dialog and the storage are real.
let pathname = "/dashboard";
const refresh = vi.fn();
const submit = vi.fn();
const markSeen = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
  usePathname: () => pathname,
}));
vi.mock("@/features/surveys/lib/actions/submit-survey", () => ({
  submitSurveyResponseAction: (input: unknown) => submit(input),
}));
vi.mock("@/features/surveys/lib/actions/mark-seen", () => ({
  markSurveySeenAction: (surveyId: string) => markSeen(surveyId),
}));

const survey = (id: string, title: string): OfferableSurvey => ({
  id,
  title,
  intro: null,
  closesOn: null,
  publishedAt: "2026-10-20T00:00:00Z",
  questions: [
    { id: "q1", kind: "rating", text: "כמה נהנית?", required: true, lowLabel: null, highLabel: null, options: [] },
  ],
});

const FIRST = survey("11111111-1111-4111-8111-111111111111", "הסקר הראשון");
const SECOND = survey("22222222-2222-4222-8222-222222222222", "הסקר השני");

const prompt = (offered: OfferableSurvey | null) => (
  <SurveyPrompt survey={offered} firstName="נועם" />
);

/** Lets effects and pending promises settle, for "nothing happens" assertions. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

async function answerAndSend(rating: string) {
  fireEvent.click(screen.getByText("יאללה, מתחילים"));
  fireEvent.click(screen.getByRole("radio", { name: rating }));
  fireEvent.click(screen.getByText("שליחה"));
  await waitFor(() => expect(screen.getByText("תודה, נועם!")).toBeTruthy());
}

beforeEach(() => {
  pathname = "/dashboard";
  localStorage.clear();
  refresh.mockReset();
  submit.mockReset();
  markSeen.mockReset();
  markSeen.mockResolvedValue({ success: true });
  submit.mockResolvedValue({ success: true });
});

afterEach(cleanup);

describe("SurveyPrompt: when it opens", () => {
  test("opens on the dashboard and records Seen once", async () => {
    render(prompt(FIRST));
    await waitFor(() => expect(screen.getByRole("dialog")).toBeTruthy());
    expect(markSeen).toHaveBeenCalledTimes(1);
    expect(markSeen).toHaveBeenCalledWith(FIRST.id);
  });

  test("a Survey snoozed today stays closed and is not marked Seen", async () => {
    localStorage.setItem(snoozeKey(FIRST.id), israelToday());
    render(prompt(FIRST));
    await settle();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(markSeen).not.toHaveBeenCalled();
  });

  test("a snooze from an earlier day does not hold it back", async () => {
    localStorage.setItem(snoozeKey(FIRST.id), "2020-01-01");
    render(prompt(FIRST));
    await waitFor(() => expect(screen.getByRole("dialog")).toBeTruthy());
  });

  test("waits on a mid-activity page and opens once the Trainee moves on", async () => {
    pathname = "/dashboard/workout";
    const { rerender } = render(prompt(FIRST));
    await settle();
    expect(screen.queryByRole("dialog")).toBeNull();

    pathname = "/dashboard/videos";
    rerender(prompt(FIRST));
    await waitFor(() => expect(screen.getByRole("dialog")).toBeTruthy());
  });

  test("with no Survey it renders nothing", () => {
    const { container } = render(prompt(null));
    expect(container.innerHTML).toBe("");
  });
});

describe("SurveyPrompt: a Seen record that cannot be sent", () => {
  test("a failed request is logged and does not stop the popup", async () => {
    markSeen.mockRejectedValue(new Error("network"));
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      render(prompt(FIRST));
      await waitFor(() => expect(screen.getByRole("dialog")).toBeTruthy());
      await waitFor(() =>
        expect(log).toHaveBeenCalledWith("[surveys] marking a survey seen failed:", "network"),
      );
    } finally {
      log.mockRestore();
    }
  });
});

describe("SurveyPrompt: closing while a send is in flight", () => {
  /** Answers the one Question and sends, leaving the send pending until `finish` is called. */
  async function startSend() {
    let finish: (outcome: unknown) => void = () => undefined;
    submit.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    render(prompt(FIRST));
    await waitFor(() => expect(screen.getByRole("dialog")).toBeTruthy());
    fireEvent.click(screen.getByText("יאללה, מתחילים"));
    fireEvent.click(screen.getByRole("radio", { name: "4" }));
    fireEvent.click(screen.getByText("שליחה"));
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    return finish;
  }

  test("Escape and the close button are ignored until the send ends", async () => {
    const finish = await startSend();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "סגירה" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(localStorage.getItem(snoozeKey(FIRST.id))).toBeNull();
    finish({ success: true });
    await waitFor(() => expect(screen.getByText("תודה, נועם!")).toBeTruthy());
  });

  test("a send that fails keeps the sheet, the answer and the error, with no snooze", async () => {
    const finish = await startSend();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    finish({ error: "השליחה נכשלה. נסו שוב." });
    expect(await screen.findByRole("alert")).toHaveTextContent("השליחה נכשלה. נסו שוב.");
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByRole("radio", { name: "4" })).toBeChecked();
    expect(localStorage.getItem(snoozeKey(FIRST.id))).toBeNull();
  });

  test("once the send has failed, closing works and snoozes the Survey again", async () => {
    const finish = await startSend();
    finish({ error: "השליחה נכשלה. נסו שוב." });
    await screen.findByRole("alert");
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(localStorage.getItem(snoozeKey(FIRST.id))).toBe(israelToday());
  });
});

describe("SurveyPrompt: a refusal that ends the Survey", () => {
  async function sendRefused(message: string) {
    submit.mockResolvedValue({ error: message });
    render(prompt(FIRST));
    await waitFor(() => expect(screen.getByRole("dialog")).toBeTruthy());
    fireEvent.click(screen.getByText("יאללה, מתחילים"));
    fireEvent.click(screen.getByRole("radio", { name: "3" }));
    fireEvent.click(screen.getByText("שליחה"));
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
  }

  test("already answered refreshes the page so the card and prompt drop the Survey", async () => {
    await sendRefused("כבר ענית על הסקר הזה");
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  test("closed refreshes the page too", async () => {
    await sendRefused("הסקר כבר נסגר");
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  test("any other refusal leaves the page alone", async () => {
    await sendRefused("השליחה נכשלה. נסו שוב.");
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe("SurveyPrompt: closing", () => {
  test("אחר כך snoozes the Survey for today and it does not reopen", async () => {
    const { rerender } = render(prompt(FIRST));
    await waitFor(() => expect(screen.getByRole("dialog")).toBeTruthy());
    fireEvent.click(screen.getByText("אחר כך"));
    expect(localStorage.getItem(snoozeKey(FIRST.id))).toBe(israelToday());

    pathname = "/dashboard/videos";
    rerender(prompt(FIRST));
    await settle();
    expect(markSeen).toHaveBeenCalledTimes(1);
  });

  test("Escape snoozes it too", async () => {
    render(prompt(FIRST));
    await waitFor(() => expect(screen.getByRole("dialog")).toBeTruthy());
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(localStorage.getItem(snoozeKey(FIRST.id))).toBe(israelToday());
  });

  test("storage that throws neither blocks opening nor closing", async () => {
    const read = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    try {
      render(prompt(FIRST));
      await waitFor(() => expect(screen.getByRole("dialog")).toBeTruthy());
      fireEvent.click(screen.getByText("אחר כך"));
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    } finally {
      read.mockRestore();
      write.mockRestore();
    }
  });
});

describe("SurveyPrompt: across the refresh after a send", () => {
  test("the thank-you stays when the layout stops offering the answered Survey", async () => {
    const { rerender } = render(prompt(FIRST));
    await waitFor(() => expect(screen.getByRole("dialog")).toBeTruthy());
    await answerAndSend("3");
    expect(refresh).toHaveBeenCalledTimes(1);

    // The refresh re-renders the layout: nothing is offerable any more.
    rerender(prompt(null));
    expect(screen.getByText("תודה, נועם!")).toBeTruthy();
    expect(screen.getByRole("dialog")).toBeTruthy();

    fireEvent.click(screen.getByText("סגירה"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(localStorage.getItem(snoozeKey(FIRST.id))).toBeNull();
  });

  test("the next Survey the layout hands down is not opened in the same visit", async () => {
    const { rerender } = render(prompt(FIRST));
    await waitFor(() => expect(screen.getByRole("dialog")).toBeTruthy());
    await answerAndSend("3");

    rerender(prompt(SECOND));
    expect(screen.getByText("תודה, נועם!")).toBeTruthy();
    fireEvent.click(screen.getByText("סגירה"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await settle();

    expect(screen.queryByText("הסקר השני")).toBeNull();
    expect(markSeen).toHaveBeenCalledTimes(1);
    expect(markSeen).toHaveBeenCalledWith(FIRST.id);
  });

  test("a Survey that shows up after the visit began, with none offered at the start, does not open", async () => {
    const { rerender } = render(prompt(null));
    await settle();

    rerender(prompt(SECOND));
    await settle();

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(markSeen).not.toHaveBeenCalled();
  });
});
