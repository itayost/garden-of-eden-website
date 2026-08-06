# Studio Training Pipeline — Design

Approved 2026-08-06 after a brainstorming session. Three phases, each shipping to production independently. This document is the full-picture spec; each phase gets its own implementation plan when it starts.

## The problem

The academy's daily operation runs on one hand-typed WhatsApp message: hourly slots, which trainees arrive, what each group works on, which trainer takes them. Nothing downstream can use that text. Trainers plan sessions in their heads, trainees get verbal instructions at the studio, and nothing about what a trainee actually did — exercises, sets, reps, weights — is ever recorded.

The pipeline turns that flow into data, without changing how anyone works:

1. Eden builds the day as structured slots instead of typing text (and still sends the WhatsApp message — generated, one tap).
2. Each trainer sees his slots and builds a per-trainee session from the exercise library.
3. The trainee arrives, opens his phone, sees today's session, and logs what he did — by scanning a QR sticker on the equipment or straight from the list.

## Decisions (locked during brainstorming)

| Decision | Choice | Why |
|---|---|---|
| Delivery | Phased, 1 → 2 → 3, each to production | Feedback from real use corrects later phases before they are built |
| Session shape | Daily per-trainee session, built by the trainer | Matches the described flow; programs serve as templates, not assignments; group sessions lose per-child load tuning |
| Schedule source | Admin-authored in a structured builder | Bookings are not reliably managed in Arbox; the Arbox schedule API returns registered counts, not per-trainee rosters (see ADR 0002) |
| QR role | Shortcut only — logging always works from the session list | A torn sticker or a blocked camera must not break the feature |
| QR mechanism | Printed URL, native camera, no scanner library | Phones read QR URLs natively; the OTP login flow already round-trips deep links (`?redirect=` in middleware) |
| Log granularity | One row per exercise: sets, reps, weight | Per-set granularity is overkill for this age group; revisit if trainers ask |

## Phase 1 — לוח יומי (structured daily schedule)

**Atom: the Slot** — `(date, hour, trainer, focus, location, trainee roster)`. Two trainers at 16:00 with different groups are two slots.

- Tables: `daily_schedule_slots`, `daily_schedule_slot_trainees`. Roster rows carry `trainee_id` (nullable) + `trainee_name` snapshot — Eden's lists include names that are not system accounts, and the builder must not force account creation.
- Page `/admin/schedule`: date navigation, slots grouped by hour. Admin builds and edits; trainer sees the day read-only with his slots highlighted.
- **שכפל מאתמול** — days repeat; start from yesterday, adjust.
- **העתק כהודעת וואטסאפ** — generates the exact message format Eden sends today. The system becomes the source of truth; WhatsApp becomes an output.
- RLS: admin writes, staff reads, trainees nothing. DELETE allowed (planning data, not accountability records).
- The free-text `daily_briefs` stays for general announcements; the schedule is a separate structure beside it.

## Phase 2 — שיבוץ אימונים (trainer builds sessions)

- Tables: `training_sessions` (`trainee_id`, `session_date`, `built_by`, optional `slot_id`, `UNIQUE(trainee_id, session_date)`, completion timestamps) and `training_session_exercises` (`session_id`, `exercise_id` → existing `workout_exercises`, `order_index`, target sets/reps/load).
- Trainer flow: schedule page → his slot → per linked trainee "בנה אימון" → exercise picker (reuse `ExercisePicker` from `src/features/workouts/`), plus "העתק מתוכנית" (pull one week column of a `workout_programs` grid as a starting point) and "שכפל אימון קודם".
- First trainee-readable RLS on workout data: trainee SELECT on his own `training_sessions`/`training_session_exercises`, and SELECT on the `workout_exercises` library (content is not sensitive). Today's admin/trainer-only policies stay for everything else.
- Free-text roster names (no `trainee_id`) cannot receive sessions — the UI shows them as unlinked.

## Phase 3 — מסך מתאמן + QR (trainee logging)

- `equipment` table (name, short code, active) + `equipment_id` FK on `workout_exercises` (the current free-text `equipment` column stays as a fallback label during migration).
- Admin equipment CRUD + a printable QR stickers page. Each QR encodes `https://www.edengarden.co.il/dashboard/scan/<code>` — a plain URL, no in-app camera code.
- `/dashboard/scan/[code]`: resolves the equipment → finds the exercise in the trainee's *today* session that uses it → opens the quick log form (sets / reps / weight). No match → free-log from that equipment's exercises.
- `/dashboard/workout`: today's session — exercises with targets, progress, per-exercise logging (the QR is a jump, not a gate). Session completes when all exercises have a log or the trainee taps "סיימתי".
- `exercise_logs`: `trainee_id`, `exercise_id`, optional `session_exercise_id` (free logs allowed), optional `equipment_id`, `sets`, `reps`, `weight_kg`, `note`, `logged_at`. RLS: trainee inserts/reads own; staff reads all.
- Dashboard home gets a "האימון שלי היום" card; the trainer's schedule view shows completion status and actual numbers per trainee.

## Explicitly out of scope

Arbox schedule pull (ADR 0002 records the revisit trigger), per-set logging, trainee-visible schedule (only his own session is visible, never the day's roster), push notifications, offline queue for logs (the shift-sync service worker pattern exists if the studio's connectivity turns out to be a problem).
