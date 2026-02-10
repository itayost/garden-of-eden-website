// Metric Definitions for Progress Charts

import { ASSESSMENT_LABELS_HE, ASSESSMENT_UNITS } from "@/types/assessment";
import type { MetricDefinition, PhysicalMetricKey, MetricCategory } from "../../types";

export const METRIC_DEFINITIONS: Record<PhysicalMetricKey, MetricDefinition> = {
  // Sprint tests (lower is better)
  sprint_5m: {
    key: "sprint_5m",
    labelHe: ASSESSMENT_LABELS_HE.sprint_5m,
    unit: ASSESSMENT_UNITS.sprint_5m,
    lowerIsBetter: true,
    color: "hsl(var(--chart-1))",
    category: "sprint",
  },
  sprint_10m: {
    key: "sprint_10m",
    labelHe: ASSESSMENT_LABELS_HE.sprint_10m,
    unit: ASSESSMENT_UNITS.sprint_10m,
    lowerIsBetter: true,
    color: "hsl(var(--chart-2))",
    category: "sprint",
  },
  sprint_20m: {
    key: "sprint_20m",
    labelHe: ASSESSMENT_LABELS_HE.sprint_20m,
    unit: ASSESSMENT_UNITS.sprint_20m,
    lowerIsBetter: true,
    color: "hsl(var(--chart-3))",
    category: "sprint",
  },

  // Jump tests (higher is better)
  jump_2leg_distance: {
    key: "jump_2leg_distance",
    labelHe: ASSESSMENT_LABELS_HE.jump_2leg_distance,
    unit: ASSESSMENT_UNITS.jump_2leg_distance,
    lowerIsBetter: false,
    color: "hsl(var(--chart-1))",
    category: "jump",
  },
  jump_2leg_height: {
    key: "jump_2leg_height",
    labelHe: ASSESSMENT_LABELS_HE.jump_2leg_height,
    unit: ASSESSMENT_UNITS.jump_2leg_height,
    lowerIsBetter: false,
    color: "hsl(var(--chart-2))",
    category: "jump",
  },
  jump_right_leg: {
    key: "jump_right_leg",
    labelHe: ASSESSMENT_LABELS_HE.jump_right_leg,
    unit: ASSESSMENT_UNITS.jump_right_leg,
    lowerIsBetter: false,
    color: "hsl(var(--chart-3))",
    category: "jump",
  },
  jump_left_leg: {
    key: "jump_left_leg",
    labelHe: ASSESSMENT_LABELS_HE.jump_left_leg,
    unit: ASSESSMENT_UNITS.jump_left_leg,
    lowerIsBetter: false,
    color: "hsl(var(--chart-4))",
    category: "jump",
  },

  // Agility - Blaze Spot (higher is better - correct hits in 1 minute)
  blaze_spot_time: {
    key: "blaze_spot_time",
    labelHe: ASSESSMENT_LABELS_HE.blaze_spot_time,
    unit: ASSESSMENT_UNITS.blaze_spot_time,
    lowerIsBetter: false,
    color: "hsl(var(--chart-1))",
    category: "agility",
  },

  // Flexibility (higher is better)
  flexibility_ankle: {
    key: "flexibility_ankle",
    labelHe: ASSESSMENT_LABELS_HE.flexibility_ankle,
    unit: ASSESSMENT_UNITS.flexibility_ankle,
    lowerIsBetter: false,
    color: "hsl(var(--chart-1))",
    category: "flexibility",
  },
  flexibility_knee: {
    key: "flexibility_knee",
    labelHe: ASSESSMENT_LABELS_HE.flexibility_knee,
    unit: ASSESSMENT_UNITS.flexibility_knee,
    lowerIsBetter: false,
    color: "hsl(var(--chart-2))",
    category: "flexibility",
  },
  flexibility_hip: {
    key: "flexibility_hip",
    labelHe: ASSESSMENT_LABELS_HE.flexibility_hip,
    unit: ASSESSMENT_UNITS.flexibility_hip,
    lowerIsBetter: false,
    color: "hsl(var(--chart-3))",
    category: "flexibility",
  },

  // Power (higher is better)
  kick_power_kaiser: {
    key: "kick_power_kaiser",
    labelHe: ASSESSMENT_LABELS_HE.kick_power_kaiser,
    unit: ASSESSMENT_UNITS.kick_power_kaiser,
    lowerIsBetter: false,
    color: "hsl(var(--chart-1))",
    category: "power",
  },
};

// Metric categories for tabs
export const METRIC_CATEGORIES: Record<
  MetricCategory,
  { labelHe: string; metrics: PhysicalMetricKey[] }
> = {
  sprint: {
    labelHe: "ספרינטים",
    metrics: ["sprint_5m", "sprint_10m", "sprint_20m"],
  },
  jump: {
    labelHe: "ניתורים",
    metrics: ["jump_2leg_distance", "jump_2leg_height", "jump_right_leg", "jump_left_leg"],
  },
  agility: {
    labelHe: "זריזות",
    metrics: ["blaze_spot_time"],
  },
  flexibility: {
    labelHe: "גמישות",
    metrics: ["flexibility_ankle", "flexibility_knee", "flexibility_hip"],
  },
  power: {
    labelHe: "כוח",
    metrics: ["kick_power_kaiser"],
  },
};

// Chart colors for EA FC ratings
export const RATING_COLORS: Record<string, string> = {
  overall_rating: "hsl(221, 83%, 53%)", // Blue - hardcoded because CSS vars don't work in SVG
  pace: "hsl(142, 76%, 36%)", // Green
  shooting: "hsl(0, 84%, 60%)", // Red
  passing: "hsl(217, 91%, 60%)", // Blue
  dribbling: "hsl(280, 87%, 65%)", // Purple
  defending: "hsl(45, 93%, 47%)", // Gold
  physical: "hsl(199, 89%, 48%)", // Cyan
};

// Hebrew labels for EA FC ratings
export const RATING_LABELS_HE: Record<string, string> = {
  overall_rating: "דירוג כללי",
  pace: "מהירות",
  shooting: "בעיטה",
  passing: "מסירות",
  dribbling: "כדרור",
  defending: "הגנה",
  physical: "פיזי",
};

// Date range presets
export const DATE_RANGE_PRESETS: { value: string; label: string }[] = [
  { value: "3m", label: "3 חודשים" },
  { value: "6m", label: "6 חודשים" },
  { value: "1yr", label: "שנה" },
  { value: "all", label: "הכל" },
];
