export type AgeGroup = "U10-12" | "U13-14" | "U15-16" | "U17+";
export type CanonicalPosition =
  | "GK" | "CB" | "RB" | "LB" | "CDM" | "CM" | "CAM" | "LW" | "RW" | "ST" | "CF";

export interface BookCategory { id: string; slug: string; nameHe: string; icon: string | null; orderIndex: number; }
export interface BookAgeRow { id: string; ageGroup: AgeGroup; whatHe: string | null; metricValueHe: string | null; recoveryHe: string | null; orderIndex: number; }
export interface BookMuscle { id: string; nameHe: string; emoji: string | null; }
export interface BookDrill { id: string; parameterId: string; slug: string; nameEn: string | null; nameHe: string | null; muscleHe: string | null; muscles: BookMuscle[]; setsHe: string | null; howHe: string | null; whyHe: string | null; connectHe: string | null; orderIndex: number; }
export interface FailureStep { id: string; textHe: string; isFinal: boolean; orderIndex: number; }
export interface CardPhasePoint { id: string; textHe: string; orderIndex: number; }
export interface CardPhase { id: string; number: number | null; nameHe: string; subtitleHe: string | null; drillNoteHe: string | null; orderIndex: number; points: CardPhasePoint[]; }
export interface CardMetric { id: string; labelHe: string; beforeHe: string | null; targetHe: string | null; orderIndex: number; }
export interface BookDrillCard { id: string; drillId: string; situationLabelHe: string | null; subtitleHe: string | null; ageMinLabel: string | null; levelLabel: string | null; goldenRuleHe: string | null; failureSteps: FailureStep[]; phases: CardPhase[]; metrics: CardMetric[]; }
export interface BookParameter { id: string; categoryId: string; number: number | null; slug: string; nameHe: string; subtitleHe: string | null; orderIndex: number; isAllPositions: boolean; ageMetricLabel: string | null; reportTextHe: string | null; reportHighlightHe: string | null; verbalTextHe: string | null; verbalTipHe: string | null; positions: CanonicalPosition[]; }
export interface BookParameterWithChildren extends BookParameter { drills: BookDrill[]; ageRows: BookAgeRow[]; }
export interface BookCategoryWithParameters extends BookCategory { parameters: BookParameterWithChildren[]; }
export type DrillProgressMap = Readonly<Record<string, boolean>>;
