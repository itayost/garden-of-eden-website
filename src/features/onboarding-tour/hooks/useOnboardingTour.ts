"use client";

import { useRef, useCallback, useEffect, useState } from "react";
import { driver, type Driver } from "driver.js";
import "driver.js/dist/driver.css";
import "../lib/styles/tour.css";
import { TOUR_STEPS } from "../lib/config/tour-steps";

interface UseOnboardingTourOptions {
  autoStart: boolean;
  onComplete: () => void;
}

export function useOnboardingTour({ autoStart, onComplete }: UseOnboardingTourOptions) {
  const driverRef = useRef<Driver | null>(null);
  const [isActive, setIsActive] = useState(false);
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const startTour = useCallback(() => {
    // Destroy any existing instance
    if (driverRef.current) {
      driverRef.current.destroy();
      driverRef.current = null;
    }

    completedRef.current = false;

    const driverObj = driver({
      showProgress: true,
      progressText: "{{current}} / {{total}}",
      nextBtnText: "הבא",
      prevBtnText: "הקודם",
      doneBtnText: "סיום",
      allowClose: true,
      animate: true,
      smoothScroll: true,
      stagePadding: 8,
      stageRadius: 8,
      popoverOffset: 12,
      steps: TOUR_STEPS,
      onDestroyStarted: () => {
        if (!completedRef.current) {
          completedRef.current = true;
          onCompleteRef.current();
        }
      },
      onDestroyed: () => {
        setIsActive(false);
        driverRef.current = null;
      },
    });

    driverRef.current = driverObj;
    setIsActive(true);
    driverObj.drive();
  }, []);

  // Auto-start on mount if needed
  useEffect(() => {
    if (!autoStart) return;

    // Wait for DOM to fully settle after hydration + Suspense
    const timer = setTimeout(() => {
      startTour();
    }, 1500);

    return () => {
      clearTimeout(timer);
      if (driverRef.current) {
        driverRef.current.destroy();
        driverRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (driverRef.current) {
        driverRef.current.destroy();
        driverRef.current = null;
      }
    };
  }, []);

  return { startTour, isActive };
}
