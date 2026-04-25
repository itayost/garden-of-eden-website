import type { PlayerAssessment } from "@/types/assessment";
import type { TraineeSummary } from "@/types/database";
import type { RatingDataPoint } from "@/features/progress-charts";
import type { ReportBulletItem } from "../lib/utils/aggregate-notes";

export interface TraineeAttendance {
  readonly totalSessions: number;
  readonly weeklyAverage: number;
  readonly sessions: readonly {
    readonly date: string;
    readonly className: string | null;
  }[];
}

export interface ReportData {
  readonly profile: {
    readonly id: string;
    readonly full_name: string | null;
    readonly birthdate: string | null;
    readonly position: string | null;
    readonly club: string | null;
    readonly avatar_url: string | null;
    readonly processed_avatar_url: string | null;
    readonly created_at: string;
  };
  readonly assessments: readonly PlayerAssessment[];
  readonly stats: {
    readonly overall_rating: number | null;
    readonly pace: number | null;
    readonly shooting: number | null;
    readonly passing: number | null;
    readonly dribbling: number | null;
    readonly defending: number | null;
    readonly physical: number | null;
    readonly card_type: string | null;
  } | null;
  readonly ratingHistory: readonly RatingDataPoint[];
  readonly attendance: TraineeAttendance | null;
  readonly strengths: readonly ReportBulletItem[];
  readonly weaknesses: readonly ReportBulletItem[];
  readonly socialSkills: readonly ReportBulletItem[];
  readonly latestSummary: TraineeSummary | null;
}
