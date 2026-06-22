<!-- Generated: 2026-06-22 | Files scanned: 545 | Token estimate: ~970 -->

# data.md — Database Schema & Relationships

## Auth / Profiles

| Table | Key Columns |
|-------|-------------|
| `profiles` | id (FK auth.users), full_name, phone, role (trainee\|trainer\|admin), age_group, arbox_user_id, onboarding_tour_completed, welcome_sent, deleted_at, deleted_by |

Trigger: `on_auth_user_created` auto-inserts profile row on `auth.users` INSERT. Do not manually insert.

---

## Assessments & Ratings

| Table | Key Columns |
|-------|-------------|
| `player_assessments` | id, user_id → profiles, assessment_date, sprint_30m/sprint_20m DECIMAL(5,3), broad_jump DECIMAL(5,1), kaiser DECIMAL(5,2), coordination ENUM(deficient\|basic\|advanced), deleted_at, deleted_by |
| `age_group_benchmarks` | id, age_group, metric, p25/p50/p75/p90 |
| `player_rating_snapshots` | id, user_id, assessment_id (UNIQUE), assessment_date, age_group, pace/shooting/passing/dribbling/defending/physical/overall_rating INTEGER, computed_at, deleted_at |

Snapshot keyed 1:1 on assessment_id; never recomputed on read.

---

## Nutrition

| Table | Key Columns |
|-------|-------------|
| `trainee_meal_plans` | id, user_id, workout_day_pdf_url, workout_day_pdf_path, rest_day_pdf_url, rest_day_pdf_path; legacy pdf_url/pdf_path deprecated (nullable, not dropped) |
| `nutrition_measurements` | id, user_id, measurement_date DATE, age, height_cm DECIMAL(5,1), height_percentile, weight_kg, bmi, bmi_percentile, body_fat_percentage DECIMAL(5,2), notes, created_by, deleted_at, deleted_by |

---

## Shifts

| Table | Key Columns |
|-------|-------------|
| `trainer_shifts` | id, trainer_id → auth.users, trainer_name, start_time, end_time, auto_ended, flagged_for_review, other_purpose_minutes INTEGER DEFAULT 0, other_purpose_category TEXT (enum: תזונה\|שימור לקוחות\|ישיבות…\|אדמיניסטרציה\|שיווק ותוכן\|תחזוקת מתקן; paired CHECK: both set or both null), updated_at (auto-trigger) |
| `trainer_shift_reports` | id, trainer_id, report_date DATE; JSONB *_per_trainee columns for: new_trainees, discipline, injuries, limitations, mental_state, complaints, insufficient_attention, pro_candidates, social_skills, homework, video_feedback, praise; each section: has_<k> BOOL + <k>_trainee_ids UUID[] + <k>_details TEXT + <k>_per_trainee JSONB |
| `shift_change_requests` | id, trainer_id, trainer_name, request_type ENUM(edit\|retro_add), target_shift_id → trainer_shifts, original/requested start/end times, reason, status ENUM(pending\|approved\|rejected\|cancelled), decided_by, decided_at, decision_note, applied_shift_id → trainer_shifts, updated_at (auto-trigger) |
| `failed_shift_syncs` | id, trainer_id, error details, created_at |

RPC `approve_shift_change_request(request_id, actor_id, note)` SECURITY DEFINER — atomic: validates, applies edit/retro_merge/retro_insert to trainer_shifts, marks request approved.

---

## Leads / CRM

| Table | Key Columns |
|-------|-------------|
| `leads` | id, phone TEXT nullable (partial UNIQUE index where not null), name, status ENUM(new\|callback\|in_progress\|closed\|disqualified), tab_id → lead_tabs NOT NULL, assigned_trainer_id → profiles, source TEXT(paid\|organic), club, birth_year (1990–2030), additional_info, flow_age_group, flow_team, flow_frequency, payment, months, total_payment, note, updated_at (auto-trigger) |
| `lead_tabs` | id, slug (UNIQUE, ^[a-z0-9_-]{1,50}$), name, color, position, is_default BOOL (partial UNIQUE: one default), deleted_at; defaults: paid/organic |
| `lead_contact_log` | id, lead_id, contact_type ENUM(call\|whatsapp\|meeting\|message_sent), outcome ENUM, notes, created_at |
| `lead_sent_messages` | id, lead_id, message_id, message_type ENUM(template\|flow\|text), campaign, sent_at |
| `lead_flow_responses` | id, lead_id, flow_token UNIQUE, screen, data JSONB, is_complete, created_at |

---

## Retention

| Table | Key Columns |
|-------|-------------|
| `retention_reports` | id, report_month DATE UNIQUE, data JSONB (monthly Arbox snapshot merged with stored), created_at |
| `retention_notes` | id, report_month DATE, trainee_phone, trainee_name, note TEXT DEFAULT '', author_id, assigned_trainer_id → profiles ON DELETE SET NULL, updated_at (auto-trigger); UNIQUE(report_month, trainee_phone) |
| `churned_customers` | id, name, end_date DATE, note TEXT DEFAULT '', note_color ENUM(none\|yellow\|red\|green), author_id, assigned_trainer_id → profiles ON DELETE SET NULL, updated_at (auto-trigger) |

---

## Trainee Misc

| Table | Key Columns |
|-------|-------------|
| `trainee_communication_log` | id, trainee_id → profiles, author_id → profiles, author_name TEXT (denormalized snapshot), content TEXT, created_at, deleted_at, deleted_by; hard DELETE blocked by RLS |
| `trainee_summaries` | id, user_id, content, created_at |
| `trainee_next_games` | id, user_id UNIQUE, game_date DATE, opponent, updated_at; auto-cleared by daily cron after game_date passes |
| `trainee_clips` | id, user_id UNIQUE, storage_path, mime_type, size_bytes, uploaded_at; 1-slot per trainee; 21-day TTL via daily cron |
| `mental_questionnaires` | id, user_id, full_name, last_session_conclusion, mental_insight, tool_to_take, wants_more_zoom, zoom_feeling, wants_one_on_one, submitted_at |

---

## Goals & Achievements

| Table | Key Columns |
|-------|-------------|
| `user_goals` | id, user_id, goal_type, target_value, current_value, completed_at |
| `user_achievements` | id, user_id, achievement_id, earned_at |
| `achievement_badges` | id, key, name, description, icon |

---

## Activity / Audit

| Table | Key Columns |
|-------|-------------|
| `activity_logs` | id, user_id, action ENUM (includes shift_change_request_* variants), details JSONB, created_at |

---

## Storage

| Bucket | Purpose | Path pattern |
|--------|---------|--------------|
| `avatars` (public) | Avatars + meal plan PDFs + uploads | {userId}/{type}/{timestamp}.{ext} |
| `trainee-clips` (private) | Trainee video clips | per trainee_clips.storage_path |

---

## Key Relationships

```
profiles ←─ player_assessments ←─ player_rating_snapshots
profiles ←─ trainer_shifts ←─ trainer_shift_reports
profiles ←─ shift_change_requests
profiles ←─ trainee_meal_plans
profiles ←─ nutrition_measurements
profiles ←─ trainee_communication_log
profiles ←─ retention_notes (assigned_trainer_id)
profiles ←─ churned_customers (assigned_trainer_id)
profiles ←─ leads (assigned_trainer_id)
lead_tabs ←─ leads (tab_id, NOT NULL)
trainer_shifts ←─ shift_change_requests (target_shift_id, applied_shift_id)
```

---

## RLS Pattern

All tables have RLS enabled.
- **trainee**: own rows only (SELECT via `auth.uid() = user_id`)
- **trainer**: own shifts + reports; read-only on trainee data
- **admin**: full access via role check in `profiles`
- **service role** (`createAdminClient()`): bypasses RLS for admin server actions
- Hard DELETE blocked on audit/log tables (communication_log, nutrition_measurements); soft-delete via UPDATE

---

## Migration History

66 total migrations. Two formats coexist: legacy `NNN_description.sql` (002–013) and timestamp `YYYYMMDDHHMMSS_description.sql`. Do not renumber legacy files.

10 most recent (by purpose):
1. `20260618094422` — trainee_communication_log table + RLS
2. `20260618144659` — retention_notes: assigned_trainer_id + auto updated_at trigger
3. `20260618150000` — trainer_shift_reports: homework / video_feedback / praise per-trainee JSONB columns
4. `20260622120000` — churned_customers: assigned_trainer_id + auto updated_at trigger
5. `20260622160000` — trainer_shifts: other_purpose_minutes + other_purpose_category + paired CHECK
6. `20260526174324` — trainee_meal_plans: workout_day + rest_day PDF columns; legacy pdf_url/path deprecated
7. `20260530120000` — leads: phone nullable + partial UNIQUE index
8. `20260526120000` — lead_tabs table + leads.tab_id NOT NULL FK
9. `20260515132003` — nutrition_measurements table + RLS
10. `20260509201054` — shift_change_requests table + approve_shift_change_request RPC
