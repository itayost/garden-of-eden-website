"use client";

import { useEffect, useState } from "react";

import { audienceYearsAction } from "../../lib/actions/audience-years";
import type { YearCount } from "../../lib/format";

export type AudienceYearsState =
  /** No branch is chosen, so there is nobody to count. */
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; years: YearCount[]; total: number }
  | { status: "error"; message: string };

const LOAD_FAILED = "טעינת השנתונים נכשלה. נסו שוב.";

type Outcome = Exclude<AudienceYearsState, { status: "idle" | "loading" }>;

async function loadYears(branchIds: string[]): Promise<Outcome> {
  try {
    const result = await audienceYearsAction(branchIds);
    if ("error" in result) return { status: "error", message: result.error };
    return { status: "ready", years: result.data.years, total: result.data.totalAllYears };
  } catch {
    return { status: "error", message: LOAD_FAILED };
  }
}

/**
 * The birth years and head counts of the Trainees in the chosen branches,
 * read again whenever the branches change. A slow answer for branches that
 * were unticked since is dropped, so the picture always matches the boxes.
 */
export function useAudienceYears(branchIds: readonly string[]): AudienceYearsState {
  const key = [...branchIds].sort().join(",");
  const [loaded, setLoaded] = useState<{ key: string; outcome: Outcome } | null>(null);

  useEffect(() => {
    if (key === "") return;
    let stale = false;
    loadYears(key.split(",")).then((outcome) => {
      if (!stale) setLoaded({ key, outcome });
    });
    return () => {
      stale = true;
    };
  }, [key]);

  if (key === "") return { status: "idle" };
  return loaded !== null && loaded.key === key ? loaded.outcome : { status: "loading" };
}
