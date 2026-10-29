import { markSurveySeenAction } from "../../lib/actions/mark-seen";

/**
 * Records, without waiting, that the Trainee was shown the Survey. A refusal
 * is logged by the action itself; a request that fails to reach the server is
 * logged here, so it never surfaces as an unhandled rejection in the browser.
 */
export function recordSeen(surveyId: string): void {
  markSurveySeenAction(surveyId).catch((error: unknown) => {
    console.error(
      "[surveys] marking a survey seen failed:",
      error instanceof Error ? error.message : error,
    );
  });
}
