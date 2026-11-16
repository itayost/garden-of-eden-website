"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { acceptGoalProposalAction } from "../lib/actions/accept";
import type { ProposalActionResult } from "../lib/actions/proposal-action";
import { rejectGoalProposalAction } from "../lib/actions/reject";
import type { ProposalView } from "../lib/proposal-view";

type ActionName = "accept" | "change" | "reject";

/**
 * The actions on one Goal proposal. Each sends the version the screen shows,
 * so a proposal that changed meanwhile is refused instead of acted on; each
 * shows a toast and refreshes the page, which drops a decided proposal from
 * the card and the tab. `locked` while one runs or the page refreshes.
 */
export function useProposalActions(proposal: Pick<ProposalView, "id" | "version">) {
  const router = useRouter();
  const [busy, setBusy] = useState<ActionName | null>(null);
  const [refreshing, startRefresh] = useTransition();
  const ids = { proposalId: proposal.id, version: proposal.version };

  async function run(name: ActionName, action: () => Promise<ProposalActionResult>, message: string) {
    setBusy(name);
    try {
      const result = await action();
      if ("error" in result) {
        toast.error(result.error);
        return false;
      }
      toast.success(message);
      startRefresh(() => router.refresh());
      return true;
    } catch {
      toast.error("הפעולה נכשלה, נסו שוב");
      return false;
    } finally {
      setBusy(null);
    }
  }

  return {
    busy,
    locked: busy !== null || refreshing,
    accept: () => run("accept", () => acceptGoalProposalAction(ids), "היעד נקבע"),
    changeTarget: (target: number) => run("change", () => acceptGoalProposalAction({ ...ids, target }), "היעד נקבע"),
    reject: (reason: string) => run("reject", () => rejectGoalProposalAction({ ...ids, reason }), "ההצעה נדחתה"),
  };
}
