import { isChoiceKind } from "./draft";
import { SHARED_MESSAGES } from "./messages";
import { SURVEY_LIMITS, type DraftQuestion, type SurveyDraft } from "./types";

function problemIf(condition: boolean, message: string): string[] {
  return condition ? [message] : [];
}

function hasDuplicates(values: readonly string[]): boolean {
  return new Set(values).size !== values.length;
}

function titleProblems(title: string): string[] {
  const length = title.trim().length;
  const inRange =
    length >= SURVEY_LIMITS.titleMin && length <= SURVEY_LIMITS.titleMax;
  return problemIf(
    !inRange,
    `צריך כותרת של ${SURVEY_LIMITS.titleMin} עד ${SURVEY_LIMITS.titleMax} תווים`,
  );
}

function introProblems(intro: string | null): string[] {
  const tooLong = intro !== null && intro.trim().length > SURVEY_LIMITS.introMax;
  return problemIf(tooLong, `הפתיח ארוך מ-${SURVEY_LIMITS.introMax} תווים`);
}

function branchProblems(branchIds: readonly string[]): string[] {
  return problemIf(branchIds.length === 0, SHARED_MESSAGES.noBranch);
}

function questionCountProblems(count: number): string[] {
  const tooMany = count > SURVEY_LIMITS.questionsMax;
  return [
    ...problemIf(count === 0, "צריך לפחות שאלה אחת"),
    ...problemIf(tooMany, `אפשר עד ${SURVEY_LIMITS.questionsMax} שאלות`),
  ];
}

function questionTextProblems(text: string): string[] {
  const length = text.trim().length;
  const inRange =
    length >= SURVEY_LIMITS.questionTextMin && length <= SURVEY_LIMITS.questionTextMax;
  return problemIf(
    !inRange,
    `צריך טקסט של ${SURVEY_LIMITS.questionTextMin} עד ${SURVEY_LIMITS.questionTextMax} תווים`,
  );
}

function optionCountProblems(count: number): string[] {
  const inRange =
    count >= SURVEY_LIMITS.optionsMin && count <= SURVEY_LIMITS.optionsMax;
  return problemIf(
    !inRange,
    `צריך ${SURVEY_LIMITS.optionsMin} עד ${SURVEY_LIMITS.optionsMax} תשובות`,
  );
}

/**
 * Empty options are reported once and left out of the duplicate check, so two
 * blank options never read as the same answer.
 */
function optionProblems(options: readonly string[]): string[] {
  const trimmed = options.map((option) => option.trim());
  const filled = trimmed.filter((option) => option.length > 0);
  return [
    ...optionCountProblems(options.length),
    ...problemIf(filled.length < trimmed.length, "תשובה ריקה"),
    ...problemIf(
      filled.some((option) => option.length > SURVEY_LIMITS.optionMax),
      `תשובה ארוכה מ-${SURVEY_LIMITS.optionMax} תווים`,
    ),
    ...problemIf(
      hasDuplicates(filled.map((option) => option.toLowerCase())),
      "אותה תשובה מופיעה פעמיים",
    ),
  ];
}

function labelProblems(question: DraftQuestion): string[] {
  const tooLong = [question.lowLabel, question.highLabel].some(
    (label) => label !== null && label.trim().length > SURVEY_LIMITS.labelMax,
  );
  return problemIf(tooLong, `תווית ארוכה מ-${SURVEY_LIMITS.labelMax} תווים`);
}

/** Problems with one Question, prefixed with its 1-based number. */
function questionProblems(question: DraftQuestion, number: number): string[] {
  const problems = [
    ...questionTextProblems(question.text),
    ...(isChoiceKind(question.kind) ? optionProblems(question.options) : []),
    ...labelProblems(question),
  ];
  return problems.map((problem) => `שאלה ${number}: ${problem}`);
}

function dateProblems(draft: SurveyDraft, today: string): string[] {
  const { opensOn, closesOn } = draft;
  if (closesOn === null) return [];
  return [
    ...problemIf(closesOn < opensOn, SHARED_MESSAGES.closeBeforeOpen),
    ...problemIf(closesOn < today, SHARED_MESSAGES.closeDatePassed),
  ];
}

/** The publish problems by the part of the form they belong to, each in form order. */
export interface PublishProblemGroups {
  /** Title, intro and audience. */
  basics: string[];
  /** The number of Questions and each Question. */
  questions: string[];
  dates: string[];
}

/**
 * What stops a Survey from being published, grouped for a checklist. Empty
 * groups are parts that pass. publishProblem() is these groups, in this order.
 */
export function publishProblemGroups(draft: SurveyDraft, today: string): PublishProblemGroups {
  return {
    basics: [
      ...titleProblems(draft.title),
      ...introProblems(draft.intro),
      ...branchProblems(draft.branchIds),
    ],
    questions: [
      ...questionCountProblems(draft.questions.length),
      ...draft.questions.flatMap((question, index) => questionProblems(question, index + 1)),
    ],
    dates: dateProblems(draft, today),
  };
}

/**
 * The problems that stop a Survey from being published, in form order. An
 * empty list means it is ready. Saving a draft is looser; see
 * surveyDraftSchema in src/lib/validations/surveys.ts.
 *
 * Days are Israel calendar dates in YYYY-MM-DD form, so string comparison
 * orders them. Pass `today` from israelToday().
 */
export function publishProblem(draft: SurveyDraft, today: string): string[] {
  const groups = publishProblemGroups(draft, today);
  return [...groups.basics, ...groups.questions, ...groups.dates];
}
