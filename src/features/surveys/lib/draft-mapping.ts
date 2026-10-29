import { isChoiceKind } from "./draft";
import type { DraftQuestion, QuestionKind, SurveyDraft, SurveyQuestion, SurveyRecord } from "./types";

/** One Question in the shape save_survey_draft reads from its jsonb argument. */
export type QuestionPayload = {
  kind: QuestionKind;
  prompt: string;
  required: boolean;
  low_label: string | null;
  high_label: string | null;
  options: string[];
};

/** The Questions a draft saves, in order. Only choice Questions carry options. */
export function toQuestionsPayload(questions: readonly DraftQuestion[]): QuestionPayload[] {
  return questions.map((question) => ({
    kind: question.kind,
    prompt: question.text.trim(),
    required: question.required,
    low_label: question.lowLabel,
    high_label: question.highLabel,
    options: isChoiceKind(question.kind) ? question.options.map((option) => option.trim()) : [],
  }));
}

/** A stored Survey as the publish rules read it. */
export function toDraft(record: SurveyRecord, questions: readonly SurveyQuestion[]): SurveyDraft {
  return {
    title: record.title,
    intro: record.intro,
    opensOn: record.opensOn,
    closesOn: record.closesOn,
    birthYears: [...record.birthYears],
    branchIds: [...record.branchIds],
    questions: questions.map((question) => ({
      kind: question.kind,
      text: question.text,
      required: question.required,
      lowLabel: question.lowLabel,
      highLabel: question.highLabel,
      options: question.options.map((option) => option.label),
    })),
  };
}
