import Link from "next/link";
import { shortDate } from "@/lib/utils/iso-date";
import { groupByTrainee, type ProposalView } from "../lib/proposal-view";
import { ProposalCard } from "./ProposalCard";

interface ProposalQueueProps {
  proposals: readonly ProposalView[];
  emptyText: string;
}

/**
 * The queue's "הצעות יעד" tab: every open Goal proposal in the caller's
 * scope, a card per Trainee (by name) with the actions inline. The name opens
 * the Trainee's Assessments page, where the same proposals sit in the Goals
 * card.
 */
export function ProposalQueue({ proposals, emptyText }: ProposalQueueProps) {
  const groups = groupByTrainee(proposals);
  if (groups.length === 0) return <p className="py-12 text-center text-muted-foreground">{emptyText}</p>;

  return (
    <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {groups.map((group) => {
        const details = [
          ...group.branchNames,
          ...(group.assessmentDate ? [`מבדק מ-${shortDate(group.assessmentDate)}`] : []),
        ];
        return (
          <li key={group.traineeId} className="min-w-0 space-y-3 rounded-xl border bg-muted/30 p-3 sm:p-4">
            <div className="space-y-0.5">
              <Link
                href={`/admin/assessments/${group.traineeId}`}
                className="font-bold underline-offset-4 hover:underline focus-visible:underline"
              >
                {group.fullName}
              </Link>
              {details.length > 0 && <p className="text-xs text-muted-foreground">{details.join(" · ")}</p>}
            </div>
            {group.proposals.map((proposal) => (
              <ProposalCard key={proposal.id} proposal={proposal} />
            ))}
          </li>
        );
      })}
    </ul>
  );
}
