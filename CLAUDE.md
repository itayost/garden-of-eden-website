# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Hebrew (RTL) football academy platform. Manages trainees, trainers, and admin operations with assessments, progress tracking, nutrition plans, shift management, and workout submissions.

Production: <https://www.edengarden.co.il>

## Tech Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript** (strict)
- **Supabase** (Postgres + Auth + RLS) — WhatsApp OTP auth, three roles: trainee/trainer/admin
- **Tailwind CSS 4** + **Radix UI** (shadcn/ui based) + **Framer Motion**
- **Vercel** hosting, **Upstash Redis** for rate limiting
- **Meshulam** (Grow) payment gateway
- **Vitest** + React Testing Library (jsdom), **Playwright** for E2E
- **React Hook Form** + **Zod** validation

## Critical Rules

### 1. Code Organization

- Many small files over few large files (200-400 lines typical, 800 max)
- Organize by feature/domain: self-contained modules go in `src/features/<name>/`
- Shared code stays in `src/lib/` and `src/components/`
- Split large action files into focused files with a barrel re-export (e.g., `admin-users-create.ts`, `admin-users-update.ts` re-exported from `admin-users.ts`)

### 2. Code Style

- No emojis in code, comments, or docs
- Immutability always — never mutate objects or arrays
- All user-facing text in **Hebrew**, `dir="rtl"` on `<html>`
- Use logical CSS properties (`start`/`end`) instead of `left`/`right`
- Path alias: `@/` maps to `src/`

### 3. Security

- Never expose `SUPABASE_SERVICE_ROLE_KEY` to the client
- Admin actions call `verifyAdmin()`; trainer-accessible actions call `verifyAdminOrTrainer()`; user-scoped actions call `verifyUserAccess(userId)` — all from `src/lib/actions/shared/`
- Validate all IDs with `isValidUUID()` from `src/lib/validations/common.ts`
- Validate timestamps, ordering, durations server-side — never trust client validation alone
- Rate-limit sensitive endpoints via Upstash Redis
- Do not edit `.env.local` files (blocked by PreToolUse hook)

### 4. Testing

- No mock-based tests — the project uses real Supabase data
- Tests cover pure utility functions only (validations, ranking-utils, webhook-security)
- Write tests first for new utility functions

## Commands

```bash
npm run dev              # Start dev server
npm run build            # Production build
npm run lint             # ESLint
npm run test             # Vitest (watch mode)
npm run test:run         # Vitest (single run)
npm run test:coverage    # Vitest with coverage
npm run test:e2e         # Playwright E2E
npm run test:e2e:ui      # Playwright UI mode
npx tsc --noEmit         # Type check
```

### Deploy & Database

```bash
vercel                  # Preview deployment
vercel --prod           # Production deployment
supabase db push        # Push migrations to Supabase
npm run db:schema       # Refresh supabase/schema.sql from the live DB (read-only)
npm run db:types        # Regenerate src/types/database.generated.ts from the live DB
```

### Run a single test

```bash
npm run test:run -- path/to/file.test.ts      # Single file
npm run test:run -- -t "test name pattern"    # By name
```

## Architecture

### Auth & Role Verification

Middleware (`src/middleware.ts`) refreshes Supabase sessions and gates routes. Server actions guard access via shared verify functions that return a discriminated union `{ error, user, profile }` — early-return on `error`, then use `user!` for TS narrowing.

### Server Actions

All actions use `"use server"` and live in `src/lib/actions/` or `src/features/<name>/lib/actions/`. Input validation uses Zod schemas from `src/lib/validations/`.

### Supabase Clients (three variants — pick carefully)

- `createClient()` from `lib/supabase/client.ts` — **browser** client
- `createClient()` from `lib/supabase/server.ts` — **server** components/actions (uses cookies)
- `createAdminClient()` from `lib/supabase/admin.ts` — **service role**, bypasses RLS

DB helpers in `lib/supabase/helpers.ts`: `insertIntoTable`, `insertAndSelect`, `updateInTable`, `upsertIntoTable`. Row types come from `src/types/database.generated.ts`, written from production by `npm run db:types` (run it after every migration; never edit the file by hand). Hand-written aliases such as `Profile` live in `src/types/database.ts`. Every table is in the generated types, so new code uses the typed client; `typedFrom(supabase, "table_name")` returns `any` and stays only in older call sites.

### Storage

Single public bucket `avatars` stores avatars, meal plan PDFs, and other uploads. Path pattern: `{userId}/{type}/{timestamp}.{ext}`. File upload API routes follow the pattern in `src/app/api/images/` — FormData → auth check → rate limit → validate → `uploadToStorage()` → return URL.

### Shared Admin Components (reuse — don't recreate)

- `DeleteConfirmDialog` — standard delete confirmation
- `TablePagination` — paginated table footer
- `TableToolbar` with `ToolbarSelect`/`ToolbarCheckbox`/`ToolbarDateRange` — search + filter toolbar, parent owns state, toolbar handles debounce
- CSV exports in `src/components/admin/exports/` — Hebrew headers, BOM, Papa.unparse
- `BranchCheckboxGroup` from `src/features/branches/components/` — branch membership picker used by the user create and edit forms

The post-training report's trainer list is every active trainer and admin, loaded in its server page by `loadStaffOptions()` (`src/lib/staff-options.ts`, server-only; the service role, because trainees may not read staff profiles under RLS) and passed to the client form.

### Shared Hooks & Utilities

- `useFormSubmission` — form submit state + error handling
- `useIsMobile` / `useMediaQuery` — responsive breakpoints
- `calculatePercentile()` from `lib/utils/math.ts` — shared stats
- `calculateUserRatings()` from `lib/utils/calculate-user-ratings.ts` — dashboard ratings

### API Response & Error Handling

```ts
try {
  const result = await operation()
  return { success: true, data: result }
} catch (error) {
  console.error('Operation failed:', error)
  return { success: false, error: 'User-friendly Hebrew message' }
}
```

### Branches

`branches` + `profile_branches` (many-to-many). Trainer scope comes from `getBranchScopeAction()` in `src/lib/actions/shared/` and is applied in server queries through `visibleProfileIds()`; never rely on RLS for it. Schedule pages carry the branch in `?branch=` and hand it to dialogs through `BranchProvider` / `useCurrentBranch()`. Shifts store `branch_id`; rankings take a branch id. See `docs/adr/0006-branches-are-a-table.md`.

### קריית אתא signup

`/join` sells `plan_products`, records an `orders` row and a signed `enrollment_agreements` row, and sends the parent to Morning's hosted payment page. Only the signed webhook at `src/app/api/webhooks/morning/route.ts` marks an order paid; `src/features/enrollment/lib/fulfillment.ts` then creates the account, the branch link, and the `trainee_plans` row, and is safe to rerun. Plan state is derived, never stored: `resolvePlanQueue()` in `src/lib/plans/plan-queue.ts` walks a Trainee's training Plans in sale order (one Current plan, the rest queued behind it, ADR-0008) from each Plan's sale-time terms (`not_before`, `duration_days`, `sessions_total`, `fixed_ends_on` for Arbox); `starts_on`/`ends_on` are only a cached forecast. Every screen, booking, sale and the reminder cron read it through `loadPlanQueues()` / `loadStoredPlans()` in `src/features/plans/lib/queries.ts`; a new sale is placed by `placeNewPlan()`. Staff see every Plan through `planHistory()` (current, queued, then past) on the trainee page and the plan sheet; a staff-chosen start date is bounded by `startDateProblem()` (never backdated, at most 30 days ahead) and applied in fulfillment by `appliedStart()` only when nothing is current or queued (always for an Add-on). Production overlap check: `scripts/db/plan-overlaps.sql`. Void (`src/features/plans/lib/actions/void-plan.ts`, Admin or Branch manager, refused once a session is used) marks the Plan and order `voided`, writes a `plan_refunds` audit row, and runs the shrink rule: `shrinkImpact()` (`src/lib/plans/shrink.ts`) moves future Bookings to a Queued plan or cancels them latest first, not late, leaving the Trainee a `trainee_notices` banner. Void, Cancellation and Early end are each one transaction (`undo_plan` / `end_plan_early`, through `undoPlan()` in `src/features/plans/lib/undo-plan.ts`): the Plan, refund row, order, the shrink rule's cancellations (`cancel_shrunk_bookings`) and the activity record, under the per-trainee booking lock and `assert_trainee_unchanged`; the dialog sends back `readToken()` (`src/lib/plans/read-guard.ts`, next to `guardArgs()`, the one builder of the guard's arguments) and the act refuses if the roster or Plans moved since it was shown. Adjustment and Freeze still cancel through `applyShrinkAfter()` after their function commits. The system moves no money; staff issue the Morning credit note by hand and record its number. Cancellation (`src/features/plans/lib/actions/cancel-plan.ts`) ends the Plan today (`status = cancelled`, `ended_on`; the queue keeps it up to that day with its used sessions) and proposes the refund with `proposeRefund()` (`src/lib/plans/refund.ts`): within 14 days and before any session, all paid minus the fee; a Subscription or Term, the days left as a share of what was paid; a Card, paid minus used sessions at the branch's Single-session price (`branches.single_session_price_ils`, Admin-only, else the 10-Card rate) minus the fee. The fee is 5% or 100 ILS, whichever is lower, none for a defect; an override needs a reason. Early end (`src/features/plans/lib/actions/early-end.ts`) keeps the Current plan `active` with `ended_on = today` and the next queued Plan starts the same day; no order or refund changes, the reason goes to `activity_logs`. A past Slot (its start has passed) can be Called off by an Admin or Branch manager (`daily_schedule_slots.called_off_*`, `src/lib/actions/daily-schedule-called-off.ts`): its Roster stays and `rowCounts()` charges nobody on it, matched by `book_slot_checked`. Adjustment (`src/features/plans/lib/actions/adjust-sessions.ts`, Admin or Branch manager) sets a Card's Sessions left (total minus used minus future Bookings, the number every screen shows; Bookings keep their sessions) through `adjust_plan_sessions`, which takes the per-trainee booking lock, refuses if the roster or Plans changed since the action read them (the action itself refuses a dialog older than the Plan), and writes `plan_adjustments`; end-date changes write there too, with a reason. A Freeze (`src/features/plans/lib/actions/freeze.ts`, Admin or Branch manager, medical only) is a `plan_freezes` row on the Current plan, written by `freeze_plan` / `end_freeze` under the same lock and guard: the queue does not charge those days, moves the Plan's end and every Plan behind it by the frozen days, and an open-ended Freeze counts to today and holds every later date until it is ended; booking a frozen date is refused (`plan_frozen`) and no reminder goes out (`queue.frozen`). `freezeProblem()` (`src/lib/plans/freeze.ts`) bounds a new one. A Freeze is refused on an Arbox-paid Plan and while one is queued behind it (an Arbox end is fixed, so it would lose the days); those freeze in Arbox. Removing a name from a past Slot is recorded, not deleted (`removed_*` plus a non-late `cancelled_at`), by the Trainers who ran it or an Admin or Branch manager (`mayCorrectPastSlot()` in `src/lib/schedule/roster-entry.ts`). Spec: `docs/superpowers/specs/2026-09-10-kiryat-ata-signup-design.md`.
In the app a trainee never opens the agreement form: "בקשה מההורה" (`requestPurchaseLinkAction` in `src/features/plans/lib/actions/purchase-request.ts`, on the dashboard plan card, a buy card for trainees with no Plan, and the booking page) sends the parent `/join?renew=<token>`: the renewal link of the trainee's Plan, or, with no Plan, one bound to the trainee (`signTraineeToken()`, a `t-` subject in `src/lib/plans/renewal-token.ts`); 3 a day per trainee (`purchase_request` limiter, fails closed). It shows when `canAskParentToBuy()` (`src/features/plans/lib/can-ask-parent.ts`: online payments open, a branch in the /join catalog). Templates live on WABA 1992291924883900 (plan_confirmation, plan_reminder, booking_reminder, card_payment_link, plan_purchase_request, submitted 2026-10-06); Vercel production names them in the `WHATSAPP_*_TEMPLATE_NAME` vars. Where one is unset, staff send the confirmation by hand (`waShareUrl()` / `planConfirmedText()`).
Reminders: `/api/cron/plan-reminders` runs daily at 09:00 Israel time (cron at 06:00 and 07:00 UTC, `isReminderHour()` picks the right one across daylight saving); `dueReminder()` decides what is due at the end of the Plan queue (nothing while a Plan is queued, nothing for a queue ending on an Arbox purchase) and the `reminded_*_at` columns stop repeats. Renewal links are `/join?renew=<token>` signed with `PLAN_RENEWAL_TOKEN_SECRET`.
Staff payments: `recordManualPayment()` in `src/features/plans/lib/manual-payment.ts` is the one path for cash, transfer, Bit, and cheque (a cheque keeps its number in `reference` and its bank, branch and account in `orders.cheque_*`, all required by Morning's type-2 receipt; `chequeDetails()` in `src/lib/plans/cheque.ts`) (paid order with `payment_provider = manual`, an agreement with `signed_at NULL` that the parent signs from `/join/agreement/[id]?t=`, fulfillment, the Morning receipt through `issueOrderInvoice()`, the WhatsApp). Both the new-trainee sheet and the trainee payment sheet call it; trainers may use them for their branch. A Discount (Admin or the branch's manager: `SellableProduct.managed`, checked again by `discountRefusal()`; amount rule `discountProblem()` in `src/lib/plans/discount.ts`) sells below list price with a reason: `orders.amount_ils` is what was paid (receipt, agreement, refunds), `list_price_ils` / `discount_reason` / `discounted_by` record it, and `/admin/orders` lists discounts for Admins. A Plan given without charging is payment method `free` (any staff member, a required reason, an agreement and the WhatsApp, no Morning receipt): amount 0 (the only order the database allows at 0), its worth and reason in the Discount columns. `staffSalePrice()` (`src/lib/plans/staff-price.ts`) is the one pricing rule for catalog, Discount, manual Card and free. A Payment link (`createPaymentLinkAction` in `src/features/plans/lib/actions/payment-link.ts`, trainers too, only while online payments are open) is the sheet's "כרטיס אשראי" method: a pending card order bound to the trainee at a fixed amount (a Discount allowed), marked by `orders.payment_link_by` (who sent it; the Plan's `created_by` once paid, `source` stays online), with an unsigned agreement (`insertUnsignedAgreement()`); every staff order's price and people come from `staffOrderColumns()`; the parent signs at `/join/agreement/[id]?t=`, which goes on to `/join/pay/[orderId]` while the order `awaitsCard()`; `chargeOrderAction` charges only a signed order at a price that `capturedPriceHolds()`, and only `completeCardPayment()` makes it a sale. A manual Card (Admin or the branch's manager, the trainee payment sheet and Payment links only) sells the branch's inactive `staff_terms` product "כרטיסייה ידנית" on typed sessions, price and days (`manualCardProblem()` in `src/lib/plans/manual-card.ts`), kept on `orders.terms_sessions_total` / `terms_duration_days`, which fulfillment uses as the Plan's terms; the placeholder can never be activated, and a branch's first active catalog product creates it (trigger `plan_products_manual_card_placeholder`). Every screen and the confirmation name a manual Card by the terms its order was sold on: `orderPlanName()`, in `loadStoredPlans()` for Plans (an Adjustment does not rename it) and on the orders list. A new link closes the child's older unpaid links (status failed), so a parent can never pay twice. Template `WHATSAPP_PAYMENT_LINK_TEMPLATE_NAME` is optional until Meta approves it; the link can be copied. Staff surfaces: `loadPlanStatusesForStaff()` feeds the plan column on the users list and the פג/מסתיים chips in the calendar's roster sheet and the session-building list (tap opens the plan sheet); health data (medical notes, emergency contact) goes through `src/features/plans/lib/actions/trainee-health.ts`, which is branch-scoped. `/admin/safety` renders `content/safety-protocol.ts` with the branch manager phones.
Arbox purchases: `src/features/plans/lib/arbox-import.ts` imports each Arbox card or membership once, keyed `orders.provider_transaction_id = arbox:<membership_user_id>`; every purchase becomes a new Plan at the end of the Trainee's Plan queue with Arbox's sessions and Arbox's end date as `fixed_ends_on`; nothing is merged or extended (ADR-0008). The manual "Arbox" payment method is a repair tool for Admins and Branch managers only. Rules live in the pure `planArboxImports()` (`src/lib/plans/arbox-import-plan.ts`). Spec: `docs/superpowers/specs/2026-09-27-arbox-purchase-import-design.md`.

### Finance reports

Admin-only. `/admin/finance` is the income report: `buildIncomeReport()` (`src/features/finance/lib/income.ts`, pure) puts each counted order (`paid`, `refunded`, `voided`) on the Israel day of its `paid_at`, subtracts `plan_refunds` on their own day, keeps Arbox (`payment_method = 'arbox'`) in its own total, dated by `orders.arbox_purchased_on` (the Israel day of `paid_at` when unset); only paid Arbox sales count toward it (voided and refunded ones are listed, struck, and 1 ILS placeholders flagged and left out; a refund paid back in Arbox stays out too), counts card installments in full on the charge day, and gives each staff member's cash-up (cash, Bit, transfer, cheque, minus cash refunds they paid out; card links listed apart). `/admin/finance/ending-soon` lists queues ending within 7 days or cards-only with 2 or fewer sessions (`splitEnding()` in `src/features/finance/lib/ending-soon.ts`; staff thresholds, wider than the parent reminders; a cards-only queue sorts by sessions left through `urgencyDays()`: 0 like today, 1 like tomorrow, 2 like three days), plus queues that expired in the last 14 days; the call list falls back to the trainee's own phone when no parent phone is stored; the ending count (the page's 'כל המסתיימים', without the recently expired list) is the menu badge, cached 10 minutes under the `finance-ending-soon` tag and cleared by `revalidateStaffSurfaces()`. Loaders in `src/features/finance/lib/queries.ts` (service role, behind `verifyAdmin()`) page past PostgREST's 1000-row cap for the income loaders and the `trainee_plans` id read; ending-soon reads plan queues in chunks of 200 trainees and fails loudly if none come back. Branches that do not sell in the app (today חיפה) are left out with a note. Spec: `docs/superpowers/specs/2026-10-12-financial-reports-phase-1-design.md`.

### Self-booking (קריית אתא)

A weekly band marked `is_bookable` with `max_trainees` is projected into rosterless slots for the next 14 days by `/api/cron/materialize-slots` and on demand (`src/features/booking/lib/materialize.ts`, pure plan in `src/lib/schedule/materialization.ts`); a deleted projected slot leaves a tombstone. Trainees book through `bookSlotAction` / `cancelBookingAction` in `src/features/booking/lib/actions/book.ts`: timing rules live in `src/lib/schedule/booking-rules.ts` (14-day window, 3-hour cancel cutoff) and the plan side in `bookingVerdict()` (`src/lib/plans/plan-queue.ts`: Bookings are charged down the Plan queue in date order, 2 a week once a subscription or term plan runs); the seat is taken inside the `book_slot_checked` Postgres function, which takes a per-trainee lock, locks the slot row, and through `assert_trainee_unchanged` refuses if the trainee's counted roster rows or Plan stamps (`trainee_plans.updated_at`), passed by `guardArgs()`, changed since the verdict. The adjust functions run the same guard. Roster rows carry `source`, `booked_at`, `cancelled_at`, `late_cancel`; a late cancel still counts as a used session. Slot tables stay staff-only under RLS; trainee reads and writes go through server actions with the service role. See ADR-0007.
Staff screens: `/admin/calendar` is the booking calendar, with the standing week as its `/admin/calendar/template` tab (the old `/admin/weekly-schedule` redirects there) (roster per slot through `addSlotTraineeAction` / `removeSlotTraineeAction` in `src/lib/actions/daily-schedule-roster.ts`, never a whole-roster replace), and `/admin/schedule` is the session-building list derived by `buildSessionWorklist()` in `src/lib/schedule/session-worklist.ts`. Editing an existing slot's details sends no roster. The roster sheet also reads what each trainee was given: `getRosterSessionsAction()` fetches the day's sessions for that slot's roster on open, and a row expands to the exercise lines formatted by `src/lib/schedule/roster-exercise.ts`.

### Training history and retention

The trainee page's "היסטוריית אימונים" card and the users list's "ביומן ללא משתמש" search read the calendar roster through `src/features/training-history/` (service role, branch scoped); statuses and the grouping of names typed with no account are pure in `src/lib/schedule/training-history.ts`, counting by `rowCounts()`. `/admin/retention` shows two columns a month: חיפה is Arbox check-ins (the stored snapshot's `attendance`), קריות is קריית אתא calendar sessions; a player shows 0 at a branch they are assigned to (`profile_branches`) and a dash elsewhere. קריית אתא trainees whose Plan queue ends in the month and who are not in the Arbox list are added as "יומן" rows. The split is applied when the report is read (`loadRetentionView()` in `src/lib/arbox/retention-branches-load.ts`, pure `withBranchAttendance()`), never stored.

### Surveys

Staff send a Survey (סקר) to the Trainees of chosen branches, narrowed by birth year, who answer it in a popup. The seven tables (`surveys`, `survey_branches`, `survey_questions`, `survey_question_options`, `survey_views`, `survey_responses`, `survey_answers`; migration `20261029120000_surveys.sql`) are read and written only by server code with the service role: RLS is on with no policies and `anon`/`authenticated` have no grants. A Survey's Questions are replaced as a set by `save_survey_draft` (refused once a Response exists, `survey_has_responses`), and a Response with its answers is written in one step by `submit_survey_response`, which under the Survey's shared row lock checks it is published, not closed and today in Israel is inside `opens_on..closes_on` (`survey_not_open`), computes the branch snapshot itself from `profile_branches` (`survey_responses.branch_ids`; `not_in_audience` if none), checks each answer's Question and kind (`survey_changed`), refuses a second Response (`already_answered`) and records Seen; that an option belongs to its own Question is the deferred composite foreign key `survey_answers_option_of_question`, which fails at commit. `submitSurveyResponseAction` re-checks sign-in, the rate limit, the open state and the Audience first (`loadAnswerableSurvey()`, `answersProblem()` in `src/features/surveys/lib/answers.ts`). The Audience is the active, not deleted, full-access trainees of the Survey's branches, by birth year when any are named (`inSurveyAudience()` in `audience.ts`; the age-group override is ignored on purpose). Response rates are measured against Seen (`survey_views`, written once per Trainee by `markSurveySeenAction` when the popup opens; an answer counts as Seen too), never against the Audience: the nightly Arbox sync makes an account for every client who ever had a phone and nothing says who trains now, so the Audience includes former clients and "answered out of the Audience" would mean nothing. Trainee side: `SurveyPromptLoader` is mounted in the trainee layout (`src/app/dashboard/layout.tsx`, its own Suspense, renders nothing while the onboarding tour is due) and `SurveyPrompt` opens the one Survey `pickSurveyToOffer()` picks (earliest close date) once per page visit, not on mid-activity pages (`surveyPromptAllowedOn()`: a workout, scan, form or course lesson), and not after "אחר כך", which snoozes that Survey for the Israel day in localStorage (`goe_survey_snooze_<id>`, `snooze-storage.ts`); it keeps the Survey it was first given, so a send never opens a second popup in the same visit. `OpenSurveysCard` on the dashboard lists the open ones and opens the same popup; both read through `loadTraineeOffers()`.
Staff screens, Admins and Branch managers only (nav flag `adminOrManager` in `src/lib/navigation/admin-nav.ts`, `requireSurveyStaff()` in every action): `/admin/surveys` is the list (state filter, answered out of Seen per row), `/admin/surveys/new` and `/admin/surveys/[surveyId]/edit` the builder, which becomes a locked editor once a Response exists (title, intro and close date only, `updateSurveyDetailsAction`; a Survey closed early takes no change at all), and `/admin/surveys/[surveyId]` the results answer grid (segment, branch, birth-year and name filters in the URL, a sheet per Question, CSV through `csvDownloadText()`). Permissions are pure in `permissions.ts`: `canEditSurvey()` needs an Admin or a manager of every branch in the Audience, a manager views a Survey if they manage any of its branches, and `visibleSurveyBranches()` narrows what a manager sees to their branches (null for an Admin). The pure rules (state, audience, offer, permissions, report, answers, draft, csv) live in `src/features/surveys/lib/`, loaders in `queries.ts`, one action per concern in `lib/actions/`; the list's counts and the results page's totals both come from `surveyTotals()` in `report.ts`, so a row and the page it opens always agree. Spec: `docs/superpowers/specs/2026-10-29-surveys-design.md`.

### Migrations

Two formats coexist in `supabase/migrations/`:

- Legacy: `002_player_stats.sql`
- Current: `20260201131812_description.sql` (Supabase timestamp format)

Both work — don't renumber old ones.

### Database schema snapshot

`supabase/schema.sql` is a local, gitignored snapshot of the production database: every `public` table with its columns, constraints, indexes, RLS policies, triggers, and grants, plus views, functions (and who may execute them), enums, storage buckets and policies, and triggers on `auth` tables. It stays out of git because the repo is public. If it is missing or stale, run `npm run db:schema` (a read-only catalog query through `supabase db query --linked`; no Docker, no DB password), then read it instead of querying the cloud. Never edit it by hand. Schema changes still go through `supabase/migrations`, which stay the change history. Where a migration and the snapshot disagree, the snapshot is what production runs.

## Gotchas

- **Supabase client import ambiguity**: Both `client.ts` and `server.ts` export `createClient()`. Wrong import = cryptic cookie errors. Double-check when moving code between client/server.
- **RLS silently rejects admin-on-behalf-of inserts**: Existing INSERT policies usually require `auth.uid() = owner_id`. When an admin inserts a row for *another* user (e.g., shift for trainer), you need a separate admin INSERT policy — otherwise the insert fails silently.
- **`.update().eq()` on nonexistent rows**: Returns no error, updates zero rows. Pre-check existence with `.maybeSingle()` if the action reports "not found".
- **Long `.in()` lists**: PostgREST puts `.in()` values in the request URL, and Supabase answers 400 to a query string past about 24,800 characters (about 640 uuids). Every staff list returned empty for trainers in both branches on 2026-10-21 for this reason. Read a scope-sized or all-trainee id list through `readInChunks()` (`src/lib/supabase/in-chunks.ts`), which also pages past PostgREST's 1000-row cap. Sort the joined rows with `byFullName` / `newestFirst`.
- **Dialog edit state staleness**: `useState(prop)` only runs on mount. For edit dialogs receiving different data via props, pass `key={item.id}` to force remount.
- **`"use client"` boundaries**: Radix components require client rendering. Extract small interactive parts into client components and keep pages as server components when possible.
- **RTL in Framer Motion**: `x` translations and CSS `left`/`right` are mirrored. Test both directions.
- **Nutrition meal plans**: `trainee_meal_plans` uses PDF upload (`pdf_url`, `pdf_path`). The legacy JSONB `meal_plan` column is unused for new entries.
- **DB trigger auto-creates profiles**: `on_auth_user_created` runs on `auth.users` insert — don't manually insert into `profiles` after `auth.admin.createUser()`.
- **profile_branches is readable only by its owner and admins**: trainer-facing surfaces read memberships through `src/features/branches/lib/memberships.ts` with the service role, inside actions gated by `verifyAdminOrTrainer()`.

## Environment Variables

See `.env.local.example`. Required:

```text
NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_SITE_URL
GROW_PAGE_CODE, GROW_API_URL, GROW_WEBHOOK_SECRET, GROW_PROCESS_TOKEN
REMOVEBG_API_KEY
UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
CRON_SECRET
```

`PLAN_RENEWAL_TOKEN_SECRET` signs renewal and agreement links and must be set in production; the app starts without it but those links throw. The card is charged on `/join/pay/[orderId]` through Pelecard's Services API (the gateway; Isracard is the acquirer), in `src/lib/payments/pelecard.ts` with the pure mapping in `pelecard-mapping.ts` (`PELECARD_TERMINAL`, `PELECARD_USER`, `PELECARD_PASSWORD`, optional `PELECARD_API_URL`, default production `gateway21`; refuses politely until set). Orders keep `payment_provider = isracard`. An unknown outcome (timeout, status 308) leaves the order in `charging`; the admin's "בדיקה מול פלאקארד" button on `/admin/orders` (`reconcileChargingOrderAction`) looks it up with GetCompleteTransData by paramX and amount, then completes it through `completeCardPayment()` or, after 10 minutes with no charge, returns it to pending. `/join` and the card page stay closed behind a WhatsApp notice until `ONLINE_PAYMENTS=on` (`src/lib/payments/online-payments.ts`); admins pass before that, for the first live charge, and the server actions check it too. The card page gets an enforced nonce CSP from `src/middleware.ts` (`src/lib/security/payment-csp.ts`); card attempts are capped at 5 per order per 24 hours (`payment_order` limiter, fails closed). Morning only issues the document. Optional until the payment provider is wired: `MORNING_ENV`, `MORNING_CLIENT_ID`, `MORNING_CLIENT_SECRET`, `MORNING_WEBHOOK_SECRET`. Without them `/join` shows a Hebrew notice instead of a payment page.

`ARBOX_IMPORT_PURCHASES=on` turns on the nightly import of Arbox cards and memberships into קריית אתא plans (fourth step of `/api/cron/arbox-sync`); preview with `npx tsx scripts/import-arbox-purchases.ts --dry-run`.

Startup validation in `src/lib/env.ts` (called via `src/instrumentation.ts`) fails fast if any required var is missing.

## Claude Code Automations

### Hooks (`.claude/settings.json`)

- **PreToolUse**: Blocks editing `.env*` files (exit code 2)
- **PostToolUse**: Auto-runs ESLint fix on edited JS/TS files
- **PostToolUse**: Runs `tsc --noEmit` type-check on edited `.ts/.tsx`

### Skills

- `/deploy` — Type-check, build, and deploy to Vercel production
- `/migration` — Create and apply a Supabase migration with RLS validation

### Agents

- `code-reviewer` — Security (RLS, auth), TypeScript errors, convention violations
- `security-reviewer` — Deep security audit: RLS gaps, auth verification, service-role exposure, webhook security

## Agent skills

### Issue tracker

GitHub Issues on `itayost/garden-of-eden-website`, via the `gh` CLI. External PRs are not a triage surface. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` and `docs/adr/` at the repo root, both created lazily. See `docs/agents/domain.md`.

## Git Workflow

Conventional commits with feature scope: `feat(auth):`, `fix(admin):`, `refactor(nutrition):`. Keep scope to the feature area (auth, admin, mobile, nutrition, shifts, etc.).
