"use client";

import { useCallback } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useOnboardingTour } from "../hooks/useOnboardingTour";
import { completeTour } from "../lib/actions/complete-tour";

interface OnboardingTourProviderProps {
  tourCompleted: boolean;
}

/** Must be rendered inside a <Suspense> boundary (uses useSearchParams). */
export function OnboardingTourProvider({ tourCompleted }: OnboardingTourProviderProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const isOnDashboard = pathname === "/dashboard";
  const hasTourParam = searchParams.get("tour") === "1";
  const shouldAutoStart = isOnDashboard && (!tourCompleted || hasTourParam);

  const handleComplete = useCallback(async () => {
    await completeTour();
    // Clean up the ?tour=1 param from the URL if present
    if (hasTourParam && typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("tour");
      window.history.replaceState({}, "", url.toString());
    }
  }, [hasTourParam]);

  useOnboardingTour({
    autoStart: shouldAutoStart,
    onComplete: handleComplete,
  });

  // This component renders nothing — it only manages the tour lifecycle
  return null;
}
