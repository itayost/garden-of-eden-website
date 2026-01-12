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

export const AGE_GROUPS: AgeGroup[] = [
  { id: "u10", label: "U10", labelHe: "עד 10", minAge: 0, maxAge: 10 },
  { id: "u12", label: "U12", labelHe: "עד 12", minAge: 10, maxAge: 12 },
  { id: "u15", label: "U15", labelHe: "עד 15", minAge: 12, maxAge: 15 },
  { id: "u18", label: "U18", labelHe: "עד 18", minAge: 15, maxAge: 18 },
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

  return AGE_GROUPS.find(g => age >= g.minAge && age < g.maxAge) || AGE_GROUPS[AGE_GROUPS.length - 1];
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

  // Agility (seconds)
  blaze_spot_time: number | null;

  // Flexibility (cm)
  flexibility_ankle: number | null;
  flexibility_knee: number | null;
  flexibility_hip: number | null;

  // Categorical
  coordination: CoordinationLevel | null;
  leg_power_technique: LegPowerTechnique | null;
  body_structure: BodyStructure | null;

  // Kick power (%)
  kick_power_kaiser: number | null;

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
  jump_2leg_height: "ניתור לגובה (קייזר)",

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
  blaze_spot_time: "שניות",
  flexibility_ankle: 'ס"מ',
  flexibility_knee: 'ס"מ',
  flexibility_hip: 'ס"מ',
  kick_power_kaiser: "%",
};

// ===========================================
// ASSESSMENT SECTIONS FOR FORM
// ===========================================

export interface AssessmentSection {
  key: string;
  title: string;
  fields: string[];
  type: "number" | "select" | "textarea";
}

export const ASSESSMENT_SECTIONS: AssessmentSection[] = [
  {
    key: "sprints",
    title: "מבדקי ספרינט",
    fields: ["sprint_5m", "sprint_10m", "sprint_20m"],
    type: "number",
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
    title: "כוח",
    fields: ["kick_power_kaiser"],
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

// Check if a test value indicates "lower is better"
export function isLowerBetter(fieldName: string): boolean {
  return ["sprint_5m", "sprint_10m", "sprint_20m", "blaze_spot_time"].includes(fieldName);
}

// Get completion percentage for an assessment
export function getAssessmentCompleteness(assessment: Partial<PlayerAssessment>): number {
  const numericFields = [
    "sprint_5m", "sprint_10m", "sprint_20m",
    "jump_2leg_distance", "jump_right_leg", "jump_left_leg", "jump_2leg_height",
    "blaze_spot_time",
    "flexibility_ankle", "flexibility_knee", "flexibility_hip",
    "kick_power_kaiser"
  ];

  const categoricalFields = ["coordination", "leg_power_technique", "body_structure"];
  const totalFields = numericFields.length + categoricalFields.length;

  let completedFields = 0;

  for (const field of numericFields) {
    if (assessment[field as keyof PlayerAssessment] !== null &&
        assessment[field as keyof PlayerAssessment] !== undefined) {
      completedFields++;
    }
  }

  for (const field of categoricalFields) {
    if (assessment[field as keyof PlayerAssessment]) {
      completedFields++;
    }
  }

  return Math.round((completedFields / totalFields) * 100);
}
