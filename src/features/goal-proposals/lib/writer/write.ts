/**
 * Writes the Goal proposals of one Assessment with one direct request, with
 * server-side fallbacks, through the report writer's directReply(). A few
 * Assessments a night, so no batch.
 */
import "server-only";

import type Anthropic from "@anthropic-ai/sdk";
import { apiFailure } from "@/features/weekly-reports/lib/writer/client";
import { directReply } from "@/features/weekly-reports/lib/writer/direct";
import type { WriterModel } from "@/features/weekly-reports/lib/writer/request";
import { proposalOutcome, type ProposalOutcome } from "./output";
import { proposalParams, type ProposalInput } from "./request";

/**
 * The model's picks, or why there are none. A refusal of the whole fallback
 * chain, a reply cut short, an unparsable reply or a failed call give
 * `{ ok: false, reason }`; the failure is logged with its status and type,
 * never with the request. Never throws.
 */
export async function writeProposal(client: Anthropic, input: ProposalInput, model: WriterModel): Promise<ProposalOutcome> {
  try {
    return proposalOutcome(await directReply(client, proposalParams(input, model)));
  } catch (error) {
    return { ok: false, reason: apiFailure("goal proposal", error).message };
  }
}
