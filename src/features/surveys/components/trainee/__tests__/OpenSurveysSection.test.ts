import { beforeEach, describe, expect, test, vi } from "vitest";
import { isValidElement, type ReactNode } from "react";

import type { OfferableSurvey } from "../../../lib/types";
import { OpenSurveysCard } from "../OpenSurveysCard";
import { OpenSurveysSection } from "../OpenSurveysSection";
import { SurveyErrorBoundary } from "../SurveyErrorBoundary";

// The section reads with the service role and the card calls server actions;
// both are stubbed so only the section's own wiring is under test.
const loadTraineeOffers = vi.fn();

vi.mock("@/features/surveys/lib/trainee-offers", () => ({
  loadTraineeOffers: (userId: string, today: string) => loadTraineeOffers(userId, today),
}));
vi.mock("@/features/surveys/lib/actions/submit-survey", () => ({ submitSurveyResponseAction: vi.fn() }));
vi.mock("@/features/surveys/lib/actions/mark-seen", () => ({ markSurveySeenAction: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }), usePathname: () => "/dashboard" }));

const survey: OfferableSurvey = {
  id: "s-1",
  title: "סקר",
  intro: null,
  closesOn: null,
  publishedAt: "2026-10-20T00:00:00Z",
  questions: [],
};

beforeEach(() => {
  loadTraineeOffers.mockReset();
});

describe("OpenSurveysSection", () => {
  test("reads the Trainee's offers and hands them to the card inside an error boundary", async () => {
    loadTraineeOffers.mockResolvedValue([survey]);
    const result = await OpenSurveysSection({ userId: "user-1", firstName: "נועם" });

    expect(loadTraineeOffers).toHaveBeenCalledWith("user-1", expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
    if (!isValidElement<{ children: ReactNode }>(result)) throw new Error("expected an element");
    expect(result.type).toBe(SurveyErrorBoundary);
    const card = result.props.children;
    if (!isValidElement<{ surveys: OfferableSurvey[]; firstName: string }>(card)) {
      throw new Error("expected the card inside the boundary");
    }
    expect(card.type).toBe(OpenSurveysCard);
    expect(card.props.surveys).toEqual([survey]);
    expect(card.props.firstName).toBe("נועם");
  });

  test("with nothing to offer the card still gets an empty list", async () => {
    loadTraineeOffers.mockResolvedValue([]);
    const result = await OpenSurveysSection({ userId: "user-1", firstName: "נועם" });
    if (!isValidElement<{ children: ReactNode }>(result)) throw new Error("expected an element");
    const card = result.props.children;
    if (!isValidElement<{ surveys: OfferableSurvey[] }>(card)) throw new Error("expected the card");
    expect(card.props.surveys).toEqual([]);
  });
});
