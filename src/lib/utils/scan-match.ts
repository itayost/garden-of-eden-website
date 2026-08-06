/**
 * Resolves a scanned equipment QR to the exercise it should open.
 *
 * Priority: the first UNLOGGED session exercise on that equipment (the work
 * the trainee presumably just did), then a logged one (so he can correct an
 * entry), then null — the free-log path for equipment outside his session.
 */

export interface ScanCandidate {
  sessionExerciseId: string;
  equipmentId: string | null;
  hasLog: boolean;
}

export function findScanTarget(
  candidates: readonly ScanCandidate[],
  equipmentId: string,
): string | null {
  const onEquipment = candidates.filter(
    (candidate) => candidate.equipmentId === equipmentId,
  );

  const unlogged = onEquipment.find((candidate) => !candidate.hasLog);
  return unlogged?.sessionExerciseId ?? onEquipment[0]?.sessionExerciseId ?? null;
}
