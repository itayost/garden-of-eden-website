import { israelToday } from "@/lib/utils/tasks";
import { pickSurveyToOffer } from "../../lib/offer";
import { loadTraineeOffers } from "../../lib/trainee-offers";
import { SurveyPrompt } from "./SurveyPrompt";

interface SurveyPromptLoaderProps {
  userId: string;
  /** The onboarding tour comes first: nothing is offered until it is done. */
  tourCompleted: boolean;
  firstName: string;
}

/**
 * Picks the one Survey to offer and hands it to the client prompt. Mounted in
 * the Trainee layout inside its own Suspense, so the read never slows the page.
 * Renders nothing while the tour is due or when nothing is offerable.
 */
export async function SurveyPromptLoader({
  userId,
  tourCompleted,
  firstName,
}: SurveyPromptLoaderProps) {
  if (!tourCompleted) return null;
  const survey = pickSurveyToOffer(await loadTraineeOffers(userId, israelToday()));
  if (survey === null) return null;
  return <SurveyPrompt survey={survey} firstName={firstName} />;
}
