<!-- Generated: 2026-06-22 | Files scanned: 545 | Token estimate: ~980 -->

# Backend Architecture

## API Routes (src/app/api/)

```
CRON JOBS (require CRON_SECRET header):
GET  /api/cron/arbox-sync                  02:00 daily — Arbox user sync
GET  /api/cron/auto-clockout               */10 min   — Auto clock-out stale shifts
GET  /api/cron/recalculate-benchmarks      03:00 daily — Age group benchmark recalc
GET  /api/cron/backfill-rating-snapshots   03:30 daily — Backfill rating snapshots
GET  /api/cron/retention-report            04:00 daily — Retention report snapshot
GET  /api/cron/welcome-dispatch            06:00 daily — New-user welcome messages
GET  /api/cron/reset-next-games            01:00 daily — Reset next-game entries
GET  /api/cron/cleanup-expired-clips       01:15 daily — Delete expired video clips

HEALTH & REPORTS:
GET  /api/health                           Health check
POST /api/player-report/pdf               Generate player stats PDF (admin/trainer)

IMAGE PROCESSING:
POST /api/images/process-background        Remove.bg FIFA card processing
POST /api/images/upload-original           Upload original image
POST /api/images/upload-trainee-images     Bulk trainee image upload

NUTRITION:
POST /api/nutrition/upload-pdf             Upload meal plan PDF to Storage (avatars bucket)

PAYMENTS:
POST /api/payments/create                  Meshulam payment page creation

SHIFTS:
POST /api/shifts/sync                      Sync shift data from external source

WEBHOOKS:
POST /api/webhooks/grow                    Meshulam payment webhook (HMAC-SHA256)
POST /api/webhooks/leads                   Lead capture webhook; supports tab_slug routing

CLIPS:
POST /api/clips/upload                     Video clip upload

WHATSAPP:
POST /api/whatsapp/flow                    WhatsApp Business flow endpoint

AUTH:
GET  /auth/callback                        Supabase auth callback (OTP verification)
```

## Server Actions (src/lib/actions/)

```
Admin — Users (verifyAdmin()):
  admin-users-create.ts    Create user (auth + profile)
  admin-users-update.ts    Update user profile/role
  admin-users-delete.ts    Soft-delete user
  admin-users-bulk.ts      Bulk operations (import CSV)
  admin-users.ts           Barrel re-export

Admin — Assessments:
  admin-assessments.ts         CRUD player assessments
  admin-assessments-month.ts   Monthly filter
  admin-assessments-list.ts    List/filter assessments

Admin — Leads CRM (barrel: admin-leads.ts):
  admin-leads-list.ts          getLeadsAction, getLeadByIdAction, getLeadsStatsAction
  admin-leads-create.ts        createLeadAction
  admin-leads-update.ts        updateLeadAction, updateLeadStatusAction
  admin-leads-delete.ts        deleteLeadAction
  admin-leads-contact.ts       addContactLogAction, getContactLogAction
  admin-leads-whatsapp.ts      sendWhatsAppFlowAction, sendWhatsAppTextAction
  admin-leads-bulk.ts          createLeadsBulk (paste-from-Sheets importer)

Admin — Lead Tabs (admin-lead-tabs.ts):
  listLeadTabsAction, createLeadTabAction, updateLeadTabAction,
  reorderLeadTabsAction, deleteLeadTabAction, assignLeadToTabAction

Admin — Retention (admin-retention.ts):
  getRetentionReportMonths, getRetentionReport, getRetentionNotes,
  upsertRetentionNote, setRetentionTrainer, refreshRetentionReport

Admin — Churned Customers (admin-churned-customers.ts):
  listChurnedCustomers, createChurnedCustomer, createChurnedCustomersBulk,
  updateChurnedCustomer, deleteChurnedCustomer

Admin — Other:
  admin-videos.ts              Manage training videos
  admin-submissions-list.ts    List form submissions
  admin-images.ts              Image management
  admin-gdpr.ts                GDPR data export/deletion
  admin-user-notes.ts          Admin notes on users
  admin-trainers-list.ts       List trainers
  admin-next-games-list.ts     getUpcomingGames, getUserNextGameForAdmin

Trainer / Admin (verifyAdminOrTrainer()):
  trainer-shifts.ts            clockInAction, clockOutAction, adminCreateShiftAction,
                                adminEditShiftAction, setShiftOtherPurposeAction,
                                markShiftReviewedAction, deleteShiftAction, + 4 more
  shift-change-requests.ts     submitShiftChangeRequestAction, cancelShiftChangeRequestAction,
                                getMyShiftChangeRequestsAction, approveShiftChangeRequestAction,
                                rejectShiftChangeRequestAction, + 2 more

User-facing:
  trainee-communication-log.ts getCommunicationNotes, addCommunicationNote, deleteCommunicationNote
  complete-onboarding.ts       Complete onboarding flow
  video-progress.ts            Track video watch progress
```

## Feature Actions (src/features/*/lib/actions/)

```
achievements/          get-achievements, grant-badge, grant-assessment-badges
clips/                 clips (CRUD)
goals/                 get-goals, set-goal, delete-goal
next-game/             next-game (get/set)
nutrition/             get-nutrition-data, upsert-recommendation, upsert-meal-plan-pdf,
                       delete-meal-plan-pdf, create-measurement, get-trainee-measurements,
                       update-measurement, soft-delete-measurement
onboarding-tour/       complete-tour, reset-tour, update-nutrition-status
player-assessments/    record-assessment
player-report/         get-report-data, save-summary
rankings/              get-rankings
streak-tracking/       get-streak
```

## Auth & Verify Helpers (src/lib/actions/shared/)

```
verifyAdmin()           shared/verify-admin.ts     → { error, user, profile }
verifyAdminOrTrainer()  shared/verify-admin.ts     → { error, user, profile }
verifyUserAccess(uid)   shared/verify-user-access.ts → { error, user, profile }
```

## Supabase Clients & DB Helpers

```
createClient()       src/lib/supabase/client.ts    Browser (anon key)
createClient()       src/lib/supabase/server.ts    Server components/actions (cookies)
createAdminClient()  src/lib/supabase/admin.ts     Service role (bypasses RLS)

helpers.ts:
  typedFrom(supabase, "table")  Type-safe access for tables missing from generated types
  insertIntoTable()             Generic insert
  insertAndSelect()             Insert + return row
  updateInTable()               Generic update
  upsertIntoTable()             Generic upsert
```

## External Integrations (src/lib/)

```
arbox/
  client.ts               Arbox API client
  sync.ts                 User sync logic
  retention.ts            Retention report builder; merges Arbox pull into stored snapshot
  persist-retention-report.ts  Freeze/upsert retention snapshots
  normalize-phone.ts      Phone normalization
  reports.ts              Report generation
  constants.ts            Arbox constants

grow/                     Meshulam payment gateway client
whatsapp/                 WhatsApp Business client + encryption
exports/                  CSV/PDF export utilities (Hebrew headers, BOM, Papa.unparse)
webhook-security.ts       HMAC-SHA256 webhook verification
rate-limit.ts             Upstash Redis rate limiter
env.ts                    Startup env validation (fails fast on missing vars)
```
