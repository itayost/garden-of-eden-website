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
 * Renders nothing only while the tour is due.
 *
 * Once the tour is done it always renders the prompt, with a null Survey when
 * nothing is offerable. After a send the layout re-renders without the answered
 * Survey; rendering null here would unmount the prompt and its open thank-you
 * screen, and a later refresh would mount a fresh one that opens a second popup
 * in the same visit. A prompt that stays mounted keeps its once-per-visit state.
 */
export async function SurveyPromptLoader({
  userId,
  tourCompleted,
  firstName,
}: SurveyPromptLoaderProps) {
  if (!tourCompleted) return null;
  const survey = pickSurveyToOffer(await loadTraineeOffers(userId, israelToday()));
  return <SurveyPrompt survey={survey} firstName={firstName} />;
}
