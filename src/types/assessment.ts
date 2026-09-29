// Player Assessment Types for Garden of Eden Soccer Academy

// ===========================================
// CATEGORICAL OPTIONS
// ===========================================

export type CoordinationLevel = "basic" | "advanced" | "deficient";
export type LegPowerTechnique = "normal" | "deficient";
export type BodyStructure = "thin_weak" | "good_build" | "strong_athletic";

export const COORDINATION_OPTIONS: { value: CoordinationLevel; label: string }[] = [
  { value: "advanced", label: "מתקדמת" },
  { value: "basic", label: "בסיסית" },
  { value: "deficient", label: "לקויה" },
];

export const LEG_POWER_OPTIONS: { value: LegPowerTechnique; label: string }[] = [
  { value: "normal", label: "תקין" },
  { value: "deficient", label: "לקוי" },
];

export const BODY_STRUCTURE_OPTIONS: { value: BodyStructure; label: string }[] = [
  { value: "strong_athletic", label: "חזק אתלטי" },
  { value: "good_build", label: "בני טוב" },
  { value: "thin_weak", label: "רזה חלש" },
];

// ===========================================
// AGE GROUPS
// ===========================================

export interface AgeGroup {
  id: string;
  label: string;
  labelHe: string;
  minAge: number;
  maxAge: number;
}

// "U-N" means "under N" — a player aged exactly N moves up to the next bucket.
// U10 covers ages 0-9, U12 covers 10-11, U15 covers 12-14, U18 covers 15-17, Senior is 18+.
export const AGE_GROUPS: AgeGroup[] = [
  { id: "u10", label: "U10", labelHe: "עד 10", minAge: 0, maxAge: 9 },
  { id: "u12", label: "U12", labelHe: "עד 12", minAge: 10, maxAge: 11 },
  { id: "u15", label: "U15", labelHe: "עד 15", minAge: 12, maxAge: 14 },
  { id: "u18", label: "U18", labelHe: "עד 18", minAge: 15, maxAge: 17 },
  { id: "senior", label: "Senior", labelHe: "בוגרים", minAge: 18, maxAge: 99 },
];

export function getAgeGroup(birthdate: Date | string | null): AgeGroup | null {
  if (!birthdate) return null;

  const birth = new Date(birthdate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }

  return AGE_GROUPS.find(g => age >= g.minAge && age <= g.maxAge) || AGE_GROUPS[AGE_GROUPS.length - 1];
}

// ===========================================
// ASSESSMENT INTERFACE
// ===========================================

export interface PlayerAssessment {
  id: string;
  user_id: string;
  assessment_date: string;

  // Sprint tests (seconds)
  sprint_5m: number | null;
  sprint_10m: number | null;
  sprint_20m: number | null;

  // Jump tests (cm)
  jump_2leg_distance: number | null;
  jump_right_leg: number | null;
  jump_left_leg: number | null;
  jump_2leg_height: number | null;

  // Blaze Spot (count - correct hits in 1 minute, higher is better)
  blaze_spot_time: number | null;

  // Flexibility (cm)
  flexibility_ankle: number | null;
  flexibility_knee: number | null;
  flexibility_hip: number | null;

  // Categorical
  coordination: CoordinationLevel | null;
  leg_power_technique: LegPowerTechnique | null;
  body_structure: BodyStructure | null;

  // Legacy single-foot column. New code reads right/left + machine_pct below.
  kick_power_kaiser: number | null;
  kick_power_right_foot: number | null;
  kick_power_left_foot: number | null;
  kick_power_machine_pct: number | null;

  // Dribbling tests (seconds, lower is better)
  shuffle_10m: number | null;
  sprint_10m_h: number | null;
  sprint_10m_h_ball: number | null;

  // Mental notes
  concentration_notes: string | null;
  decision_making_notes: string | null;
  work_ethic_notes: string | null;
  recovery_notes: string | null;
  nutrition_notes: string | null;

  // Metadata
  assessed_by: string | null;
  notes: string | null;
  created_at: string;
}

// ===========================================
// HEBREW LABELS
// ===========================================

export const ASSESSMENT_LABELS_HE: Record<string, string> = {
  // Sprint tests
  sprint_5m: "ספרינט 5 מטר",
  sprint_10m: "ספרינט 10 מטר",
  sprint_20m: "ספרינט 20 מטר",

  // Jump tests
  jump_2leg_distance: "ניתור למרחק 2 רגליים",
  jump_right_leg: "ניתור למרחק רגל ימין",
  jump_left_leg: "ניתור למרחק רגל שמאל",
  jump_2leg_height: "ניתור לגובה 2 רגליים",

  // Agility
  blaze_spot_time: "בלייז ספוט (חשיבה מהירה)",

  // Flexibility
  flexibility_ankle: "גמישות קרסול",
  flexibility_knee: "גמישות ברך",
  flexibility_hip: "גמישות אגן",

  // Categorical
  coordination: "קואורדינציה",
  leg_power_technique: "טכניקת כוח רגליים",
  body_structure: "מבנה גוף",

  // Kick power
  kick_power_kaiser: "עוצמת בעיטה (קייזר)",
  kick_power_right_foot: "עוצמת בעיטה - רגל ימין",
  kick_power_left_foot: "עוצמת בעיטה - רגל שמאל",
  kick_power_machine_pct: "אחוזים במכשיר",

  // Dribbling
  shuffle_10m: "צעדי רדיפה 10 מטר",
  sprint_10m_h: "ספרינט 10 מטר צורת ח",
  sprint_10m_h_ball: "ספרינט 10 מטר צורת ח עם כדור",

  // Mental notes
  concentration_notes: "ריכוז",
  decision_making_notes: "קבלת החלטות",
  work_ethic_notes: "מוסר עבודה",
  recovery_notes: "התאוששות",
  nutrition_notes: "תזונה",

  // Other
  notes: "הערות כלליות",
  assessment_date: "תאריך מבדק",
};

// Units for display
export const ASSESSMENT_UNITS: Record<string, string> = {
  sprint_5m: "שניות",
  sprint_10m: "שניות",
  sprint_20m: "שניות",
  jump_2leg_distance: 'ס"מ',
  jump_right_leg: 'ס"מ',
  jump_left_leg: 'ס"מ',
  jump_2leg_height: 'ס"מ',
  blaze_spot_time: "פגיעות",
  flexibility_ankle: 'ס"מ',
  flexibility_knee: 'ס"מ',
  flexibility_hip: 'ס"מ',
  kick_power_kaiser: 'יח׳ כוח',
  kick_power_right_foot: 'יח׳ כוח',
  kick_power_left_foot: 'יח׳ כוח',
  kick_power_machine_pct: '%',
  shuffle_10m: "שניות",
  sprint_10m_h: "שניות",
  sprint_10m_h_ball: "שניות",
};

// ===========================================
// ASSESSMENT SECTIONS FOR FORM
// ===========================================

/** The three timed dribbling tests (seconds, lower is better). */
export const DRIBBLING_TEST_KEYS = ["shuffle_10m", "sprint_10m_h", "sprint_10m_h_ball"] as const;

/**
 * First assessment date on which the dribbling tests exist. Earlier
 * assessments could not have them, so completeness ignores them there and a
 * complete assessment from before the rollout stays at 100%.
 */
export const DRIBBLING_TESTS_SINCE = "2026-09-29";

export type AssessmentMonthStatus = 'full' | 'partial' | 'none';

export type AssessmentSectionKey =
  'sprints' | 'dribbling' | 'jumps' | 'agility' | 'categorical' | 'power' | 'mental';

export interface SectionCompleteness {
  key: AssessmentSectionKey;
  title: string;
  completed: number;
  total: number;
}

export interface AssessmentSection {
  key: AssessmentSectionKey;
  title: string;
  fields: string[];
  type: "number" | "select" | "textarea";
  /** First assessment date the section exists; older assessments skip it. */
  since?: string;
}

export const ASSESSMENT_SECTIONS: AssessmentSection[] = [
  {
    key: "sprints",
    title: "מבדקי ספרינט",
    fields: ["sprint_5m", "sprint_10m", "sprint_20m"],
    type: "number",
  },
  {
    key: "dribbling",
    title: "מבדקי כדרור",
    fields: [...DRIBBLING_TEST_KEYS],
    type: "number",
    since: DRIBBLING_TESTS_SINCE,
  },
  {
    key: "jumps",
    title: "מבדקי ניתור",
    fields: ["jump_2leg_distance", "jump_right_leg", "jump_left_leg", "jump_2leg_height"],
    type: "number",
  },
  {
    key: "agility",
    title: "זריזות וגמישות",
    fields: ["blaze_spot_time", "flexibility_ankle", "flexibility_knee", "flexibility_hip"],
    type: "number",
  },
  {
    key: "categorical",
    title: "הערכות",
    fields: ["coordination", "leg_power_technique", "body_structure"],
    type: "select",
  },
  {
    key: "power",
    title: "כוח בעיטה",
    fields: ["kick_power_right_foot", "kick_power_left_foot", "kick_power_machine_pct"],
    type: "number",
  },
  {
    key: "mental",
    title: "הערכה מנטלית",
    fields: ["concentration_notes", "decision_making_notes", "work_ethic_notes", "recovery_notes", "nutrition_notes"],
    type: "textarea",
  },
];

// ===========================================
// HELPER FUNCTIONS
// ===========================================

/** The sections that existed on this assessment's date (see AssessmentSection.since). */
function sectionsFor(assessment: Partial<PlayerAssessment>): AssessmentSection[] {
  const date = assessment.assessment_date;
  return ASSESSMENT_SECTIONS.filter((section) => !section.since || !date || date >= section.since);
}

const LOWER_IS_BETTER_FIELDS: ReadonlySet<string> = new Set([
  "sprint_5m", "sprint_10m", "sprint_20m", ...DRIBBLING_TEST_KEYS,
]);

// Check if a test value indicates "lower is better" (the timed tests)
export function isLowerBetter(fieldName: string): boolean {
  return LOWER_IS_BETTER_FIELDS.has(fieldName);
}

/**
 * Returns section-level completeness for the ASSESSMENT_SECTIONS that apply to
 * this assessment's date (see AssessmentSection.since).
 * Returns [] when assessment is null (trainee has no record for the month).
 * Mental (textarea) fields are completed if non-null AND non-empty string.
 * Quantitative fields are completed if non-null.
 */
export function computeSectionCompleteness(
  assessment: Partial<PlayerAssessment> | null
): SectionCompleteness[] {
  if (!assessment) return [];

  return sectionsFor(assessment).map((section) => {
    const completed = section.fields.filter((field) => {
      const value = assessment[field as keyof PlayerAssessment];
      if (section.type === 'textarea') {
        return value !== null && value !== undefined && value !== '';
      }
      return value !== null && value !== undefined;
    }).length;

    return {
      key: section.key,
      title: section.title,
      completed,
      total: section.fields.length,
    };
  });
}

// Get completion percentage for an assessment: every numeric and categorical
// field of the sections that apply to it (mental notes do not count).
export function getAssessmentCompleteness(assessment: Partial<PlayerAssessment>): number {
  const fields = sectionsFor(assessment)
    .filter((section) => section.type !== "textarea")
    .flatMap((section) => section.fields);

  const completedFields = fields.filter((field) => {
    const value = assessment[field as keyof PlayerAssessment];
    return value !== null && value !== undefined && value !== "";
  }).length;

  return Math.round((completedFields / fields.length) * 100);
}
