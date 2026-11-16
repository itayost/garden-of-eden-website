/**
 * The one request the Goal proposal writer sends per Assessment. Pure.
 *
 * The goal guide is the same in every request, so it is the cached prefix
 * (it may fall under the minimum cacheable prefix; the breakpoint is harmless
 * and keeps the shape of the report writer). The input is the only thing
 * that changes. Thinking is adaptive and the effort is set explicitly, as in
 * the report writer's writerParams().
 *
 * The input is built field by field, so nothing the caller passes along (a
 * Trainee id, an Assessment id, a name) ever reaches the model: only the age
 * group, the position and the candidates' facts, whose only ids are the
 * drills'.
 */
import type Anthropic from "@anthropic-ai/sdk";
import type { WriterModel } from "@/features/weekly-reports/lib/writer/request";
import type { CandidateFacts } from "../candidates";
import { GOAL_GUIDE } from "./guide";
import { PROPOSAL_JSON_SCHEMA } from "./output";

/** Room for the thinking and three short lines; well inside a non-streaming request. */
const MAX_TOKENS = 16000;

/** What the model knows of the Trainee: no name, no gender, no id. */
export interface ProposalPlayer {
  ageGroup: string | null;
  position: string | null;
}

export interface ProposalInput {
  player: ProposalPlayer;
  candidates: CandidateFacts[];
}

/** One candidate with exactly the fields of CandidateFacts, and fresh arrays. */
function candidateCopy(candidate: CandidateFacts): CandidateFacts {
  return {
    metric_key: candidate.metric_key,
    metric: candidate.metric,
    unit: candidate.unit,
    direction: candidate.direction,
    value: candidate.value,
    benchmark: candidate.benchmark,
    betterThanPercent: candidate.betterThanPercent,
    groupSize: candidate.groupSize,
    step: candidate.step,
    target: candidate.target,
    basis: candidate.basis,
    positionFit: candidate.positionFit,
    drills: candidate.drills.map(({ id, name, why, parameter }) => ({ id, name, why, parameter })),
  };
}

/** The user message's content: the player's age group and position, and the candidates. */
export function proposalInput(player: ProposalPlayer, candidates: readonly CandidateFacts[]): ProposalInput {
  return {
    player: { ageGroup: player.ageGroup, position: player.position },
    candidates: candidates.map(candidateCopy),
  };
}

export function proposalParams(input: ProposalInput, model: WriterModel): Anthropic.MessageCreateParamsNonStreaming {
  return {
    model,
    max_tokens: MAX_TOKENS,
    thinking: { type: "adaptive" },
    system: [{ type: "text", text: GOAL_GUIDE, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: `המועמדים ליעדים אחרי המבדק:\n${JSON.stringify(input, null, 2)}` }],
    output_config: { effort: "medium", format: { type: "json_schema", schema: PROPOSAL_JSON_SCHEMA } },
  };
}
