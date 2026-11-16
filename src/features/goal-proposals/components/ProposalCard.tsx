"use client";

import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  droppedReasonLine,
  sensitiveNotes,
  standingLine,
  targetLine,
  type ProposalView,
} from "../lib/proposal-view";
import { ChangeTargetDialog } from "./ChangeTargetDialog";
import { RejectProposalDialog } from "./RejectProposalDialog";
import { useProposalActions } from "./useProposalActions";

/**
 * One Goal proposal: the metric, the target the code set and where the
 * player stands, any `sensitive` warning, the model's reason (or why it was
 * removed), the chosen drills, and קבל, שנה יעד, דחה.
 */
export function ProposalCard({ proposal }: { proposal: ProposalView }) {
  const actions = useProposalActions(proposal);
  const warnings = sensitiveNotes(proposal.problems);

  return (
    <article className="space-y-2 rounded-lg border bg-card p-3 text-sm">
      <div className="space-y-0.5">
        <h4 className="font-bold">{proposal.label}</h4>
        <p className="tabular-nums">{targetLine(proposal)}</p>
        {proposal.facts && (
          <>
            <p className="text-xs text-muted-foreground tabular-nums">{standingLine(proposal.facts)}</p>
            <p className="text-xs text-muted-foreground">{proposal.facts.basis}</p>
          </>
        )}
      </div>

      {warnings.map((warning) => (
        <p key={warning} className="rounded-md border border-warning/40 bg-warning/10 px-2 py-1 text-xs text-warning-emphasis">
          {warning}
        </p>
      ))}

      {proposal.reason ? (
        <p>{proposal.reason}</p>
      ) : (
        <p className="text-xs text-muted-foreground">{droppedReasonLine(proposal.problems)}</p>
      )}

      {proposal.drills.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">תרגילים</p>
          <ul className="space-y-1.5">
            {proposal.drills.map((drill) => (
              <li key={drill.id} className="border-s-2 border-primary/30 ps-2">
                <p className="font-medium">{drill.name}</p>
                {drill.why && <p className="text-xs text-muted-foreground">{drill.why}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        <Button type="button" size="sm" disabled={actions.locked} onClick={() => void actions.accept()}>
          {actions.busy === "accept" ? (
            <Loader2 className="animate-spin" aria-hidden="true" />
          ) : (
            <Check aria-hidden="true" />
          )}
          קבל
        </Button>
        <ChangeTargetDialog
          key={proposal.id}
          proposal={proposal}
          disabled={actions.locked}
          onChange={actions.changeTarget}
        />
        <RejectProposalDialog
          key={`reject-${proposal.id}`}
          proposalId={proposal.id}
          label={proposal.label}
          disabled={actions.locked}
          onReject={actions.reject}
        />
      </div>
    </article>
  );
}
