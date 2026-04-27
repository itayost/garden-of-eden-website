import { z } from "zod";

const MAX_TEXT = 2000;
const optionalText = z.string().max(MAX_TEXT).optional();

/** Achievement categories a trainee can excel in */
export const ACHIEVEMENT_CATEGORIES = [
  "כוח מתפרץ",
  "חשיבה מהירה",
  "קואורדינציה",
  "זריזות",
  "מהירות",
  "כוח רגליים",
  "כוח פלג גוף עליון",
  "יציאה מהמקום",
  "טכניקת ריצה",
  "יציבות",
  "גמישות",
  "ניתור",
  "כדרור",
] as const;

export type AchievementCategory = (typeof ACHIEVEMENT_CATEGORIES)[number];

/** Per-trainee entry. `categories` is set for sections with a category
 * taxonomy (achievements, worked-on focus); for details-only sections it
 * is omitted. */
const perTraineeEntry = z.object({
  details: z.string().max(MAX_TEXT).optional(),
  categories: z.array(z.enum(ACHIEVEMENT_CATEGORIES)).optional(),
});

export const shiftReportSchema = z.object({
  report_date: z.string().min(1, "נא לבחור תאריך").refine(
    (date) => new Date(date) <= new Date(),
    { message: "לא ניתן לבחור תאריך עתידי" }
  ),

  // Step 1: Basic Info
  trained_new_trainees: z.boolean(),
  new_trainees_ids: z.array(z.string()),
  new_trainees_details: optionalText,
  new_trainees_per_trainee: z.record(z.string(), perTraineeEntry).optional(),

  // Step 2: Trainee Issues
  has_discipline_issues: z.boolean(),
  discipline_trainee_ids: z.array(z.string()),
  discipline_details: optionalText,
  discipline_per_trainee: z.record(z.string(), perTraineeEntry).optional(),

  has_injuries: z.boolean(),
  injuries_trainee_ids: z.array(z.string()),
  injuries_details: optionalText,
  injuries_per_trainee: z.record(z.string(), perTraineeEntry).optional(),

  has_physical_limitations: z.boolean(),
  limitations_trainee_ids: z.array(z.string()),
  limitations_details: optionalText,
  limitations_per_trainee: z.record(z.string(), perTraineeEntry).optional(),

  // Step 2b: Trainer focus per trainee (what was worked on)
  has_worked_on_focus: z.boolean(),
  worked_on_trainee_ids: z.array(z.string()),
  worked_on_details: optionalText,
  worked_on_per_trainee: z.record(z.string(), perTraineeEntry).optional(),

  // Step 3: Trainee Positives & Wellbeing
  has_achievements: z.boolean(),
  achievements_trainee_ids: z.array(z.string()),
  achievements_details: optionalText,
  achievements_per_trainee: z.record(z.string(), perTraineeEntry).optional(),

  has_poor_mental_state: z.boolean(),
  mental_state_trainee_ids: z.array(z.string()),
  mental_state_details: optionalText,
  mental_state_per_trainee: z.record(z.string(), perTraineeEntry).optional(),

  has_complaints: z.boolean(),
  complaints_trainee_ids: z.array(z.string()),
  complaints_details: optionalText,
  complaints_per_trainee: z.record(z.string(), perTraineeEntry).optional(),

  has_insufficient_attention: z.boolean(),
  insufficient_attention_trainee_ids: z.array(z.string()),
  insufficient_attention_details: optionalText,
  insufficient_attention_per_trainee: z.record(z.string(), perTraineeEntry).optional(),

  has_pro_candidates: z.boolean(),
  pro_candidates_trainee_ids: z.array(z.string()),
  pro_candidates_details: optionalText,
  pro_candidates_per_trainee: z.record(z.string(), perTraineeEntry).optional(),

  has_social_skills: z.boolean(),
  social_skills_trainee_ids: z.array(z.string()),
  social_skills_details: optionalText,
  social_skills_per_trainee: z.record(z.string(), perTraineeEntry).optional(),

  // Step 4: Parents & Visitors
  has_parent_seeking_staff: z.boolean(),
  parent_seeking_details: optionalText,

  has_external_visitors: z.boolean(),
  external_visitors_details: optionalText,

  has_parent_complaints: z.boolean(),
  parent_complaints_details: optionalText,

  // Step 5: Facility
  facility_left_clean: z.boolean(),
  facility_not_clean_reason: optionalText,

  facility_cleaned_scheduled: z.boolean(),
  facility_not_cleaned_reason: optionalText,
});

export type ShiftReportFormData = z.infer<typeof shiftReportSchema>;

export const DEFAULT_SHIFT_REPORT: ShiftReportFormData = {
  report_date: new Date().toISOString().split("T")[0],
  trained_new_trainees: false,
  new_trainees_ids: [],
  new_trainees_details: "",
  new_trainees_per_trainee: {},
  has_discipline_issues: false,
  discipline_trainee_ids: [],
  discipline_details: "",
  discipline_per_trainee: {},
  has_injuries: false,
  injuries_trainee_ids: [],
  injuries_details: "",
  injuries_per_trainee: {},
  has_physical_limitations: false,
  limitations_trainee_ids: [],
  limitations_details: "",
  limitations_per_trainee: {},
  has_worked_on_focus: false,
  worked_on_trainee_ids: [],
  worked_on_details: "",
  worked_on_per_trainee: {},
  has_achievements: false,
  achievements_trainee_ids: [],
  achievements_details: "",
  achievements_per_trainee: {},
  has_poor_mental_state: false,
  mental_state_trainee_ids: [],
  mental_state_details: "",
  mental_state_per_trainee: {},
  has_complaints: false,
  complaints_trainee_ids: [],
  complaints_details: "",
  complaints_per_trainee: {},
  has_insufficient_attention: false,
  insufficient_attention_trainee_ids: [],
  insufficient_attention_details: "",
  insufficient_attention_per_trainee: {},
  has_pro_candidates: false,
  pro_candidates_trainee_ids: [],
  pro_candidates_details: "",
  pro_candidates_per_trainee: {},
  has_social_skills: false,
  social_skills_trainee_ids: [],
  social_skills_details: "",
  social_skills_per_trainee: {},
  has_parent_seeking_staff: false,
  parent_seeking_details: "",
  has_external_visitors: false,
  external_visitors_details: "",
  has_parent_complaints: false,
  parent_complaints_details: "",
  facility_left_clean: true,
  facility_not_clean_reason: "",
  facility_cleaned_scheduled: true,
  facility_not_cleaned_reason: "",
};
