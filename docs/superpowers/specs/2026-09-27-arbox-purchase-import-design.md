# Nightly import of Arbox purchases into trainee plans

Date: 2026-09-27. Extends the Arbox-paid plans work (PR #63) and ADR-0007.

> **Superseded in part (2026-10-05, issue #90, ADR-0008).** The import no
> longer merges into or extends a live plan, and no longer moves queued
> plans. Every purchase becomes a new Plan at the end of the Trainee's Plan
> queue, with Arbox's sessions and Arbox's end date as a fixed end. The manual
> "Arbox" method is a repair tool for Admins and Branch managers only. The
> merge and extend rules below are kept as history.

## Problem

קריית אתא sells cards and memberships in Arbox as well as in the app. A
trainee can only book with a `trainee_plans` row, and nothing turns an Arbox
purchase into one: staff record every Arbox sale again by hand in the payment
sheet (method "Arbox"). When that is forgotten the trainee cannot book. It
happened to אופיר אגוסטן, רפאל בגירוב, נועם חרמון, אלרואי דוד, יון דגן and
מוחמד סעדי in one week.

## Decisions made with the owner

- **Our system counts sessions.** Arbox only tells us that a purchase
  happened. Each purchase is imported once; from then on bookings and rosters
  in the app use it up. Later changes in Arbox (extension, cancellation,
  sessions added by hand, check-ins) are not mirrored.
- **Camps are not imported** ("מחנה קיץ", "מחנה סוכות").
- **The manual "Arbox" payment method stays.** The import skips a purchase
  staff already entered by hand (rule below).
- **Nightly only.** A card sold during the day is bookable the next morning.
- **קריית אתא only.** חיפה has no plans (ADR-0007).

## What the research established (2026-09-27)

- Arbox gives each purchase a stable id, `membership_user_id`. It is unique
  across all 725 sales since 2026-02 and never shared by two sales.
  `activeMembershipsReport` carries it. `sessionsReport` (cards) does not;
  `salesReport` does, and joining a card to its sale on
  (`user_id`, `item_name` = `membership_type_name`, `start_date`), restricted to
  `item_type = 'session'`, matched 165 of 166 active cards uniquely. Sales
  history starts 2026-02; a card bought earlier has no sale row.
- A natural key (user, item, date) collides: the sales history has 8 groups of
  identical same-day purchases.
- `total_sessions` on a card is the item template (always 10) and is wrong for
  11 קריית אתא cards; `sessions_left` is the truth.
- Durations must come from `start_date`/`end_date`: "מנוי מתקדמים חודש" runs
  29 to 329 days, "4 חודשים" 61 to 122.
- `sessions_left`, `end_date`, `status` and `open_charges` change over time and
  are never part of the identity.
- `pickRelevantPlan` evaluates one plan; two overlapping plans of the same kind
  double-count usage and the newer hides the older. Purchases must merge into
  a live plan or start after it.
- Plan-renewal reminders are suppressed only for a profile holding a live plan
  whose own order has `payment_method = 'arbox'`. Merging an Arbox purchase
  into a plan paid another way would keep sending renewal WhatsApps.
- `recordArboxPlan` goes through fulfillment, which rewrites profile fields
  (`profile_completed`, guardian fallbacks) and may stamp
  `branches_set_by_admin_at`. The import must not.
- `orders` has a unique index on (`payment_provider`,
  `provider_transaction_id`) where the id is not null. Manual orders leave it
  null today.

## Scope of a run

1. Read Arbox: `sessionsReport`, `activeMembershipsReport`, and `salesReport`
   in 31-day windows from 2026-02-01 to today (about 11 calls).
2. Read our side: קריית אתא trainees with an `arbox_user_id` (via
   `profile_branches`, role trainee, not deleted), their plans with each
   plan's order `payment_method` and `provider_transaction_id`, the orders
   already imported (`provider_transaction_id like 'arbox:%'`), and the
   קריית אתא `plan_products`.
3. Plan in memory with a pure function, then apply.

## Which purchases

A purchase is considered when all hold:

- Its Arbox `user_id` is linked to a קריית אתא trainee. Others are counted as
  `not_linked` and left alone. (This also keeps the two duplicate profiles from
  2026-09-23 safe: their Arbox ids point to חיפה-only profiles.)
- It is a card (`membership_type_name` contains "כרטיסי") or a membership
  (starts with "מנוי"), and the name contains neither "מחנה" nor "טעות".
- Status is `active` or `activeMemberWithFutureCancel`.
- It has an `end_date` on or after today (open-ended memberships are skipped
  as `no_end_date`).
- A card has `sessions_left > 0`.
- A card has exactly one matching sale (otherwise `no_sale_match`, reported,
  never guessed).
- Its key `arbox:<membership_user_id>` is not already on an order
  (`already_imported`).
- It is not **covered by hand**: the trainee has no plan whose order is
  `payment_method = 'arbox'` with a null `provider_transaction_id` (entered by
  staff) created on or after the purchase date. This covers all hand-entered
  Arbox plans to date, so no backfill is needed. Known weakness: if staff
  enter one of two cards bought the same day, both count as covered.

Purchases of one trainee are processed in `purchase_date` order, then by key,
and each sees the effect of the ones before it.

## Applying a purchase

"Live" means `status = 'active'` and `ends_on >= today`, queued plans
included, add-ons excluded. "Arbox-paid" means the plan's own order has
`payment_method = 'arbox'`.

| Purchase | A live Arbox-paid plan of the same kind | Another live plan | Nothing live |
|---|---|---|---|
| Card (S = `sessions_left`, E = `end_date`) | **Merge**: `sessions_total += S`, `ends_on = max(ends_on, E)` | **Chain**: new card plan starting the day after the latest live plan ends, same length as Arbox's remaining window | **New**: from max(today, Arbox start) to E |
| Membership (A = start, E = end) | **Extend**: `ends_on = max(ends_on, E)`; queued plans that now overlap move forward by the same number of days, keeping their length | **Chain**, as for a card | **New**: from max(today, A) to E |

- Same kind means card with card (`session_card`), membership with membership
  (`subscription` or `term`). With several candidates, the one ending last.
- Products: a new card plan uses `card_10` when S <= 10, else `card_20`; the
  plan's own `sessions_total` holds S. A new membership plan uses
  `term_4_months` when E - A > 45 days, else `monthly`. The intro pack and
  add-ons are never used.
- A merge or extend clears the reminder stamps the way the admin actions do:
  `reminded_last_session_at` and `reminded_expired_at` when sessions grow,
  all three when `ends_on` grows.
- The "remaining window" of a chained purchase is E minus max(today, Arbox
  start), at least one day.

## What is written

Per purchase, with the service-role client:

1. **The order**, first, which claims the key: `status 'paid'`, `paid_at` and
   `fulfilled_at` now, `payment_provider 'manual'`, `payment_method 'arbox'`,
   `provider_transaction_id 'arbox:<membership_user_id>'`, `reference` "Arbox
   <item> <purchase date>", `amount_ils` = Arbox `paid` (1 when 0 or null),
   `received_by` null, `product_id` as chosen, `profile_id`, `child_name` and
   `child_birthdate` from the profile, `login_phone` and `payer_phone` from
   `profiles.phone` (skipped as `invalid_phone` unless it is +972 E.164),
   `parent_name` = `guardian_name` or "הורה". A unique violation (23505) means
   another run got there first and counts as `already_imported`.
2. **The plan write**:
   - New or chain: insert `trainee_plans` with `order_id` = the new order,
     `branch_id` קריית אתא, the dates and sessions above, `status 'active'`,
     `source 'manual'`, `created_by` null, `note` "Arbox import <item>
     <purchase date> (<membership_user_id>)".
   - Merge or extend: update the target plan, guarded by its current
     `sessions_total` and `ends_on` (`.eq` on both). If no row matches, the
     plan changed under us: the purchase fails. The new order stays unlinked
     to a plan, which is correct for a merge (one order per plan).
   - Queued plans moved by an extend: update each.
3. **An activity log** `plan_granted` with actor null and actor name "Arbox".

If step 2 fails, the order from step 1 is deleted so the next night retries.
Nothing else is touched: no profile fields, no branches, no agreement, no
Morning document, no WhatsApp.

## Where it runs

- `src/lib/arbox/purchases.ts`: Arbox fetches and the card-to-sale join.
- `src/lib/plans/arbox-import-plan.ts`: `planArboxImports()`, pure: Arbox
  purchases + trainees + plans + products + imported keys + today → a list of
  actions (`create`, `chain`, `merge`, `extend`) and skips with reasons.
- `src/features/plans/lib/arbox-import.ts`: loads our side, calls the planner,
  applies actions one at a time, isolated per purchase, returns counters.
- `src/app/api/cron/arbox-sync/route.ts`: a fourth step after users,
  birthdays and access, in its own try/catch like the access step, returning
  `purchases` and `purchasesError`. It runs only when
  `ARBOX_IMPORT_PURCHASES=on`, so the code can ship before the first run is
  approved. Staff surfaces are revalidated once after the step.
- `scripts/import-arbox-purchases.ts`: `--dry-run` prints the plan for every
  purchase (trainee, action, dates, sessions, amount, or skip reason) without
  writing; without the flag it applies. Same code as the cron.

## Testing

- `planArboxImports()` unit tests: each filter and skip reason, the
  covered-by-hand rule, card and membership in all three columns of the table,
  several purchases for one trainee in one run, product choice, the remaining
  window and chaining arithmetic, queued plans moved by an extend, amount 0.
- The card-to-sale join: unique match, no match, two matches.
- Manual: the dry run against production before `ARBOX_IMPORT_PURCHASES` is
  set; the owner approves its output.

## Rollout

1. Ship with the flag off.
2. Run the dry run against production; review every planned action with the
   owner.
3. Set `ARBOX_IMPORT_PURCHASES=on` in Vercel production; the next 05:00 run
   applies. Check the cron response and the plans the next morning.

## Out of scope

- חיפה, open-ended memberships, camps.
- Mirroring Arbox changes after import.
- The Arbox sync's link failures when an Arbox id and phone match two
  profiles (8 users today); a separate fix.
- Deciding which system counts sessions long-term with Eden beyond the owner's
  decision above.
