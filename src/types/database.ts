// Aliases the app imports, over the generated Supabase types.
// The base lives in database.generated.ts: refresh it with `npm run db:types`
// after every migration and never edit it by hand.
import type { Enums, Tables, TablesInsert, TablesUpdate } from './database.generated';

export type { Database, Enums, Json, Tables, TablesInsert, TablesUpdate } from './database.generated';

export type UserRole = Enums<'user_role'>;
export type NutritionAppointmentStatus = Enums<'nutrition_appointment_status'>;
export type ShiftChangeRequestType = Enums<'shift_change_request_type'>;
export type ShiftChangeRequestStatus = Enums<'shift_change_request_status'>;
export type ShiftPeriodValue = Enums<'shift_period'>;
export type AchievementBadgeType = Enums<'achievement_badge_type'>;

export type Profile = Tables<'profiles'>;
export type Trainer = Tables<'trainers'>;
export type PreWorkoutForm = Tables<'pre_workout_forms'>;
export type PostWorkoutForm = Tables<'post_workout_forms'>;
export type NutritionForm = Tables<'nutrition_forms'>;
export type WorkoutVideo = Tables<'workout_videos'>;
export type VideoProgress = Tables<'video_progress'>;
export type PlayerStats = Tables<'player_stats'>;
export type PlayerStatsInsert = TablesInsert<'player_stats'>;
export type PlayerStatsUpdate = TablesUpdate<'player_stats'>;
export type PlayerStatsHistory = Tables<'player_stats_history'>;
export type PlayerRatingSnapshotRow = Tables<'player_rating_snapshots'>;
export type PlayerRatingSnapshotInsert = TablesInsert<'player_rating_snapshots'>;
export type PlayerRatingSnapshotUpdate = TablesUpdate<'player_rating_snapshots'>;
export type PlayerAssessmentRow = Tables<'player_assessments'>;
export type PlayerAssessmentInsert = TablesInsert<'player_assessments'>;
export type PlayerAssessmentUpdate = TablesUpdate<'player_assessments'>;
export type ActivityLogRow = Tables<'activity_logs'>;
export type UserStreakRow = Tables<'user_streaks'>;
export type PlayerGoalRow = Tables<'player_goals'>;
export type PlayerGoalInsert = TablesInsert<'player_goals'>;
export type PlayerGoalUpdate = TablesUpdate<'player_goals'>;
export type UserAchievementRow = Tables<'user_achievements'>;
export type UserAchievementInsert = TablesInsert<'user_achievements'>;
export type UserAchievementUpdate = TablesUpdate<'user_achievements'>;
export type PaymentRow = Tables<'payments'>;
export type PaymentInsert = TablesInsert<'payments'>;
export type PaymentUpdate = TablesUpdate<'payments'>;
export type TrainerShiftReport = Tables<'trainer_shift_reports'>;
export type TrainerShift = Tables<'trainer_shifts'>;
export type ShiftChangeRequest = Tables<'shift_change_requests'>;
export type ShiftChangeRequestInsert = TablesInsert<'shift_change_requests'>;
export type ShiftChangeRequestUpdate = TablesUpdate<'shift_change_requests'>;
export type TraineeSummary = Tables<'trainee_summaries'>;
