"use client";

import { motion } from "framer-motion";
import { Trophy } from "lucide-react";

/**
 * The completed-session moment — the one place this screen spends boldness.
 * Forest card with the gold glow from the app's celebration vocabulary; the
 * spring entrance is the celebration (no confetti library, no looping shimmer).
 * MotionConfig (reducedMotion="user") collapses it to a static card for
 * reduced-motion users.
 */

interface CompletionCelebrationProps {
  exerciseCount: number;
  totalSets: number;
  /** Sum of logged weights, when any were logged. */
  totalWeightKg: number | null;
}

export function CompletionCelebration({
  exerciseCount,
  totalSets,
  totalWeightKg,
}: CompletionCelebrationProps) {
  const parts = [`${exerciseCount} תרגילים`];
  if (totalSets > 0) parts.push(`${totalSets} סטים`);
  if (totalWeightKg !== null && totalWeightKg > 0)
    parts.push(`${totalWeightKg} ק"ג הורמו`);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 20 }}
      className="glow-gold rounded-2xl bg-forest px-4 py-6 text-center text-cream"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 15, delay: 0.15 }}
        className="flex justify-center"
        aria-hidden="true"
      >
        <Trophy className="h-10 w-10 text-gold" strokeWidth={1.75} />
      </motion.div>
      <p className="font-display mt-2 text-3xl text-gold">האימון הושלם!</p>
      <p className="mt-1 text-sm text-cream/70 tabular-nums">{parts.join(" · ")}</p>
    </motion.div>
  );
}
