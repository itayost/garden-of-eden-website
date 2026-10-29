/**
 * The Trainee's answers while the popup is open, as an immutable map from a
 * Question's id to what they gave. Pure: every update returns a new map.
 * Half-filled answers live only in component state and are never saved.
 */
import { hasValue } from "./answers";
import type { AnswerInput, SurveyQuestion } from "./types";

export type AnswerMap = Readonly<Record<string, AnswerInput>>;

/** Single choice: the one option replaces whatever was chosen before. */
export function chooseOne(map: AnswerMap, questionId: string, optionId: string): AnswerMap {
  return { ...map, [questionId]: { questionId, optionIds: [optionId] } };
}

/** Multiple choice: add the option, or take it off when it is already chosen. */
export function toggleOption(map: AnswerMap, questionId: string, optionId: string): AnswerMap {
  const chosen = map[questionId]?.optionIds ?? [];
  const optionIds = chosen.includes(optionId)
    ? chosen.filter((id) => id !== optionId)
    : [...chosen, optionId];
  return { ...map, [questionId]: { questionId, optionIds } };
}

export function rate(map: AnswerMap, questionId: string, rating: number): AnswerMap {
  return { ...map, [questionId]: { questionId, rating } };
}

export function writeText(map: AnswerMap, questionId: string, text: string): AnswerMap {
  return { ...map, [questionId]: { questionId, text } };
}

/** Whether "next" may be pressed: an optional Question can be passed, a required one needs a value. */
export function canContinue(question: SurveyQuestion, answer: AnswerInput | undefined): boolean {
  if (!question.required) return true;
  return answer !== undefined && hasValue(question, answer);
}

function toSendable(question: SurveyQuestion, answer: AnswerInput): AnswerInput {
  const { id: questionId } = question;
  switch (question.kind) {
    case "rating":
      return { questionId, rating: answer.rating };
    case "text":
      return { questionId, text: (answer.text ?? "").trim() };
    case "single_choice":
    case "multi_choice": {
      const chosen = new Set(answer.optionIds ?? []);
      const optionIds = question.options.map((o) => o.id).filter((id) => chosen.has(id));
      return { questionId, optionIds };
    }
  }
}

/**
 * What goes to the server: one entry per answered Question, in the Questions'
 * order. Unanswered optional Questions, blank text, answers to Questions that
 * are not in the list and options no longer on a Question are left out.
 */
export function answersToSend(
  questions: readonly SurveyQuestion[],
  map: AnswerMap,
): AnswerInput[] {
  return questions.flatMap((question) => {
    const answer = map[question.id];
    return answer !== undefined && hasValue(question, answer) ? [toSendable(question, answer)] : [];
  });
}
