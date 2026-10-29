import { israelToday } from "@/lib/utils/tasks";
import { loadTraineeOffers } from "../../lib/trainee-offers";
import { OpenSurveysCard } from "./OpenSurveysCard";
import { SurveyErrorBoundary } from "./SurveyErrorBoundary";

interface OpenSurveysSectionProps {
  userId: string;
  firstName: string;
}

/**
 * The dashboard's list of open Surveys, read on its own. Mounted in a Suspense
 * of the page, so the read never holds the rest of the dashboard back; the
 * layout's popup shares the same read (React `cache`, one per request).
 *
 * The read answers with nothing to offer when it fails, so there is no throw
 * to catch here; the boundary guards the card's own render.
 */
export async function OpenSurveysSection({ userId, firstName }: OpenSurveysSectionProps) {
  const surveys = await loadTraineeOffers(userId, israelToday());
  return (
    <SurveyErrorBoundary>
      <OpenSurveysCard surveys={surveys} firstName={firstName} />
    </SurveyErrorBoundary>
  );
}
