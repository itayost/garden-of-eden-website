import type { BranchScope } from "@/lib/branches/branch-scope";
import type { BranchOption } from "@/types/branches";

interface ResolveInput {
  /** The ?branch= value, if any. */
  requested: string | null | undefined;
  scope: BranchScope;
  /** Active branches in display order. */
  branches: readonly BranchOption[];
}

/** The branches a caller may switch between, in display order. */
export function allowedBranches(
  scope: BranchScope,
  branches: readonly BranchOption[],
): BranchOption[] {
  return scope.kind === "all"
    ? [...branches]
    : branches.filter((branch) => scope.ids.includes(branch.id));
}

/**
 * Which branch a schedule page should show.
 *
 * A valid, in-scope request wins. Anything else falls back silently to the
 * first branch the caller may see, in display order, the way a bad ?date=
 * falls back to today. Null means there is nothing to show at all.
 */
export function resolveRequestedBranch({
  requested,
  scope,
  branches,
}: ResolveInput): string | null {
  const allowed = allowedBranches(scope, branches);

  if (allowed.length === 0) return null;
  if (requested && allowed.some((branch) => branch.id === requested)) return requested;
  return allowed[0].id;
}
