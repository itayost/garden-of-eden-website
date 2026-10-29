import { z } from "zod";

import { QUESTION_KINDS, SURVEY_LIMITS } from "@/features/surveys/lib/types";
import { isValidDateString, UUID_REGEX } from "@/lib/validations/common";

const {
  titleMin,
  titleMax,
  introMax,
  questionsMax,
  questionTextMax,
  optionsMax,
  optionMax,
  labelMax,
  textAnswerMax,
} = SURVEY_LIMITS;

/** Birth years an Audience can name; a year outside this range matches nobody. */
const BIRTH_YEAR_MIN = 1990;
const BIRTH_YEAR_MAX = 2030;
/** Branches one Survey can be offered at. */
const BRANCHES_MAX = 10;

const RANGE_BIRTH_YEAR = `שנת לידה חייבת להיות בין ${BIRTH_YEAR_MIN} ל-${BIRTH_YEAR_MAX}`;

/** The limit in brackets, appended to a "too long" message. */
const maxChars = (max: number) => `(מקסימום ${max} תווים)`;

const uuidSchema = z.string().regex(UUID_REGEX, "מזהה לא תקין");

const dateSchema = z.string().refine(isValidDateString, "תאריך לא תקין");

const titleSchema = z
  .string()
  .trim()
  .min(titleMin, `הכותרת קצרה מדי (מינימום ${titleMin} תווים)`)
  .max(titleMax, `הכותרת ארוכה מדי ${maxChars(titleMax)}`);

/** Blank text is stored as null, so an intro or label left empty reads as absent. */
function optionalText(max: number, message: string) {
  return z
    .string()
    .trim()
    .max(max, message)
    .nullable()
    .transform((value) => (value === "" ? null : value));
}

const introSchema = optionalText(introMax, `הפתיח ארוך מדי ${maxChars(introMax)}`);

const labelSchema = optionalText(labelMax, `התווית ארוכה מדי ${maxChars(labelMax)}`);

const birthYearsSchema = z
  .array(
    z
      .number()
      .int("שנת לידה חייבת להיות מספר שלם")
      .min(BIRTH_YEAR_MIN, RANGE_BIRTH_YEAR)
      .max(BIRTH_YEAR_MAX, RANGE_BIRTH_YEAR),
  )
  .refine((years) => new Set(years).size === years.length, "שנת לידה מופיעה פעמיים");

const optionSchema = z
  .string()
  .trim()
  .max(optionMax, `התשובה ארוכה מדי ${maxChars(optionMax)}`);

const draftQuestionSchema = z.object({
  kind: z.enum(QUESTION_KINDS, { error: "סוג שאלה לא תקין" }),
  text: z
    .string()
    .trim()
    .max(questionTextMax, `טקסט השאלה ארוך מדי ${maxChars(questionTextMax)}`),
  required: z.boolean(),
  lowLabel: labelSchema,
  highLabel: labelSchema,
  options: z.array(optionSchema).max(optionsMax, `אפשר עד ${optionsMax} תשובות לשאלה`),
});

/**
 * A Survey as the builder saves it. Saving is looser than publishing: a draft
 * may hold blank options, and publishProblem() in
 * src/features/surveys/lib/publish.ts says what must be fixed first.
 */
export const surveyDraftSchema = z.object({
  title: titleSchema,
  intro: introSchema,
  opensOn: dateSchema,
  closesOn: dateSchema.nullable(),
  birthYears: birthYearsSchema,
  branchIds: z.array(uuidSchema).max(BRANCHES_MAX, `אפשר לבחור עד ${BRANCHES_MAX} סניפים`),
  questions: z.array(draftQuestionSchema).max(questionsMax, `אפשר עד ${questionsMax} שאלות`),
});

/** The title, intro and close date an admin edits after publishing. */
export const surveyDetailsSchema = z.object({
  title: titleSchema,
  intro: introSchema,
  closesOn: dateSchema.nullable(),
});

const answerSchema = z.object({
  questionId: uuidSchema,
  optionIds: z
    .array(uuidSchema)
    .max(optionsMax, `אפשר לבחור עד ${optionsMax} תשובות`)
    .optional(),
  // Shape and upper bound only. Blank text is skipped and a required answer is
  // refused by answersProblem, and the 1 to 5 rating range is checked there too.
  rating: z.number().int("הדירוג חייב להיות מספר שלם").optional(),
  text: z
    .string()
    .trim()
    .max(textAnswerMax, `התשובה ארוכה מדי ${maxChars(textAnswerMax)}`)
    .optional(),
});

/** What a Trainee sends when submitting Responses. */
export const surveySubmitSchema = z.object({
  surveyId: uuidSchema,
  answers: z.array(answerSchema).max(questionsMax, `אפשר לענות עד ${questionsMax} שאלות`),
});

export type SurveyDraftInput = z.infer<typeof surveyDraftSchema>;
export type SurveyDetailsInput = z.infer<typeof surveyDetailsSchema>;
export type SurveySubmitInput = z.infer<typeof surveySubmitSchema>;
