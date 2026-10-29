import {
  SURVEY_LIMITS,
  type AnswerInput,
  type AnswerRow,
  type SurveyQuestion,
} from "./types";

/** Shown when the Questions changed while the Trainee was answering. */
const SURVEY_CHANGED_MESSAGE = "הסקר עודכן בינתיים. סגרו אותו ופתחו שוב.";
export const SUBMIT_FAILED_MESSAGE = "השליחה נכשלה. נסו שוב.";
const CHOICE_INVALID_MESSAGE = "בחירה לא תקינה";
const RATING_RANGE_MESSAGE = `דירוג חייב להיות בין ${SURVEY_LIMITS.ratingMin} ל-${SURVEY_LIMITS.ratingMax}`;
const TEXT_TOO_LONG_MESSAGE = `התשובה ארוכה מ-${SURVEY_LIMITS.textAnswerMax} תווים`;

/**
 * Postgres raises these texts; they arrive wrapped in longer messages. The
 * last three are one failure: an answer whose option is not its Question's own
 * trips the deferred composite foreign key at commit, which only happens when
 * the Questions were swapped under the Trainee.
 */
const SUBMIT_ERRORS: readonly { readonly code: string; readonly message: string }[] = [
  { code: "already_answered", message: "כבר ענית על הסקר הזה" },
  { code: "survey_not_open", message: "הסקר כבר נסגר" },
  { code: "not_in_audience", message: "הסקר לא מיועד לך" },
  { code: "survey_changed", message: SURVEY_CHANGED_MESSAGE },
  { code: "survey_answers_option_of_question", message: SURVEY_CHANGED_MESSAGE },
  { code: "foreign key", message: SURVEY_CHANGED_MESSAGE },
  { code: "23503", message: SURVEY_CHANGED_MESSAGE },
];

function trimmedText(answer: AnswerInput): string {
  return (answer.text ?? "").trim();
}

function chosenOptionIds(answer: AnswerInput): readonly string[] {
  return answer.optionIds ?? [];
}

/** Whether the answer gives a value for the Question's kind. Blank text and no choice are no value. */
function hasValue(question: SurveyQuestion, answer: AnswerInput): boolean {
  switch (question.kind) {
    case "rating":
      return answer.rating !== undefined;
    case "text":
      return trimmedText(answer) !== "";
    case "single_choice":
    case "multi_choice":
      return chosenOptionIds(answer).length > 0;
  }
}

/** Single choice takes exactly one option; multiple choice takes distinct ones. Both must belong to the Question. */
function isValidChoice(question: SurveyQuestion, optionIds: readonly string[]): boolean {
  const ownIds = new Set(question.options.map((option) => option.id));
  const distinct = new Set(optionIds).size === optionIds.length;
  const allOwn = optionIds.every((id) => ownIds.has(id));
  const countFits = question.kind !== "single_choice" || optionIds.length === 1;
  return distinct && allOwn && countFits;
}

function valueProblem(question: SurveyQuestion, answer: AnswerInput): string | null {
  switch (question.kind) {
    case "rating": {
      const rating = answer.rating;
      const isWhole = rating !== undefined && Number.isInteger(rating);
      const inRange =
        isWhole && rating >= SURVEY_LIMITS.ratingMin && rating <= SURVEY_LIMITS.ratingMax;
      return inRange ? null : RATING_RANGE_MESSAGE;
    }
    case "text":
      return trimmedText(answer).length > SURVEY_LIMITS.textAnswerMax
        ? TEXT_TOO_LONG_MESSAGE
        : null;
    case "single_choice":
    case "multi_choice":
      return isValidChoice(question, chosenOptionIds(answer)) ? null : CHOICE_INVALID_MESSAGE;
  }
}

/** The first problem with one Question, prefixed with its 1-based number. */
function questionProblem(
  question: SurveyQuestion,
  number: number,
  answers: readonly AnswerInput[],
): string | null {
  const given = answers.filter((answer) => answer.questionId === question.id);
  if (given.length > 1) return `שאלה ${number}: נענתה פעמיים`;

  const [answer] = given;
  if (answer === undefined || !hasValue(question, answer)) {
    return question.required ? `נא לענות על שאלה ${number}` : null;
  }
  const problem = valueProblem(question, answer);
  return problem === null ? null : `שאלה ${number}: ${problem}`;
}

/**
 * The first problem with a Trainee's answers, or null when they can be saved.
 * An answer to a Question that no longer exists means the Survey changed, and
 * is reported before any Question-order problem. Otherwise problems are
 * reported in Question order.
 */
export function answersProblem(
  questions: readonly SurveyQuestion[],
  answers: readonly AnswerInput[],
): string | null {
  const knownIds = new Set(questions.map((question) => question.id));
  if (answers.some((answer) => !knownIds.has(answer.questionId))) {
    return SURVEY_CHANGED_MESSAGE;
  }
  for (const [index, question] of questions.entries()) {
    const problem = questionProblem(question, index + 1, answers);
    if (problem !== null) return problem;
  }
  return null;
}

/** One row per chosen option; blank optional text and unanswered optional Questions produce none. */
function rowsFor(question: SurveyQuestion, answer: AnswerInput): AnswerRow[] {
  if (!hasValue(question, answer)) return [];
  const { id: questionId } = question;
  switch (question.kind) {
    case "rating":
      return [{ questionId, optionId: null, rating: answer.rating ?? null, text: null }];
    case "text":
      return [{ questionId, optionId: null, rating: null, text: trimmedText(answer) }];
    case "single_choice":
    case "multi_choice":
      return chosenOptionIds(answer).map((optionId) => ({
        questionId,
        optionId,
        rating: null,
        text: null,
      }));
  }
}

/** Call only after answersProblem returned null. */
export function toAnswerRows(
  questions: readonly SurveyQuestion[],
  answers: readonly AnswerInput[],
): AnswerRow[] {
  return questions.flatMap((question) =>
    answers
      .filter((answer) => answer.questionId === question.id)
      .flatMap((answer) => rowsFor(question, answer)),
  );
}

/**
 * The Hebrew message for a failed submit. Postgres texts are matched with
 * includes; pass the error's message together with its code, so a foreign-key
 * failure is recognised by SQLSTATE even when the message is reworded.
 */
export function submitErrorMessage(dbMessage: string): string {
  const known = SUBMIT_ERRORS.find(({ code }) => dbMessage.includes(code));
  return known?.message ?? SUBMIT_FAILED_MESSAGE;
}
