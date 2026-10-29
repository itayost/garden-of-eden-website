/**
 * The Surveys a Trainee has been offered, for the layout's popup and the
 * dashboard card. Server only: the survey tables are read with the service role.
 */
import "server-only";

import { cache } from "react";

import { createAdminClient } from "@/lib/supabase/admin";
import { loadOfferableSurveys } from "./queries";
import type { OfferableSurvey } from "./types";

/**
 * Open, unanswered Surveys the Trainee is in the Audience of. Memoized for one
 * request (React `cache`, not a data cache), so the layout and the page share a
 * single read and a refresh after sending always reads fresh.
 *
 * A failed read is already logged by the loader. It answers with nothing to
 * offer rather than throwing: a missing popup must not take the whole
 * dashboard down.
 */
export const loadTraineeOffers = cache(
  async (userId: string, today: string): Promise<OfferableSurvey[]> => {
    try {
      return await loadOfferableSurveys(createAdminClient(), userId, today);
    } catch (error) {
      console.error(
        "[surveys] offers unavailable:",
        error instanceof Error ? error.message : error,
      );
      return [];
    }
  },
);
