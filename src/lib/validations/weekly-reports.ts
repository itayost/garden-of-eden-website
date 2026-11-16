import { z } from "zod";

import { reportWeekStart } from "@/features/weekly-reports/lib/report-week";
import { genderField } from "@/lib/validations/gender";
import { isValidDateString, UUID_REGEX } from "@/lib/validations/common";

/** A staff hold's reason. */
const REASON_MIN = 2;
const REASON_MAX = 200;
/** Each of the two texts, well above the 1.5 times target length the guardrails hold. */
const TEXT_MAX = 2000;
/** Birth years a branch setting can name; the database CHECK holds the same range. */
const BIRTH_YEAR_MIN = 1950;
const BIRTH_YEAR_MAX = 2030;
const BIRTH_YEARS_MAX = 30;

const RANGE_BIRTH_YEAR = `שנת לידה חייבת להיות בין ${BIRTH_YEAR_MIN} ל-${BIRTH_YEAR_MAX}`;

const reportId = z.string().regex(UUID_REGEX, "מזהה דוח לא תקין");
const branchId = z.string().regex(UUID_REGEX, "מזהה סניף לא תקין");

/**
 * The row's `updated_at` as the screen showed it. When it is sent, an action
 * refuses a row that changed since ("הדוח השתנה, רעננו את הדף"), so a person
 * never approves or holds a text they did not see.
 */
const VERSION_MAX = 64;
const version = z.string().min(1, "גרסה לא תקינה").max(VERSION_MAX, "גרסה לא תקינה").optional();

/** One report: approve, rewrite. */
export const reportIdSchema = z.object({ reportId, version });

/** "אשר את כל הממתינים": a Report week (its Friday) and the branch in view. */
export const approveAllSchema = z.object({
  weekStart: z
    .string()
    .refine((value) => isValidDateString(value) && reportWeekStart(value) === value, "שבוע לא תקין"),
  filterBranchId: branchId.optional(),
});

/** עכב, with the reason staff typed. */
export const holdSchema = z.object({
  reportId,
  version,
  reason: z
    .string()
    .trim()
    .min(REASON_MIN, `יש לכתוב סיבה (לפחות ${REASON_MIN} תווים)`)
    .max(REASON_MAX, `הסיבה ארוכה מדי (מקסימום ${REASON_MAX} תווים)`),
});

function textField(reader: string) {
  return z
    .string()
    .trim()
    .min(1, `הטקסט ${reader} ריק`)
    .max(TEXT_MAX, `הטקסט ${reader} ארוך מדי (מקסימום ${TEXT_MAX} תווים)`);
}

/** שמור שינויים: both texts as staff edited them. */
export const textsSchema = z.object({
  reportId,
  version,
  playerText: textField("לשחקן"),
  parentText: textField("להורה"),
});

/** בן / בת from the queue, for a Trainee with no gender. */
export const genderSchema = z.object({ reportId, version, gender: genderField });

/** Automatic mode is step 4; until then a branch is off or in approval. */
const modeSchema = z.enum(["off", "approval"], {
  error: (issue) => (issue.input === "automatic" ? "מצב אוטומטי ייפתח בשלב מאוחר יותר" : "מצב לא תקין"),
});

/** Null is every year; an empty list from the form means the same. */
const birthYearsSchema = z
  .array(
    z
      .number()
      .int("שנת לידה חייבת להיות מספר שלם")
      .min(BIRTH_YEAR_MIN, RANGE_BIRTH_YEAR)
      .max(BIRTH_YEAR_MAX, RANGE_BIRTH_YEAR),
  )
  .max(BIRTH_YEARS_MAX, `אפשר לבחור עד ${BIRTH_YEARS_MAX} שנות לידה`)
  .refine((years) => new Set(years).size === years.length, "שנת לידה מופיעה פעמיים")
  .nullable()
  .transform((years) => (years === null || years.length === 0 ? null : years));

/** One branch's row of the settings card. */
export const settingsSchema = z.object({
  branchId,
  mode: modeSchema,
  birthYears: birthYearsSchema,
  missedYou: z.boolean(),
});

export type ReportIdInput = z.input<typeof reportIdSchema>;
export type ApproveAllInput = z.input<typeof approveAllSchema>;
export type HoldInput = z.input<typeof holdSchema>;
export type TextsInput = z.input<typeof textsSchema>;
export type GenderInput = z.input<typeof genderSchema>;
export type SettingsInput = z.input<typeof settingsSchema>;
export type SettingsValues = z.output<typeof settingsSchema>;
