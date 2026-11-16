import { Sparkles } from "lucide-react";
import { shortDate } from "@/lib/utils/iso-date";
import type { ProposalView } from "../lib/proposal-view";
import { ProposalCard } from "./ProposalCard";

/**
 * The Trainee's open Goal proposals at the top of the Goals card, with the
 * Assessment they come from. Renders nothing without a proposal.
 */
export function ProposalList({ proposals }: { proposals: readonly ProposalView[] }) {
  if (proposals.length === 0) return null;
  const assessmentDate = proposals.reduce(
    (newest, proposal) => (proposal.assessmentDate > newest ? proposal.assessmentDate : newest),
    "",
  );
  const sorted = [...proposals].sort((a, b) => a.rank - b.rank);

  return (
    <section className="space-y-3" aria-label="הצעות יעד">
      <div className="space-y-0.5">
        <h3 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
          הצעות יעד
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary tabular-nums">
            {proposals.length}
          </span>
        </h3>
        {assessmentDate && <p className="text-xs text-muted-foreground">לפי המבדק מ-{shortDate(assessmentDate)}</p>}
      </div>
      <div className="space-y-3">
        {sorted.map((proposal) => (
          <ProposalCard key={proposal.id} proposal={proposal} />
        ))}
      </div>
    </section>
  );
}
