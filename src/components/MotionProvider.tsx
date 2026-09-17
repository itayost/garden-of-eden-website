"use client";

import { LazyMotion, MotionConfig, domAnimation } from "framer-motion";

/**
 * Motion defaults for animated surfaces. LazyMotion lets `m.*` components
 * load only the DOM animation features instead of the full motion bundle;
 * it is not strict, so existing `motion.*` components keep working.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={domAnimation}>
      <MotionConfig reducedMotion="user">
        {children}
      </MotionConfig>
    </LazyMotion>
  );
}
