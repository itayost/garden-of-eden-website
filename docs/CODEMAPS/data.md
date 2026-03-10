<!-- Generated: 2026-03-10 | Files scanned: 404 | Token estimate: ~750 -->

# Data Architecture

## Database: Supabase (Postgres + RLS)

## Core Tables (inferred from types + migrations)

```
profiles              User profiles (linked to auth.users via trigger)
player_assessments    Physical assessments (sprints, jumps, kaiser, coordination)
player_stats          Player statistics
training_videos       Admin-uploaded training videos
video_progress        Per-user video watch tracking
pre_workout_forms     Pre-workout form submissions
post_workout_forms    Post-workout form submissions
nutrition_logs        Daily nutrition form entries
trainee_meal_plans    Meal plans (PDF upload: pdf_url, pdf_path; legacy: JSONB meal_plan)
```

## Feature Tables

```
achievement_badges     Badge definitions
user_achievements      Per-trainee badge awards
user_goals             Personal goals
user_streaks           Workout streak data
onboarding_state       Tour completion tracking
nutrition_status       Nutrition tracking status
```

## Admin/Trainer Tables

```
trainer_shifts         Clock in/out records
trainer_shift_reports  End-of-shift reports
failed_shift_syncs     Shift sync failure log
leads                  CRM lead records
activity_log           Admin action audit trail
admin_user_notes       Notes on users
```

## Integration Tables

```
payment_records        Meshulam payment data
arbox_user_id          Column on profiles for Arbox sync
```

## Migration History (supabase/migrations/)

```
Legacy format (001-013):
  001-007  Core tables (profiles, stats, assessments, forms, videos, payments)
  008      Achievement badges
  009-011  Nutrition features + constraints
  012-013  Trainer shift reports + shifts

Timestamp format (20260201+):
  20260201  Security indexes, soft delete, trainee images
  20260210  Meal plan PDF columns
  20260211  Failed shift syncs
  20260215  Achievements RLS fix, missing indexes, leads CRM
  20260216  Kaiser/jump swap fix, admin shift insert policy
  20260223  Trainees can view trainer profiles
  20260225  Per-trainee achievements, onboarding tour + nutrition status
  20260308  Arbox user ID column
```

## Validation Schemas (src/lib/validations/)

```
assessment.ts    Assessment field validation
common.ts        UUID validation (isValidUUID), shared schemas
forms.ts         Pre/post workout form schemas
leads.ts         Lead CRM schemas
payment.ts       Payment schemas
player-stats.ts  Player stats schemas
profile.ts       Profile update schemas
shift-report.ts  Shift report schemas
user-create.ts   User creation schema
user-edit.ts     User edit schema
user-import.ts   CSV import schema
video.ts         Video management schemas
webhook.ts       Webhook payload schemas
```

## Storage (Supabase Storage)

```
Bucket: avatars (public)
Path pattern: {userId}/{type}/{timestamp}.{ext}
Types: avatar, meal-plan-pdf, trainee-image, player-card
```
