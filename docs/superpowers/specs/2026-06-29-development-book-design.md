# Player Development Book (ספר פיתוח השחקן) — Design

- **Date:** 2026-06-29
- **Status:** Approved (design); implementation not started
- **Feature folder source:** `features-to-implement/trainee-workouts-book/` (3 HTML mockups)
- **Scope:** Feature 1 of 2. Feature 2 (trainer exercise database / workout builder) is a separate, independent spec.

## 1. Overview

A trainee- and parent-facing knowledge base ("the book") delivering the academy's
player-development methodology: 7 categories, 32 parameters, football drills, premium
per-drill cards, and a dedicated parents view. Content is personalized per trainee
(age + position), fully editable by trainers/admins through a CMS, and trainees can mark
drills as done with progress feeding the existing streak/achievement systems.

The cover quote ("when a parent asks why he isn't good at 1v1, the answer is: did he do
enough calf raises?") captures the dual intent: it teaches trainees *and* explains the
methodology to parents.

## 2. Decisions (locked)

| # | Question | Decision |
|---|----------|----------|
| 1 | Primary purpose / audience | Trainees **and** parents, equal weight |
| 2 | How parents access content | Inside the trainee account (no parent role); parents page is a route in the trainee dashboard |
| 3 | Personalization | Content **filtered per trainee** by age group (from `birthdate`) and position |
| 4 | Content editing | **Full CMS** — trainers/admins edit via admin UI |
| 5 | Mockup scope | All three: book (32 params) + parents page, drills book (41 drills), premium drill cards |
| 6 | Premium drill cards | **Every drill** gets one |
| 7 | Visual language | Inspired by mockup structure/feel, using the app's design tokens + Radix components |
| 8 | Interactivity | **Mark-as-done + tracking**, wired into existing streaks/achievements |

Architecture approach: **A — full normalization** (separate tables per entity).

## 3. Scope

**In scope**
- Unified content tree: Category → Parameter (4 content tabs) → Drill → premium Drill Card.
- Parents page (derived from parameters' parent-tab content, grouped by category).
- Per-trainee filtering by position and age group, with a "my content / show all" toggle.
- CMS for trainers/admins to manage all content.
- Mark-drill-done progress + streak/achievement integration.
- One-time seed of existing mockup content into the DB.

**Out of scope (v1)**
- Daily homework counters (e.g. "100 weak-foot passes/day").
- Trainer-facing reporting on trainee book progress.
- Public/marketing exposure of the book.
- Sharing the parents page via public link.
- Any link to Feature 2's athletic exercise database (separate content set).

## 4. Content model relationship to Feature 2

The Excel database (Feature 2) and these mockups (Feature 1) are **largely different
exercise sets** with different schemas and audiences. They share only ~4-6 athletic
basics, framed differently. **They must not share a table.** Feature 1 drills carry
pedagogical fields (how / why / connect-to-game / age progression); Feature 2 items carry
S&C fields (equipment / cues / injury-prevention goal).

## 5. Data model (normalized)

All tables prefixed `book_`. Timestamps `created_at`/`updated_at` on every table.
Use `typedFrom(supabase, "...")` for tables absent from generated types.

### Core

**`book_categories`** — the 7 categories
`id, slug, name_he, icon, order_index`

**`book_parameters`** — the 32 parameters; 1:1 content (parents/verbal tabs) stored as columns
`id, category_id (FK), number, slug, name_he, subtitle_he, order_index,`
`is_all_positions (bool), age_metric_label (header for the age table's 3rd column),`
`report_text_he, report_highlight_he (parents tab), verbal_text_he, verbal_tip_he (verbal tab)`

**`book_parameter_positions`** — M:N position tags for filtering
`parameter_id (FK), position (one of the 11 canonical codes)`

**`book_drills`** — unified exercises/drills (the book's "exercises" tab AND the drills book)
`id, parameter_id (FK), slug, name_en, name_he, muscle_he, sets_he, how_he, why_he,`
`connect_he (החיבור למשחק), order_index`

**`book_age_rows`** — the "by age" tab; one row per age group per parameter
`id, parameter_id (FK), age_group (U10-12 | U13-14 | U15-16 | U17+), what_he,`
`metric_value_he, recovery_he (nullable), order_index`

### Premium drill card (1:1 with a drill, optional)

**`book_drill_cards`**
`id, drill_id (FK, unique), situation_label_he, subtitle_he, age_min_label, level_label, golden_rule_he`

**`book_drill_card_failure_steps`** — the failure chain
`id, card_id (FK), text_he, is_final (bool), order_index`

**`book_drill_card_phases`** — the 4-phase protocol
`id, card_id (FK), number, name_he, subtitle_he, drill_note_he, order_index`

**`book_drill_card_phase_points`** — bullet points within a phase
`id, phase_id (FK), text_he, order_index`

**`book_drill_card_metrics`** — 6-week success metrics
`id, card_id (FK), label_he, before_he, target_he, order_index`

### Progress

**`book_drill_progress`** — mirror of `video_progress`
`id, user_id (FK), drill_id (FK), status, completed_at` (unique on user_id+drill_id)

### Derived (no table)
- **Parents page**: rendered from `book_parameters` parent-tab columns, grouped by category.
- **Parameter/category progress %**: computed from `book_drill_progress` counts.

## 6. Position mapping

Canonical positions (`POSITIONS` in `src/types/player-stats.ts`, 11 EA FC codes):
`GK, CB, RB, LB, CDM, CM, CAM, LW, RW, ST, CF`.

Content is tagged with these canonical codes. The mockup's colloquial groups are an
authoring convenience exposed as **quick-select buttons in the CMS** (config in code, not DB):

| Mockup tag | Canonical codes |
|------------|-----------------|
| כל עמדה | `is_all_positions = true` |
| קצה | LW, RW |
| תוקף | ST, CF |
| CM | CM |
| מגן | RB, LB |
| סטופר | CB |
| שוער / שוער בלבד | GK |
| קפטן | not a position → `is_all_positions` |
| לפי עמדה | not a tag → `is_all_positions` |

Filtering rule: show a parameter if `is_all_positions` OR `trainee.position ∈ tagged positions`.
If `trainee.position` is `null` → show all (do not hide).

## 7. CMS (admin)

Sits on the existing `/admin/*` pattern; new sidebar item "ספר פיתוח".
Write access gated by `verifyAdminOrTrainer` (all trainers are trusted editors).

| Route | Purpose |
|-------|---------|
| `/admin/book` | Categories + parameters grouped by category; create/delete/reorder (order_index, up/down arrows — no drag-drop) |
| `/admin/book/parameters/[id]` | Edit parameter: base fields + positions (quick-group buttons) + 4 sections mirroring trainee tabs (drills, age rows, parents content, verbal content) |
| `/admin/book/drills/[id]` | Edit drill: base fields + premium card editor (failure chain, 4 phases with points, golden rule, success metrics) — heaviest screen |

**Key build saver:** all the child-row collections (age rows, failure steps, phase points,
metrics, a parameter's drill list) share one shape — an ordered list of simple rows. Build
**one reusable `RepeatableRows` editor** (add / inline-edit / delete / reorder) used across
all of them. Keeps full normalization while cutting CMS build time substantially.

**Reuse:** admin layout + sidebar, `TableToolbar`, `DeleteConfirmDialog`, `TablePagination`,
`useFormSubmission`, `typedFrom`. Server actions in
`src/features/development-book/lib/actions/`, split into focused files with a barrel re-export.

## 8. Trainee / parent view + filtering

Routes under `/dashboard`:

| Route | Content |
|-------|---------|
| `/dashboard/book` | Cover + 7 categories + parameter accordion cards (faithful to mockup); each open card holds 4 Radix tabs |
| `/dashboard/book/drills/[id]` | Premium drill card, deep-linkable |
| `/dashboard/book/parents` | Parents page (derived; light theme) |

**Filtering logic**
1. Position: show parameter if `is_all_positions` OR `position ∈ tags` OR `position is null`.
2. Age rows: the trainee's age-group row is highlighted and shown first; others behind a
   "show all ages" toggle.
3. Drills: inherit their parameter's visibility.
4. Global **"my content / show all"** toggle; default = filtered (per decision 3), but lets a
   parent view the whole methodology.

`deriveAgeGroup(birthdate)` is a pure util mapping to U10-12 / U13-14 / U15-16 / U17+.

**Data flow**
- Server Component at `/dashboard/book` reads profile (position + age group), filters
  server-side, renders; reads `book_drill_progress` for done-state.
- Mark done: `toggleDrillDone(drillId)` server action → `verifyUserAccess(self)` → upsert →
  (DB trigger updates streak) → achievement check → return state. Optimistic UI, rollback on error.

**Components** (mockup-inspired, app tokens): `BookCover`, `CategoryNav`,
`ParameterAccordionCard` (with `DrillsPanel` / `AgePanel` / `ParentsPanel` / `VerbalPanel`),
`DrillCard`, `ParentsPage`, `AgeTable`, `DrillDoneToggle`. New small `Accordion` (Radix) —
not yet in the app, trivial to add.

## 9. Progress & achievements

- **Streaks:** DB trigger on `book_drill_progress` insert updates `user_streaks`, same pattern
  as the form triggers (migration 006). Marking a drill done counts as daily activity.
  Un-marking does **not** decrement the streak (day-level, one activity suffices).
- **Achievements:** extend `src/features/achievements/config/badge-config.ts` with book badges,
  awarded in `toggleDrillDone` following the existing award pattern:
  - first drill completed
  - 10 drills completed
  - all drills in one category
  - all drills relevant to the trainee (whole book)
- **Progress bars:** parameter/category % derived from `book_drill_progress` counts; no extra table.

## 10. Security / RLS

- **Content tables** (`book_*` except progress): `SELECT` for any authenticated user;
  `INSERT/UPDATE/DELETE` for admins + trainers via a role-checking policy
  (`profile.role in ('admin','trainer')`). Content is not user-owned, so the
  admin-on-behalf RLS gotcha does not apply.
- **`book_drill_progress`:** owner-only (`auth.uid() = user_id`). Trainers do not read
  progress in v1.
- Server actions: writes guarded by `verifyAdminOrTrainer`; `toggleDrillDone` by
  `verifyUserAccess(self)`. All IDs validated with `isValidUUID`. Inputs validated with Zod.
  No service-role key on the client.

## 11. Testing

Per project rule (no mock-based tests; pure utilities only):
- `deriveAgeGroup(birthdate)` — age-band boundaries.
- `filterParametersByPosition(params, position)` — all-positions / null / match / no-match.
- `expandPositionGroup(group)` — CMS quick-group → canonical codes (e.g. קצה → [LW, RW]).
- progress aggregation (counts → percent).

## 12. Migrations & seeding

- One migration (timestamp format) creating all tables + RLS + indexes + the
  `book_drill_progress` streak trigger.
- Seed script: parse the three mockup HTML files into the normalized tables so editors start
  with full content. Position quick-group mapping lives in code config, not the DB.

## 13. Effort estimate (AI-assisted, dev familiar with the repo)

| Part | Days |
|------|------|
| Schema + RLS migration | 0.5–1 |
| Seed script (HTML → tables) | 1–1.5 |
| Trainee/parent rendering (accordion, tabs, drill card, parents page, filtering, progress UI) | 2–3 |
| CMS admin (3 screens + `RepeatableRows`) | 2.5–3.5 |
| Streak/achievement integration | 0.5–1 |
| Filtering utils + tests | 0.5 |
| Polish, RTL/mobile QA, revision buffer | 1–1.5 |
| **Total development** | **~8–12 focused days** |

## 14. Content dependencies (not development)

- **~40 premium drill cards** still need to be authored — only the 1v1-defense card exists in
  full. AI-drafted, trainer/Eden-approved. This is content work, parallel to development.
- One-time mapping/verification that `profiles.position` values are populated for active
  trainees (dashboard currently defaults `null` → CM).

## 15. Future (post-v1)

- Daily homework counters and trainer reporting on book progress.
- Optional trainer read-access to `book_drill_progress`.
- Linking parameters to existing assessment pillars ("your 1v1 score is X — work these drills").
