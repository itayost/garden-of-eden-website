<!-- Generated: 2026-03-10 | Files scanned: 404 | Token estimate: ~900 -->

# Backend Architecture

## API Routes (src/app/api/)

```
POST /api/cron/arbox-sync       -> Nightly Arbox user sync (CRON_SECRET)
POST /api/cron/auto-clockout    -> Auto clock-out stale shifts (CRON_SECRET)
GET  /api/health                -> Health check

POST /api/images/process-background   -> Remove.bg FIFA card processing
POST /api/images/upload-original      -> Upload original image
POST /api/images/upload-trainee-images -> Bulk trainee image upload

POST /api/nutrition/upload-pdf  -> Upload meal plan PDF to Storage

POST /api/payments/create       -> Meshulam payment page creation

POST /api/shifts/sync           -> Sync shift data

POST /api/webhooks/grow         -> Meshulam payment webhook (HMAC-SHA256)
POST /api/webhooks/leads        -> Lead capture webhook

POST /api/whatsapp/flow         -> WhatsApp Business flow endpoint

GET  /auth/callback             -> Supabase auth callback (OTP verification)
```

## Server Actions (src/lib/actions/)

```
Admin Actions (require verifyAdmin()):
  admin-users-create.ts      Create user (auth + profile)
  admin-users-update.ts      Update user profile/role
  admin-users-delete.ts      Soft-delete user
  admin-users-bulk.ts        Bulk operations (import CSV, etc.)
  admin-assessments.ts       CRUD player assessments
  admin-assessments-list.ts  List/filter assessments
  admin-videos.ts            Manage training videos
  admin-player-stats.ts      Player stats management
  admin-submissions-list.ts  List form submissions
  admin-images.ts            Image management
  admin-gdpr.ts              GDPR data export/deletion
  admin-user-notes.ts        Admin notes on users
  admin-leads-*.ts           Lead CRM (create, update, delete, list, contact, whatsapp)

Trainer Actions (require verifyAdminOrTrainer()):
  trainer-shifts.ts          Clock in/out, shift reports

User Actions:
  complete-onboarding.ts     Complete onboarding flow
  video-progress.ts          Track video watch progress
```

## Auth Middleware Chain

```
Request -> middleware.ts -> updateSession() -> route handler
  verifyAdmin()           src/lib/actions/shared/verify-admin.ts
  verifyAdminOrTrainer()  src/lib/actions/shared/verify-admin.ts
  verifyUserAccess()      src/lib/actions/shared/verify-user-access.ts
```

## Supabase Clients

```
createClient()       src/lib/supabase/client.ts    Browser (anon key)
createClient()       src/lib/supabase/server.ts    Server components/actions (cookies)
createAdminClient()  src/lib/supabase/admin.ts     Service role (bypasses RLS)
```

## DB Helpers (src/lib/supabase/helpers.ts)

```
typedFrom(supabase, "table")  Type-safe table access for untyped tables
insertIntoTable()             Generic insert
insertAndSelect()             Insert + return
updateInTable()               Generic update
upsertIntoTable()             Generic upsert
```

## External Integrations

```
src/lib/arbox/       Arbox API client, sync logic, phone normalization
src/lib/grow/        Meshulam payment gateway client
src/lib/whatsapp/    WhatsApp Business client, encryption, flow constants
src/lib/webhook-security.ts  HMAC-SHA256 webhook verification
src/lib/rate-limit.ts        Upstash Redis rate limiter
src/lib/env.ts               Startup env validation (via instrumentation.ts)
```
