/**
 * Pure helpers for the Survey builder: the shape of a new draft and Question,
 * moving an item in a list, switching a Question's kind, and the draft as the
 * trainee popup reads it. Nothing here mutates what it is given.
 */
import type { DraftQuestion, OfferableSurvey, QuestionKind, SurveyDraft, SurveyQuestion } from "./types";

/** The id the preview carries; no Survey with it exists. */
const PREVIEW_SURVEY_ID = "preview";

/** A preview is never published; the popup only passes this along. */
const PREVIEW_PUBLISHED_AT = new Date(0).toISOString();

const BLANK_OPTIONS = 2;

export function isChoiceKind(kind: QuestionKind): boolean {
  return kind === "single_choice" || kind === "multi_choice";
}

const blankOptions = (): string[] => Array.from({ length: BLANK_OPTIONS }, () => "");

const inRange = (index: number, length: number): boolean =>
  Number.isInteger(index) && index >= 0 && index < length;

/**
 * A copy of `items` with the item at `from` moved to `to`. When nothing would
 * move (the same place, or an index outside the list) the very same array comes
 * back, so a caller can tell nothing changed. The caller never mutates it.
 */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  if (from === to || !inRange(from, items.length) || !inRange(to, items.length)) {
    return items as T[];
  }
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/** A blank Question of one kind: choice kinds start with two empty options. */
export function emptyQuestion(kind: QuestionKind): DraftQuestion {
  return {
    kind,
    text: "",
    required: true,
    lowLabel: null,
    highLabel: null,
    options: isChoiceKind(kind) ? blankOptions() : [],
  };
}

/**
 * The same Question as another kind. Options stay between the two choice
 * kinds and are cleared for a rating or text; a choice kind reached from
 * those starts with two blank options. The end labels belong to a rating only.
 */
export function changeKind(question: DraftQuestion, kind: QuestionKind): DraftQuestion {
  const isRating = kind === "rating";
  const keepsOptions = isChoiceKind(kind) && isChoiceKind(question.kind);
  const options = isChoiceKind(kind) ? (keepsOptions ? [...question.options] : blankOptions()) : [];
  return {
    ...question,
    kind,
    lowLabel: isRating ? question.lowLabel : null,
    highLabel: isRating ? question.highLabel : null,
    options,
  };
}

/** A draft with nothing in it, opening today and never closing by date. */
export function newDraft(today: string): SurveyDraft {
  return {
    title: "",
    intro: null,
    opensOn: today,
    closesOn: null,
    birthYears: [],
    branchIds: [],
    questions: [],
  };
}

function previewQuestion(question: DraftQuestion, index: number): SurveyQuestion {
  const choices = isChoiceKind(question.kind) ? question.options : [];
  return {
    id: `preview-q${index}`,
    kind: question.kind,
    text: question.text.trim(),
    required: question.required,
    lowLabel: question.lowLabel,
    highLabel: question.highLabel,
    options: choices.map((label, optionIndex) => ({
      id: `preview-q${index}-o${optionIndex}`,
      label: label.trim(),
    })),
  };
}

/** The draft as the trainee popup renders it, with temporary ids. */
export function previewSurvey(draft: SurveyDraft): OfferableSurvey {
  const intro = draft.intro?.trim() ?? "";
  return {
    id: PREVIEW_SURVEY_ID,
    title: draft.title.trim(),
    intro: intro === "" ? null : intro,
    closesOn: draft.closesOn,
    publishedAt: PREVIEW_PUBLISHED_AT,
    questions: draft.questions.map(previewQuestion),
  };
}
