import { beforeEach, describe, expect, test, vi } from "vitest";
import { isValidElement } from "react";

import type { OfferableSurvey } from "../../../lib/types";
import { SurveyPrompt } from "../SurveyPrompt";
import { SurveyPromptLoader } from "../SurveyPromptLoader";

// The loader reads with the service role and the prompt calls server actions;
// both are stubbed so only the loader's own decision is under test.
const loadTraineeOffers = vi.fn();

vi.mock("@/features/surveys/lib/trainee-offers", () => ({
  loadTraineeOffers: (userId: string, today: string) => loadTraineeOffers(userId, today),
}));
vi.mock("@/features/surveys/lib/actions/submit-survey", () => ({ submitSurveyResponseAction: vi.fn() }));
vi.mock("@/features/surveys/lib/actions/mark-seen", () => ({ markSurveySeenAction: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }), usePathname: () => "/dashboard" }));

const survey = (id: string, closesOn: string | null): OfferableSurvey => ({
  id,
  title: id,
  intro: null,
  closesOn,
  publishedAt: "2026-10-20T00:00:00Z",
  questions: [],
});

const props = { userId: "user-1", firstName: "נועם" };

beforeEach(() => {
  loadTraineeOffers.mockReset();
});

describe("SurveyPromptLoader", () => {
  test("renders nothing, and reads nothing, while the tour is due", async () => {
    const result = await SurveyPromptLoader({ ...props, tourCompleted: false });
    expect(result).toBeNull();
    expect(loadTraineeOffers).not.toHaveBeenCalled();
  });

  test("with nothing offerable it still renders the prompt, with no Survey, so the prompt stays mounted across refreshes", async () => {
    loadTraineeOffers.mockResolvedValue([]);
    const result = await SurveyPromptLoader({ ...props, tourCompleted: true });
    expect(isValidElement(result)).toBe(true);
    if (!isValidElement<{ survey: OfferableSurvey | null; firstName: string }>(result)) return;
    expect(result.type).toBe(SurveyPrompt);
    expect(result.props.survey).toBeNull();
    expect(result.props.firstName).toBe("נועם");
  });

  test("hands the prompt the Survey that closes first", async () => {
    loadTraineeOffers.mockResolvedValue([
      survey("later", "2026-11-10"),
      survey("sooner", "2026-11-05"),
      survey("open-ended", null),
    ]);
    const result = await SurveyPromptLoader({ ...props, tourCompleted: true });
    if (!isValidElement<{ survey: OfferableSurvey | null }>(result)) throw new Error("expected an element");
    expect(result.props.survey?.id).toBe("sooner");
  });
});
