// Player Stats Types and Constants for EA FC-style cards

// Position type
export type PlayerPosition =
  | "GK" | "CB" | "RB" | "LB"
  | "CDM" | "CM" | "CAM"
  | "LW" | "RW" | "ST" | "CF";

// Card type for different card styles
export type CardType = "standard" | "gold" | "silver" | "bronze" | "special";

// Training pillar categorization
export type TrainingPillar = "athletic" | "mental" | "technical_tactical" | "lifestyle";

// Main stat keys
export const MAIN_STAT_KEYS = ["pace", "shooting", "passing", "dribbling", "defending", "physical"] as const;
export type MainStatKey = typeof MAIN_STAT_KEYS[number];

// Short labels for card display (3 letters like EA FC)
export const STAT_LABELS_SHORT: Record<MainStatKey, string> = {
  pace: "PAC",
  shooting: "SHO",
  passing: "PAS",
  dribbling: "DRI",
  defending: "DEF",
  physical: "PHY",
};

// Hebrew translations for all stats
export const STAT_LABELS_HE: Record<string, string> = {
  // Main stats
  pace: "מהירות",
  shooting: "בעיטה",
  passing: "מסירות",
  dribbling: "כדרור",
  defending: "הגנה",
  physical: "פיזיות",
  // Pace sub-stats
  acceleration: "תאוצה",
  sprint_speed: "מהירות ריצה",
  agility: "זריזות",
  // Shooting sub-stats
  finishing: "סיום",
  shot_power: "עוצמת בעיטה",
  long_shots: "בעיטות רחוקות",
  positioning: "מיקום",
  // Passing sub-stats
  vision: "ראיית משחק",
  short_passing: "מסירות קצרות",
  long_passing: "מסירות ארוכות",
  crossing: "הרמות",
  // Dribbling sub-stats
  ball_control: "שליטה בכדור",
  dribbling_skill: "כדרור",
  composure: "קור רוח",
  reactions: "תגובות",
  // Defending sub-stats
  interceptions: "יירוטים",
  tackling: "חטיפות",
  marking: "סימון",
  heading_accuracy: "דיוק נגיחות",
  // Physical sub-stats
  stamina: "סיבולת",
  strength: "כוח",
  jumping: "קפיצה",
  balance: "שיווי משקל",
  // Training metrics
  focus: "ריכוז",
  decision_making: "קבלת החלטות",
  work_rate: "מוסר עבודה",
  recovery: "התאוששות",
  nutrition_score: "תזונה",
  overall_rating: "דירוג כולל",
};

// Pillar labels in Hebrew
export const PILLAR_LABELS_HE: Record<TrainingPillar, string> = {
  athletic: "אתלטי",
  mental: "מנטלי",
  technical_tactical: "טכני-טקטי",
  lifestyle: "אורח חיים",
};

// Mapping sub-stats to pillars for display
export const STAT_TO_PILLAR: Record<string, TrainingPillar> = {
  // Athletic
  acceleration: "athletic",
  sprint_speed: "athletic",
  agility: "athletic",
  strength: "athletic",
  jumping: "athletic",
  balance: "athletic",
  // Mental
  composure: "mental",
  reactions: "mental",
  focus: "mental",
  decision_making: "mental",
  work_rate: "mental",
  vision: "mental",
  // Technical-Tactical
  finishing: "technical_tactical",
  shot_power: "technical_tactical",
  long_shots: "technical_tactical",
  positioning: "technical_tactical",
  short_passing: "technical_tactical",
  long_passing: "technical_tactical",
  crossing: "technical_tactical",
  ball_control: "technical_tactical",
  dribbling_skill: "technical_tactical",
  interceptions: "technical_tactical",
  tackling: "technical_tactical",
  marking: "technical_tactical",
  heading_accuracy: "technical_tactical",
  // Lifestyle
  stamina: "lifestyle",
  recovery: "lifestyle",
  nutrition_score: "lifestyle",
};

// Position labels in Hebrew
export const POSITION_LABELS_HE: Record<PlayerPosition, string> = {
  GK: "שוער",
  CB: "בלם",
  RB: "מגן ימין",
  LB: "מגן שמאל",
  CDM: "קשר הגנתי",
  CM: "קשר",
  CAM: "קשר התקפי",
  LW: "כנף שמאל",
  RW: "כנף ימין",
  ST: "חלוץ",
  CF: "חלוץ מרכזי",
};

// All positions as const array (enables Zod enum without type assertion)
export const POSITIONS = [
  "GK", "CB", "RB", "LB", "CDM", "CM", "CAM", "LW", "RW", "ST", "CF"
] as const;

// Card types with Hebrew labels
export const CARD_TYPES: { value: CardType; label: string }[] = [
  { value: "bronze", label: "ברונזה" },
  { value: "silver", label: "כסף" },
  { value: "gold", label: "זהב" },
  { value: "special", label: "מיוחד" },
];

// Card type styling
export const CARD_STYLES: Record<CardType, { gradient: string; border: string; text: string; glow: string }> = {
  gold: {
    gradient: "from-yellow-600 via-yellow-400 to-yellow-600",
    border: "border-yellow-500",
    text: "text-yellow-900",
    glow: "shadow-yellow-500/30",
  },
  silver: {
    gradient: "from-gray-400 via-gray-200 to-gray-400",
    border: "border-gray-400",
    text: "text-gray-800",
    glow: "shadow-gray-400/30",
  },
  bronze: {
    gradient: "from-orange-700 via-orange-500 to-orange-700",
    border: "border-orange-600",
    text: "text-orange-900",
    glow: "shadow-orange-500/30",
  },
  standard: {
    gradient: "from-slate-600 via-slate-400 to-slate-600",
    border: "border-slate-500",
    text: "text-slate-900",
    glow: "shadow-slate-400/30",
  },
  special: {
    gradient: "from-purple-600 via-pink-500 to-purple-600",
    border: "border-purple-500",
    text: "text-purple-900",
    glow: "shadow-purple-500/30",
  },
};

// Helper function to get stat text color based on value
export function getStatColor(value: number): string {
  if (value >= 80) return "text-green-500";
  if (value >= 70) return "text-lime-500";
  if (value >= 60) return "text-yellow-500";
  if (value >= 50) return "text-orange-500";
  return "text-red-500";
}

// Helper function to get progress bar background color based on value
export function getStatBarColor(value: number): string {
  if (value >= 80) return "bg-green-500";
  if (value >= 70) return "bg-lime-500";
  if (value >= 60) return "bg-yellow-500";
  if (value >= 50) return "bg-orange-500";
  return "bg-red-500";
}

// Stat category definitions for the detailed view
export const STAT_CATEGORIES = [
  {
    key: "pace",
    subStats: ["acceleration", "sprint_speed", "agility"],
  },
  {
    key: "shooting",
    subStats: ["finishing", "shot_power", "long_shots", "positioning"],
  },
  {
    key: "passing",
    subStats: ["vision", "short_passing", "long_passing", "crossing"],
  },
  {
    key: "dribbling",
    subStats: ["ball_control", "dribbling_skill", "composure", "reactions"],
  },
  {
    key: "defending",
    subStats: ["interceptions", "tackling", "marking", "heading_accuracy"],
  },
  {
    key: "physical",
    subStats: ["stamina", "strength", "jumping", "balance"],
  },
] as const;

// Training metrics (additional to main EA FC stats)
export const TRAINING_METRICS = [
  "focus",
  "decision_making",
  "work_rate",
  "recovery",
  "nutrition_score",
] as const;
