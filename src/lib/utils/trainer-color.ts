/**
 * Deterministic color identity per trainer on the daily schedule.
 *
 * Two slots at the same hour must be distinguishable at a glance, and a
 * trainer keeps the same color across days and screens — the mapping hashes
 * the profile id, so it is stable with zero configuration or storage.
 *
 * Six hand-picked hues that stay distinct from the app's semantic colors:
 * grass green means "done" and gold means "celebration", so neither is a
 * trainer identity.
 */

export interface TrainerPalette {
  /** Solid dot beside the trainer name. */
  dot: string;
  /** Trainer name tint. */
  text: string;
  /** Subtle card-header wash. */
  bg: string;
}

export const TRAINER_PALETTES: readonly TrainerPalette[] = [
  { dot: "bg-blue-600", text: "text-blue-700", bg: "bg-blue-50" },
  { dot: "bg-pink-600", text: "text-pink-700", bg: "bg-pink-50" },
  { dot: "bg-teal-600", text: "text-teal-700", bg: "bg-teal-50" },
  { dot: "bg-violet-600", text: "text-violet-700", bg: "bg-violet-50" },
  { dot: "bg-orange-600", text: "text-orange-700", bg: "bg-orange-50" },
  { dot: "bg-cyan-600", text: "text-cyan-700", bg: "bg-cyan-50" },
];

const NEUTRAL_PALETTE: TrainerPalette = {
  dot: "bg-muted-foreground",
  text: "text-muted-foreground",
  bg: "bg-muted/40",
};

export function trainerColor(trainerId: string | null | undefined): TrainerPalette {
  if (!trainerId) return NEUTRAL_PALETTE;

  let hash = 0;
  for (let i = 0; i < trainerId.length; i++) {
    hash = (hash * 31 + trainerId.charCodeAt(i)) >>> 0;
  }
  return TRAINER_PALETTES[hash % TRAINER_PALETTES.length];
}

/**
 * The id that gives a card its colour: the first trainer in order.
 *
 * First is a position, not a role. A slot with no trainers, or whose first
 * trainer was deleted, yields null and falls back to the neutral palette
 * through trainerColor's own handling.
 */
export function firstTrainerId(
  trainers: readonly { trainer_id: string | null; order_index: number }[],
): string | null {
  const ordered = [...trainers].sort((a, b) => a.order_index - b.order_index);
  return ordered[0]?.trainer_id ?? null;
}

/** "דין, לידור" — every name on the hour, in order. Empty when there are none. */
export function trainerNames(
  trainers: readonly { trainer_name: string; order_index: number }[],
): string {
  return [...trainers]
    .sort((a, b) => a.order_index - b.order_index)
    .map((trainer) => trainer.trainer_name)
    .join(", ");
}
