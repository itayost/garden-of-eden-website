export type ClockInBranchPick =
  | { ok: true; branchId: string | null }
  | { ok: false };

/**
 * The branch a clock-in is recorded under.
 *
 * One branch: use it, no question asked. A request the trainer is not a
 * member of is refused. A dual-branch trainer who did not choose, or an
 * unassigned trainer, clocks in with no branch: the queue replays offline
 * clock-ins later and losing one over a missing branch is the worse outcome.
 */
export function pickClockInBranch(
  memberBranchIds: readonly string[],
  requested: string | null | undefined,
): ClockInBranchPick {
  if (requested) {
    return memberBranchIds.includes(requested)
      ? { ok: true, branchId: requested }
      : { ok: false };
  }
  if (memberBranchIds.length === 1) return { ok: true, branchId: memberBranchIds[0] };
  return { ok: true, branchId: null };
}
