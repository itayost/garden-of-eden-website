# קריית אתא self-service signup, Morning payments, in-house plans

Date: 2026-09-10
Status: approved design, awaiting implementation plan
Depends on: the branches feature (`2026-09-10-branches-design.md`, PR #27)

## Problem

Trainees of the new קריית אתא branch are not in Arbox. They must be able to
sign up and pay on the website, receive a tax document from Morning
(morning.co, formerly Green Invoice), and have their membership plan tracked
by the site itself: what they bought, until when, and how many sessions are
left. חיפה keeps running on Arbox and is out of scope.

## Facts that shaped the design

- Morning's hosted payment form (`POST /payments/form`) takes one-off
  payments and creates the receipt itself. Charging a saved card exists in the
  API, but nothing in the API saves a card during checkout and there is no
  standing-order endpoint. Standing orders are a manual feature in Morning's
  UI. Morning's own clearing is provided by Grow.
- The repo has a complete but unused Grow (Meshulam) integration and a
  `payments` table with no migration. Neither is reused.
- There is no self-registration: login refuses unknown phones
  (`shouldCreateUser: false`). Accounts are born from admin actions or the
  nightly Arbox sync. The `on_auth_user_created` trigger creates the profile.
- The only messaging channel is WhatsApp Cloud API with Meta-approved
  templates. There is no email provider. Morning emails documents itself when
  the client has an email.
- Access tier (`full` / `course_only`) is an Arbox mirror enforced in
  middleware only, and fails open.

## Decisions already made with the owner

| Question | Decision |
|---|---|
| Catalog | Seven products from the price sheet: מנוי חודשי 850 (2 sessions a week, 30 days); חבילת היכרות 360 (4 sessions, new players only); כרטיסייה 10 at 1,250 (14 weeks); כרטיסייה 20 at 2,000 (28 weeks); מתקדמים 4 חודשים 3,200 (120 days, gift: one nutrition or mental session); מנטלי + תזונה + טקטי 350 monthly (30 days) or 250 one-off |
| Buyer and account | The parent signs the child up with two phones: a payer phone for the payment and receipt, and a WhatsApp phone that becomes the child's login. The account is created only after a confirmed payment |
| Renewal | Month by month. Every charge is a one-off Morning payment page reached from a WhatsApp reminder link. No auto-renew |
| Session counting | Roster presence on the daily board counts automatically. A trainee on a slot dated inside the plan window uses one session |
| Expiry | Reminders only. Nothing is blocked; the app shows the status |
| Integration | Morning end to end. Grow stays dormant |

## Section 1: Data model

One migration, Supabase timestamp format. Nothing reuses the dormant
`payments` table.

### `plan_products`

The catalog, scoped by branch.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `branch_id` | uuid references branches | קריית אתא for all seeded rows |
| `slug` | text unique | `monthly`, `intro_pack`, `card_10`, `card_20`, `term_4_months`, `addon_monthly`, `addon_single` |
| `name_he` | text | |
| `blurb_he` | text null | The small print from the sheet ("כ-106 ₪ לאימון") |
| `kind` | text check in (`subscription`, `session_card`, `term`, `addon`) | |
| `price_ils` | numeric(10,2) | |
| `sessions_total` | integer null | 4, 10, 20, 1 for the one-off add-on, null for time-based plans |
| `duration_days` | integer | 30 monthlies, 98 and 196 cards, 120 term, 30 addon monthly, 30 addon single |
| `once_per_trainee` | boolean | true for the intro pack |
| `gift_he` | text null | "מפגש תזונה אישי או מפגש מנטלי אישי" on the term plan |
| `is_active` | boolean | |
| `order_index` | integer | |
| timestamps | | |

Seeded in the migration with the seven rows above.

### `orders`

One row per checkout attempt.

| Column | Notes |
|---|---|
| `id` uuid pk | Sent to Morning as `custom` |
| `product_id`, `branch_id` | |
| `status` text check in (`pending`, `paid`, `failed`, `expired`) | `expired` is set by the reminder cron after 24 hours pending |
| `amount_ils` numeric(10,2), `currency` text default `ILS` | Snapshot of the price at checkout |
| `parent_name`, `payer_phone`, `login_phone` | Phones stored E.164 (+972) |
| `child_name`, `child_birthdate` | |
| `email` text null | Passed to Morning so the receipt is emailed |
| `profile_id` uuid null | Set by fulfillment |
| `renewal_of_plan_id` uuid null references trainee_plans | |
| `morning_payment_url` text null | |
| `morning_transaction_id` text null unique | Idempotency key for the webhook |
| `morning_document_id`, `morning_document_url` text null | From `document/created` |
| `raw_webhook` jsonb null | |
| `paid_at`, `fulfilled_at` timestamptz null | |
| `fulfillment_error` text null | Visible and retryable in the admin |
| timestamps | |

### `trainee_plans`

The entitlement.

| Column | Notes |
|---|---|
| `id` uuid pk | |
| `profile_id`, `product_id`, `branch_id` | |
| `order_id` uuid null | Null for manual grants |
| `starts_on`, `ends_on` date | `ends_on = starts_on + duration_days - 1` |
| `sessions_total` integer null | Snapshot from the product |
| `status` text check in (`active`, `cancelled`) | Expiry is derived, never stored |
| `source` text check in (`online`, `manual`) | |
| `note` text null | For manual grants: "מזומן", "העברה" |
| `reminded_3_days_at`, `reminded_last_session_at`, `reminded_expired_at` timestamptz null | One reminder per milestone |
| `created_by` uuid null | Admin for manual grants |
| timestamps | |

Sessions used are never stored. They are counted on read: rows in
`daily_schedule_slot_trainees` for this trainee whose slot is in the plan's
branch and dated between `starts_on` and today inclusive. Future dates do not
count.

### `morning_webhook_events`

| Column | Notes |
|---|---|
| `delivery_id` text pk | Morning's `x-webhook-delivery-id` |
| `topic` text | `payment/received`, `document/created` |
| `payload` jsonb | |
| `order_id` uuid null | Resolved from `custom` |
| `received_at`, `processed_at` timestamptz | |
| `error` text null | |

### `profiles`

Adds `guardian_name text null` and `guardian_phone text null`. Both go in
`enforce_profile_column_guard()` so a trainee cannot change who gets billed.

### RLS

- `plan_products`: SELECT for everyone including anon (the public page reads
  it). Writes admin only.
- `orders`, `morning_webhook_events`: no policies for authenticated users
  except admin SELECT. All writes through the service role.
- `trainee_plans`: SELECT where `profile_id = auth.uid()` or admin. Writes
  admin only. Trainers read through the service role in gated actions.

## Section 2: Purchase flow

### Public page

`/join` (Hebrew, RTL, no login). Lists active קריית אתא products from
`plan_products`. Picking one opens the signup form:

- parent name, payer phone, WhatsApp login phone, child name, child
  birthdate, email (optional, for the receipt), terms checkbox
- a renewal link prefills every field and locks the product

The existing landing page and its חיפה prices are untouched.

### Start checkout

Server action `startCheckoutAction(input)`:

1. Zod validation with Hebrew messages. Both phones normalized to +972 with
   the existing `formatPhoneToInternational`.
2. Rate limit with the existing `paymentLimiter` (fails closed).
3. Product must be active and belong to קריית אתא.
4. Intro pack rule: refused when any paid order with `once_per_trainee`
   exists for the same login phone.
5. Insert a pending `orders` row with the price snapshot.
6. Call Morning `POST /payments/form`: `type` from `MORNING_DOCUMENT_TYPE`
   (320 חשבונית מס/קבלה by default), `amount`, `currency ILS`, `vatType 0`,
   `lang he`, `description` = product name, `client` = parent name, payer
   phone as `mobile`, `emails` = [email] when given, `add: true`, `custom` =
   order id, `successUrl` = `/join/success?order=<id>`, `failureUrl` =
   `/join/failed?order=<id>`, `notifyUrl` = `/api/webhooks/morning/notify`.
7. Store `morning_payment_url` and redirect the parent to it.

### Confirmation

`POST /api/webhooks/morning` is the only path that marks an order paid.

- Verify `x-webhook-signature` as HMAC-SHA256 over the raw body with
  `MORNING_WEBHOOK_SECRET`, constant-time compare. Reject with 401 otherwise.
- Insert into `morning_webhook_events` keyed by `x-webhook-delivery-id`. A
  duplicate delivery is acknowledged with 200 and ignored.
- `payment/received`: resolve the order from `custom`. If the order is
  pending, set `paid`, `paid_at`, `morning_transaction_id`, `raw_webhook`,
  then run fulfillment. If the transaction id is already on another order,
  acknowledge and log.
- `document/created`: attach `morning_document_id` and the Hebrew download
  link to the order matched by `custom`.
- `POST /api/webhooks/morning/notify` (Morning's `notifyUrl`): the body is
  undocumented. Log it and return 200. Never fulfill from it.

`/join/success` polls the order status through a server action for up to 60
seconds, then shows "אישור התשלום יגיע בוואטסאפ".

### Fulfillment

Idempotent per order (`fulfilled_at` set means done):

1. Find a profile whose auth phone equals the login phone. If none, create
   the auth user with `phone_confirm: true` so OTP login works immediately;
   the trigger creates the profile row.
2. Update the profile: `full_name` = child name (only when empty),
   `birthdate` (only when empty), `guardian_name`, `guardian_phone`,
   `role` trainee, `profile_completed` true.
3. Link the profile to קריית אתא with `replaceProfileBranches(..., { stampAdmin: true })`
   preserving any existing branches, so a חיפה trainee gains a second branch
   instead of failing.
4. Insert the `trainee_plans` row. Start date is today, or the day after the
   renewed plan's `ends_on` when that is later.
5. Set `profile_id` and `fulfilled_at` on the order.
6. Send WhatsApp: the existing welcome template to the login phone for a new
   account; the new "plan confirmed" template to the guardian phone.

Any step failing leaves the order `paid` with `fulfillment_error` and the
admin sees a retry button. Money is never silently lost.

## Section 3: Plan status, sessions, reminders

`resolvePlanStatus(plan, sessionsUsed, today)` in `src/lib/plans/` is the one
rule: `cancelled` when the row says so; `expired` when today is past
`ends_on` or `sessionsUsed >= sessions_total`; `ending_soon` when `ends_on`
is within 3 days or exactly one session remains; otherwise `active`.

`countSessionsUsed` is a query helper over `daily_schedule_slot_trainees`
joined to `daily_schedule_slots` on the plan's branch and date window.

A daily cron `plan-reminders` (Vercel cron, `CRON_SECRET` bearer, same
pattern as `arbox-sync`) does three things:

- expire orders pending for more than 24 hours
- for each active plan, send the milestone reminder that is due and not yet
  sent: 3 days before `ends_on`, when one session remains, and on the day
  after `ends_on` (or the day the last session was used). Each reminder
  carries a signed renewal link `/join?renew=<token>` where the token is an
  HMAC over plan id and expiry, valid 30 days.
- reminders go to `guardian_phone` through a Meta-approved template; the
  template name comes from `WHATSAPP_PLAN_REMINDER_TEMPLATE_NAME`.

Trainee dashboard: a "המסלול שלי" card for trainees with any plan, showing
status, sessions used and total, end date, and a renewal button that opens
`/join` prefilled. An expired plan shows a banner with the same button. Nothing
is blocked.

## Section 4: Admin and trainer surfaces

- `/admin/plans`: every plan with a branch filter, status badge, sessions
  used and total, end date, source, and the Morning document link. Actions:
  extend end date, add sessions, cancel, grant by hand. A manual grant takes
  the same form fields as the public signup plus a note and runs the same
  fulfillment with `source: manual`, so a cash trainee also gets an account.
- `/admin/plans/products`: catalog CMS copying the branches page: rename,
  reprice, activate, reorder.
- `/admin/orders`: checkout attempts with status, amount, timestamps, the
  Morning document link, and a retry button on paid orders with a
  `fulfillment_error`.
- User detail page: a plan card for trainees with plans, with the same
  controls, next to the access-tier card.
- Users list and the daily board roster chips: a status badge (פעיל, מסתיים
  בקרוב, פג תוקף) for trainees with a plan, read through the service role.

## Section 5: Morning integration

`src/lib/morning/`:

- `auth.ts`: client-credentials token from `POST {tokenBase}/idp/v1/oauth/token`,
  cached in memory until `expiresAt` minus a minute, refreshed on 401.
- `client.ts`: `createPaymentForm(input)` against `{apiBase}/payments/form`,
  30 second timeout, one retry on network failure, never on 4xx.
- `webhook.ts`: `verifyMorningSignature(rawBody, header, secret)` pure and
  tested.
- Hosts by `MORNING_ENV`: sandbox `https://api.sandbox.morning.dev` and
  `https://sandbox.d.greeninvoice.co.il/api/v1`; production
  `https://api.morning.co` and `https://api.greeninvoice.co.il/api/v1`.

Environment variables, all required at startup through `src/lib/env.ts`:
`MORNING_CLIENT_ID`, `MORNING_CLIENT_SECRET`, `MORNING_WEBHOOK_SECRET`,
`MORNING_ENV`, `MORNING_DOCUMENT_TYPE`, `PLAN_RENEWAL_TOKEN_SECRET`,
`WHATSAPP_PLAN_REMINDER_TEMPLATE_NAME`.

Sandbox first: no production key enters Vercel until a sandbox payment has
round-tripped through the webhook and created an account.

## Section 6: Error handling

- Signature mismatch: 401, nothing stored.
- Unknown `custom`, or a transaction id already used: stored in
  `morning_webhook_events` with an error, acknowledged with 200, listed on
  the orders page under "לא שויך".
- Fulfillment failure: order stays `paid` with `fulfillment_error`; retry from
  the admin re-runs fulfillment from the first incomplete step.
- Morning API failure at checkout: the pending order is marked `failed` and
  the parent sees a Hebrew error with the WhatsApp contact.
- Refunds and credit notes stay in Morning's UI. Eden cancels the plan in the
  admin.

## Section 7: Testing

Pure functions, no mocks, in `__tests__` next to the code:

- `resolvePlanStatus`: active, ending soon by date, ending soon by sessions,
  expired by date, expired by sessions, cancelled.
- `countSessionsUsedFromRows`: counts only rows in the window and branch,
  ignores future dates.
- `dueReminderMilestone`: which milestone is due today and not yet sent.
- `renewalStartDate`: today versus day after the old end.
- `isIntroPackEligible`.
- `verifyMorningSignature` with a known secret and body.
- renewal token sign and verify, including expiry.
- catalog seed: seven slugs, prices and durations match the sheet.

Manual, in the Morning sandbox: new signup, renewal from a reminder link,
failed payment, replayed webhook, manual cash grant, intro pack refused twice.

## Out of scope

- Auto-renewal and saved cards.
- Moving חיפה off Arbox.
- Attendance marking beyond roster presence.
- An email channel of our own.
- Refunds through the API.

## Dependencies on the owner

- Morning subscription at Best or above with API keys for sandbox and
  production, and Grow digital payments approved inside Morning.
- The business type, which decides the document type.
- Two Meta-approved WhatsApp templates: plan confirmed, plan reminder.
- Final Hebrew copy for `/join`.
