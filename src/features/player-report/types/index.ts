import type { PlayerAssessment } from "@/types/assessment";
import type { GroupStats } from "@/lib/assessment-to-rating";
import type { TraineeSummary } from "@/types/database";
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
    readonly overall_rating: number;
    readonly pace: number;
    readonly shooting: number;
    readonly passing: number;
    readonly dribbling: number;
    readonly defending: number;
    readonly physical: number;
    readonly card_type: string | null;
  } | null;
  readonly groupStats: GroupStats | null;
  readonly attendance: TraineeAttendance | null;
  readonly strengths: readonly ReportBulletItem[];
  readonly weaknesses: readonly ReportBulletItem[];
  readonly socialSkills: readonly ReportBulletItem[];
  readonly latestSummary: TraineeSummary | null;
}
