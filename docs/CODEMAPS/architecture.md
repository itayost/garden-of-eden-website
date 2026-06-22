<!-- Generated: 2026-06-22 | Files scanned: 545 | Token estimate: ~820 -->

# Architecture Overview

## System Type
Single Next.js 16 app (App Router) with Supabase backend, deployed on Vercel.
Hebrew RTL football academy platform. Three roles: trainee, trainer, admin.

## High-Level Data Flow

```
Browser (React 19)
  |
  |-- Server Components (read data via Supabase server client)
  |-- Server Actions ("use server" in src/lib/actions/)
  |-- API Routes (src/app/api/)
  |
  v
Middleware (src/middleware.ts)
  -> updateSession() -> Supabase session refresh + route protection
  |
  v
Supabase (Postgres + Auth + Storage + RLS)
  |
  +-- Auth: WhatsApp OTP via Supabase Auth
  +-- Storage: avatars bucket (public) - avatars, PDFs, images
  +-- RLS: all tables protected
  |
External Services:
  +-- Vercel (hosting, cron, analytics)
  +-- Upstash Redis (rate limiting)
  +-- Meshulam/Grow (payments + webhooks)
  +-- Remove.bg (FIFA card image processing)
  +-- Arbox (user sync + retention reports)
  +-- WhatsApp Business (flow endpoint)
```

## Auth Flow

```
Login -> WhatsApp OTP -> Supabase Auth -> Session cookie
  -> Middleware refreshes session on each request
  -> Optional 2FA (src/app/auth/verify-2fa/)
  -> New users -> Onboarding (src/app/onboarding/profile/)
  -> DB trigger `on_auth_user_created` auto-creates profile
```

## Role-Based Access

```
/admin/*      -> verifyAdmin() or verifyAdminOrTrainer()
/dashboard/*  -> authenticated trainees (+ trainers with limited views)
/auth/*       -> public
/             -> public landing page
```

## Key Directories

```
src/app/           Pages + API routes (App Router)
  admin/           assessments, leads, nutrition, reports, retention,
                   shifts, submissions, upcoming-games, users, videos
  api/             clips, cron, health, images, nutrition, payments,
                   player-report, shifts, webhooks, whatsapp
  dashboard/       trainee views: assessments, forms, nutrition,
                   rankings, settings, videos
  auth/            login, verify-2fa
  onboarding/      profile setup

src/components/
  admin/           AdminSidebar, TableToolbar, TablePagination,
                   DeleteConfirmDialog, exports/; sub-dirs:
                   assessments, leads, nutrition, retention,
                   shift-report, shifts, submissions, users, videos
  dashboard/       trainee UI components
  landing/         public page components
  ui/              shared primitives (shadcn/ui based)

src/features/      13 self-contained modules:
                   achievements, assessment-comparison, clips,
                   form-drafts, goals, next-game, nutrition,
                   onboarding-tour, player-assessments, player-report,
                   progress-charts, rankings, streak-tracking

src/lib/actions/   32 server action files (admin-*, trainer-*, user-facing)
src/lib/supabase/  DB clients (client.ts, server.ts, admin.ts, helpers.ts)
src/lib/validations/ Zod schemas per entity
src/hooks/         Shared React hooks
src/types/         TypeScript type definitions
supabase/migrations/ 66 DB migrations (legacy NNN_ + timestamp format)
```

## New since 2026-05-26

### Leads CRM Expansion
- `lead_tabs` table + dynamic tabs UI: `LeadTabsManager`, `LeadTabFormDialog`, `LeadTabDeleteDialog`, `LeadTabBadge`, `LeadsTabs`
- Paste-from-Sheets bulk importer: `PasteLeadsDialog`, `parse-leads-paste`, `admin-leads-bulk.ts`
- New lead fields: `club`, `birth_year`, `additional_info`, `assigned_trainer_id`; phoneless leads; source as acquisition channel
- Leads webhook supports `tab_slug`; per-tab counts; CSV export
- Actions: `admin-lead-tabs.ts`, `admin-leads-bulk.ts`

### Retention
- `retention_reports` + `retention_notes` tables; `churned_customers` tab (+ `assigned_trainer_id` + auto `updated_at` trigger)
- Assigned-trainer + last-updated columns on retention tables
- Freeze past-month reports; merge fresh Arbox pull into stored snapshot
- Components: `ChurnedCustomersTab`, `PasteChurnedDialog`, `RetentionNoteCell`
- Action: `admin-churned-customers.ts`; `admin-retention.ts`

### Shifts
- `trainer_shifts.other_purpose_minutes` / `other_purpose_category` + `ShiftOtherPurposeDialog` + `setShiftOtherPurposeAction`
- `shift_change_requests` table + UI (trainer edit-request -> admin approve/reject): `EditShiftRequestDialog`, `ApproveRequestDialog`, `RejectRequestDialog`, `ShiftRequestsAdminPanel`
- Shift report communication questions: `homework` / `video_feedback` / `praise` per-trainee
- Action: `shift-change-requests.ts`

### Users
- `trainee_communication_log` table + action `trainee-communication-log.ts`

### Nutrition
- `nutrition_measurements` table (per-visit body data)
- `trainee_meal_plans` two plan types (workout-day + rest-day PDFs)
- `avatars` bucket policy extended to allow PDF uploads
