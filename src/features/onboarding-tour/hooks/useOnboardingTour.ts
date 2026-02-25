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

  const handleComplete = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    setIsActive(false);
    onComplete();
  }, [onComplete]);

  const initDriver = useCallback(() => {
    if (driverRef.current) {
      driverRef.current.destroy();
    }

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
        handleComplete();
      },
      onDestroyed: () => {
        setIsActive(false);
      },
    });

    driverRef.current = driverObj;
    return driverObj;
  }, [handleComplete]);

  const startTour = useCallback(() => {
    completedRef.current = false;
    const driverObj = initDriver();
    setIsActive(true);
    driverObj.drive();
  }, [initDriver]);

  // Auto-start on mount if needed
  useEffect(() => {
    if (!autoStart) return;

    // Wait for DOM to settle after hydration
    const timer = setTimeout(() => {
      startTour();
    }, 800);

    return () => {
      clearTimeout(timer);
      if (driverRef.current) {
        driverRef.current.destroy();
      }
    };
  }, [autoStart, startTour]);

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
