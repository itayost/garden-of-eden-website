/**
 * The builder's working copy of a draft: the same fields, plus a key on every
 * Question and every option so a list keeps each row's identity while rows
 * are added, removed and moved (an index would hand a row's state to its
 * neighbour). The keys never reach the server; toSurveyDraft() drops them.
 */
import { changeKind, emptyQuestion, keepsOptions } from "./draft";
import type { DraftQuestion, QuestionKind, SurveyDraft } from "./types";

export interface EditorOption {
  key: string;
  label: string;
}

export interface EditorQuestion {
  key: string;
  kind: QuestionKind;
  text: string;
  required: boolean;
  lowLabel: string | null;
  highLabel: string | null;
  options: EditorOption[];
}

export type EditorForm = Omit<SurveyDraft, "questions"> & { questions: EditorQuestion[] };

type MakeKey = () => string;

const randomKey: MakeKey = () => crypto.randomUUID();

const keyedOptions = (labels: readonly string[], makeKey: MakeKey): EditorOption[] =>
  labels.map((label) => ({ key: makeKey(), label }));

export function blankOption(makeKey: MakeKey = randomKey): EditorOption {
  return { key: makeKey(), label: "" };
}

export function toEditorQuestion(question: DraftQuestion, makeKey: MakeKey = randomKey): EditorQuestion {
  const key = makeKey();
  return { ...question, key, options: keyedOptions(question.options, makeKey) };
}

function toDraftQuestion(question: EditorQuestion): DraftQuestion {
  return {
    kind: question.kind,
    text: question.text,
    required: question.required,
    lowLabel: question.lowLabel,
    highLabel: question.highLabel,
    options: question.options.map((option) => option.label),
  };
}

export function toEditorForm(draft: SurveyDraft, makeKey: MakeKey = randomKey): EditorForm {
  return {
    ...draft,
    questions: draft.questions.map((question) => toEditorQuestion(question, makeKey)),
  };
}

export function toSurveyDraft(form: EditorForm): SurveyDraft {
  return { ...form, questions: form.questions.map(toDraftQuestion) };
}

export function newEditorQuestion(kind: QuestionKind, makeKey: MakeKey = randomKey): EditorQuestion {
  return toEditorQuestion(emptyQuestion(kind), makeKey);
}

/**
 * The Question as another kind, keeping its key. Options and their keys stay
 * between the two choice kinds; any other change starts from changeKind().
 */
export function withKind(
  question: EditorQuestion,
  kind: QuestionKind,
  makeKey: MakeKey = randomKey,
): EditorQuestion {
  const next = changeKind(toDraftQuestion(question), kind);
  return {
    ...next,
    key: question.key,
    options: keepsOptions(question.kind, kind) ? question.options : keyedOptions(next.options, makeKey),
  };
}
