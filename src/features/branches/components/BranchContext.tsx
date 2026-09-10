"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { BranchOption } from "@/types/branches";

export interface BranchContextValue {
  /** The branch every dialog on this page writes to. */
  branchId: string;
  /** Branches the caller may switch between, in display order. */
  branches: BranchOption[];
  canSwitch: boolean;
}

const BranchContext = createContext<BranchContextValue | null>(null);

export function BranchProvider({
  value,
  children,
}: {
  value: BranchContextValue;
  children: ReactNode;
}) {
  return <BranchContext.Provider value={value}>{children}</BranchContext.Provider>;
}

/**
 * The page's current branch. Throws outside a provider so a dialog mounted
 * on a page that forgot the provider fails loudly instead of writing to
 * nothing.
 */
export function useCurrentBranch(): BranchContextValue {
  const value = useContext(BranchContext);
  if (!value) throw new Error("useCurrentBranch must be used inside BranchProvider");
  return value;
}

export function branchNameFor(branches: readonly BranchOption[], branchId: string): string {
  return branches.find((b) => b.id === branchId)?.nameHe ?? "";
}
