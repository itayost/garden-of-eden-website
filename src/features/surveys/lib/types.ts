export const QUESTION_KINDS = ["single_choice", "multi_choice", "rating", "text"] as const;

export type QuestionKind = (typeof QUESTION_KINDS)[number];

export interface SurveyOption {
  id: string;
  label: string;
}

export interface SurveyQuestion {
  id: string;
  kind: QuestionKind;
  text: string;
  required: boolean;
  lowLabel: string | null;
  highLabel: string | null;
  options: readonly SurveyOption[];
}

export interface SurveyRecord {
  id: string;
  title: string;
  intro: string | null;
  opensOn: string;
  closesOn: string | null;
  birthYears: readonly number[];
  branchIds: readonly string[];
  createdBy: string;
  createdAt: string;
  publishedAt: string | null;
  closedAt: string | null;
}

export type SurveyState = "draft" | "scheduled" | "open" | "ended";

export interface SurveyViewer {
  userId: string;
  role: string;
  managedBranchIds: readonly string[];
}

export interface DraftQuestion {
  kind: QuestionKind;
  text: string;
  required: boolean;
  lowLabel: string | null;
  highLabel: string | null;
  options: string[];
}

export interface SurveyDraft {
  title: string;
  intro: string | null;
  opensOn: string;
  closesOn: string | null;
  birthYears: number[];
  branchIds: string[];
  questions: DraftQuestion[];
}

export interface AnswerInput {
  questionId: string;
  optionIds?: string[];
  rating?: number;
  text?: string;
}

export interface AnswerRow {
  questionId: string;
  optionId: string | null;
  rating: number | null;
  text: string | null;
}

/** What the trainee popup and the builder preview render. */
export interface OfferableSurvey {
  id: string;
  title: string;
  intro: string | null;
  closesOn: string | null;
  publishedAt: string;
  questions: SurveyQuestion[];
}

export const SURVEY_LIMITS = {
  titleMin: 2,
  titleMax: 120,
  introMax: 500,
  questionsMax: 20,
  questionTextMin: 2,
  questionTextMax: 300,
  optionsMin: 2,
  optionsMax: 10,
  optionMax: 100,
  labelMax: 40,
  textAnswerMax: 1000,
  ratingMin: 1,
  ratingMax: 5,
} as const;

export const SURVEY_PAGE_SIZE = 20;
