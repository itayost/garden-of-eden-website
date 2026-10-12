# Financial reports, phase 1: income and ending soon

Date: 2026-10-12. Status: design approved in conversation, awaiting spec review.

## Goal

Give the admin two screens the app does not have today:

1. **הכנסות** (`/admin/finance`): how much money came in on a day (or range), how it split by payment method and branch, what each staff member should hand over, and every payment and refund behind those numbers.
2. **מסתיימים בקרוב** (`/admin/finance/ending-soon`): which trainees' plans are about to run out, so staff call the family before they do, with a count badge in the admin menu.

Purpose: an end-of-day check ("does the cash I hold match the system?") and a daily renewal call list. Morning stays the official accounting record; this is not bookkeeping.

Success: Eden opens one page and sees today's net, its split, the cash each staff member holds and every payment; on the second page, a list of whom to call, with nobody missed.

## Decisions

| Topic | Decision |
|---|---|
| Who sees it | Admins only (`verifyAdmin()`). Branch managers and trainers do not. |
| "מי סלק" | Both: the payer (child and parent) and the staff member who took the money. |
| Arbox purchases | Their own total beside the app total, never merged into it, dated by the real Arbox purchase date. 1 ILS placeholders are flagged and left out of the Arbox total. |
| Branches | Only branches that sell in the app (today קריית אתא). חיפה has 519 trainees and no plans, orders or products in the app (checked in production 2026-10-12); it stays on Arbox and שימור לקוחות and joins these pages on its own once it sells in the app. |
| Card installments | Counted in full on the day of the charge (matches the Morning receipt). Card rows show the installment count; the card line says how much of it is in installments. Bank arrival is out of scope. |
| Cash refunds | A refund a staff member pays out in cash comes off that person's cash in hand. |
| Staff "ending soon" | 7 days or fewer to the end of the queue, or a cards-only queue with 2 or fewer sessions left. Parent reminders stay at 3 days / 1 session. |
| Alert | In-app only: the list page plus a count badge on its menu item. No WhatsApp. |
| Layout | Layout B, "summary column beside the ledger", for both pages. |

## Out of scope (phase 1)

Haifa's Arbox data (memberships or sales), CSV or Excel export, charts beyond the bars in the summary column, an index on `orders.paid_at`, branch-manager access, bank-deposit forecasting, debt or balances, trainer payroll, and the later reports (refund ledger, discounts, receipt reconciliation, payment-link funnel, churn, unused-session liability, per-staff sales, branch comparison).

## Data rules

### Income

- **The ledger is `orders`.** A payment belongs to the Israel day of its `paid_at`.
- **Counted orders:** status `paid`, `refunded` or `voided`. A sale later voided or refunded still counts on the day the money came in; the refund subtracts separately. `failed`, `pending`, `charging` and `expired` never count. (A manual order can be inserted `paid` with `paid_at` set and then flipped to `failed`; filtering on status keeps it out.)
- **Arbox:** orders with `payment_method = 'arbox'` never join the app total. They form their own total, "Arbox", dated by `orders.arbox_purchased_on` (new column, below) and, when that is NULL (a hand-entered Arbox repair), by the Israel day of `paid_at`. An amount of 1 ILS is the import's placeholder for "Arbox reported no amount": the row is listed and flagged "סכום לא ידוע" and left out of the Arbox total, which states how many rows it left out. Context from production (2026-10-12): 98 of קריית אתא's 111 paid orders are Arbox imports, so the Arbox total carries most of the branch's real income.
- **Free:** `payment_method = 'free'` rows are listed at 0 with their list price and reason, and counted ("N ניתנו ללא תשלום").
- **Refunds:** `plan_refunds` rows subtract on the Israel day of their own `created_at`, whatever the sale's date. A refund row of 0 with method `none` is listed but changes nothing.
- **Net** = counted received minus refunds, per day and for the range.
- **Israel days:** the server fetches with a UTC window one day wider on each side and assigns each row with `israelDateStr()`, so midnight and daylight-saving edges are handled in tested code, not in query time-zone math.
- **Who took it:**
  - `received_by` set: that staff member (cash, Bit, transfer, free, Arbox repair).
  - `payment_link_by` set: "קישור · <name>" (card Payment link; the money did not pass through their hands).
  - neither: "אונליין" (a parent paying on `/join`).
- **Method:** `payment_method`, with legacy Morning orders (`payment_provider = 'morning'`, method NULL) shown as card.
- **Cash-up per staff member:** for each `received_by`, the sum of their cash, Bit and transfer payments, minus cash refunds they recorded with method `cash` (by `plan_refunds.created_by`). Card links they sent are listed beside it, not added. Free plans they gave are counted, not added.
- **Branches:** the branch select lists branches with an active `plan_products` row or any counted order. A branch with none is not offered; the page says in one line that חיפה is tracked in Arbox and links to שימור לקוחות.
- **Range:** `from` and `to` are Israel dates in the URL (`?from=&to=`), default today, capped at 93 days. A bad, reversed or future range falls back to today; an over-long range is clipped with a note.

### Ending soon

- Population: every trainee with a `trainee_plans` row that is not `voided`. A Plan's stored status stays `active` after its end date passes, so the stored status cannot select who is ending; each trainee's queue from `loadPlanQueues()` / `resolvePlanQueue()` decides, as everywhere else.
- **Ending soon (staff rule, its own pure function):** the queue status is `active` or `ending_soon` and either `daysBetween(today, endsOn) <= 7`, or `cardsOnly && sessionsLeft <= 2`. A queued renewal moves `endsOn` out, so a trainee who already renewed is not listed. Mixed queues use the date rule only, as the app already does.
- **Recently expired:** queue status `expired` and the queue's last day is within the last 14 days.
- "Sessions left" keeps the app's meaning: sessions not yet booked. A row shows booked sessions beside it ("0 נותרו · 2 שמורים").
- **Flags per row:**
  - Reminder sent: any `reminded_3_days_at` / `reminded_last_session_at` / `reminded_expired_at` set on the queue's last Plan.
  - Renewal link waiting: an order for this trainee with status `pending` or `expired` (a Payment link not yet paid; an expired link can still be paid until it is purged).
  - Frozen: `queue.frozen`, with its end date.
  - Paid in Arbox: the queue's last Plan has `paidInArbox`; the app sends that parent no reminder, so the row says so.
- **Sort:** most urgent first: days left ascending, then sessions left ascending; recently expired sorted by most recent.
- **Badge:** the count of the ending-soon group (not the expired group), on the "מסתיימים בקרוב" menu item, admins only.

## Pages (layout B)

Mockups: `.impeccable/mockups/finance/split.html` (local, gitignored), screenshots `.impeccable/mockups/finance/shots/split-*.png`. Design brief: `.impeccable/surfaces/src-app-admin-finance-page-tsx.md`.

### `/admin/finance` (הכנסות)

- Header: title, the date, a range control (היום / שבוע / חודש / טווח), a branch select (כל הסניפים / חיפה / קריית אתא).
- **Start-side sticky column (about 340px):**
  1. A strip of the range's days with each day's net; the current day selected. In a single-day view it shows the last 6 days for context.
  2. Net, large, with "התקבל ₪X · הוחזר ₪Y" beneath, and directly under it a separate line "נמכר ב-Arbox: ₪Z (N רכישות)" with "M ללא סכום" when placeholders were left out. The two totals are never added together on the page.
  3. By method: a bar per method with amount and count; the card line notes "מתוכם ₪X בתשלומים"; free as a text line.
  4. By branch: one split bar with both amounts.
  5. Cash-up per staff member: cash / Bit / transfer and "בידיים"; card links they sent listed beneath as "לא עבר בידיים"; a cash refund they paid out shown and subtracted.
- **End side:** tabs תשלומים (N) / החזרים (N) / Arbox (N) · מחוץ לסכום.
  - Payments: time, child and parent, plan, branch, method (with transfer or Bit reference), amount (discount: list price struck and reason; installments count under card amounts), taken by, receipt link (Morning document URL, "אין" for free). A voided or refunded sale keeps its row with a badge.
  - Refunds: time, child, plan, kind (ביטול רישום / ביטול מסלול), amount (negative), method, recorded by, credit note number or "חסר זיכוי", original sale date.
  - Arbox: child, item, purchase date (`arbox_purchased_on`), amount or "סכום לא ידוע", and the import date when it differs.
- Over a range, payment and refund rows show date and time.
- **Phone:** net card with the day strip, then collapsible sections (cash-up open; method and branch closed), then the tabs with stacked rows.

### `/admin/finance/ending-soon` (מסתיימים בקרוב)

- Header: title, the rule in one sentence, branch select.
- **Start-side sticky column:** counts that filter the list: all ending soon (split by date and by sessions), link waiting, reminder sent, paid in Arbox, recently expired. One is active at a time; "all" by default.
- **End side:** the call list: child (links to the trainee page), parent and phone, plan, branch, left (days, or "N אימונים"), ends on, flags, actions (call, WhatsApp, open the trainee). Below it, "פגו לאחרונה".
- **Phone:** the counts become a scrollable chip row; rows stack with call and WhatsApp visible.

### Menu

A new section "דוחות כספיים" between תפעול and שיווק ולקוחות, admins only: הכנסות (`/admin/finance`), מסתיימים בקרוב (`/admin/finance/ending-soon`, with the badge). The existing "הזמנות" item moves into this section unchanged.

## Structure

New feature module `src/features/finance/`:

| File | Role |
|---|---|
| `lib/income.ts` | Pure. Order and refund rows in, the report out: Israel-day buckets, totals by method, branch and staff, cash-up, installments total, free count, Arbox block. No I/O. |
| `lib/ending-soon.ts` | Pure. Queue views plus stamps, link and Arbox facts in, the two groups out, sorted, with flags and the badge count. Holds the staff thresholds. |
| `lib/range.ts` | Pure. Parses and bounds `from` / `to` against Israel today. |
| `lib/queries.ts` | Server-only loaders behind `verifyAdmin()`, service role. Fetch rows, call the pure functions, return `{ success, data }` or `{ success: false, error }` with a Hebrew message. |
| `lib/ending-soon-count.ts` | Server-only, `unstable_cache` under the tag `finance-ending-soon`, about 10 minutes. |
| `components/` | Summary column parts, payments, refunds and Arbox tables, the ending-soon list and filter column, phone variants. |
| `src/lib/utils/money.ts` | `formatIls()`; the inline `₪{x.toLocaleString("he-IL")}` stays where it is. |

Pages: `src/app/admin/finance/page.tsx`, `src/app/admin/finance/ending-soon/page.tsx` (server components; filters in the URL).

Database (one migration, then `npm run db:types`):
- `orders.arbox_purchased_on date NULL`, CHECK it is NULL unless `payment_method = 'arbox'`.
- Backfill the existing Arbox imports from their Plan's note (`trainee_plans.note` holds `Arbox import <item> <YYYY-MM-DD> (<membership id>)`, joined on `trainee_plans.order_id`); rows the pattern does not match stay NULL and fall back to `paid_at`. Capture the matched and unmatched counts with a SELECT before the UPDATE.
- The nightly import (`src/lib/plans/arbox-import-plan.ts` draft, `src/features/plans/lib/arbox-import-apply.ts` insert) writes `arbox_purchased_on = purchase.purchaseDate` from then on.

Touched:
- `src/lib/navigation/admin-nav.ts`: the new section.
- `src/app/admin/layout.tsx`: adds the badge to `navBadges` for admins.
- `src/features/plans/lib/revalidate-staff.ts`: also revalidates the tag and both finance paths, so a sale, void, cancellation, adjustment or freeze refreshes the badge at once. Trainee self-bookings do not pass through it; the 10-minute lifetime covers them.

Reused: `loadPlanQueues()`, `resolvePlanQueue()`, `israelToday()`, `israelDateStr()`, `daysBetween()`, `PAYMENT_METHOD_LABELS_HE`, the plan status classes, `ToolbarDateRange`, `BranchUrlFilter` pattern, shadcn `Table`, `Badge`, `Tabs`, `Collapsible`.

## Errors and edge cases

- A loader failure renders a Hebrew error card in place of the report; the rest of the admin keeps working.
- A badge count failure hides the badge; the menu never breaks over a count.
- A payment with no profile (a parent who never opened an account) shows the child and parent names from the order.
- A staff member who was later deleted or renamed shows the name stored now, or "לא ידוע".
- An empty day shows an empty state that says no payment was recorded that day, and the summary column shows zeros, not a blank.
- A day with only Arbox imports shows a zero total and the Arbox block.

## Testing

The project tests pure functions only, no mocks. Tests are written first.

`income.ts`:
- A payment at 23:30 Israel time on the 12th (20:30 UTC) lands on the 12th; at 00:30 on the 13th (21:30 UTC on the 12th) lands on the 13th; both on summer and winter dates and the daylight-saving switch days.
- `failed`, `pending`, `charging`, `expired` are excluded; `voided` and `refunded` count on their paid day.
- A refund subtracts on its own day, not the sale's.
- Arbox never joins the app total; it has its own total by `arbox_purchased_on`, falling back to the Israel day of `paid_at` when NULL; a 1 ILS amount is flagged, listed, and left out of the Arbox total with a count.
- Free adds 0 and is counted.
- Installments total sums card orders with `installments > 1`.
- Cash-up groups by `received_by`, keeps card links separate, and subtracts that person's cash refunds.
- Who-took-it: staff, link and online cases.

`ending-soon.ts`:
- 7 days and 2 sessions are inclusive; 8 days and 3 sessions are out.
- A mixed queue uses the date rule only.
- A queue with a renewal queued behind it is not listed.
- The 14-day expired window, inclusive.
- Urgency order, and the badge counts only the ending-soon group.
- Flags: reminder stamp, pending link, frozen, paid in Arbox.

`arbox-import-plan.ts`: the draft carries the purchase date for `arbox_purchased_on`.

`range.ts`: default today, reversed and malformed input, future dates, the 93-day cap.

Then `npx tsc --noEmit`, lint, and a manual check on the preview against production data: today's total compared with what Eden knows was collected, and the ending-soon list compared with `/admin/plans?status=ending_soon` (every trainee there must also appear here).

## Risks

- Money is read through the service role on admin-only pages; the loaders call `verifyAdmin()` first and are server-only, never exported as client-callable actions.
- `loadPlanQueues()` over every trainee with a plan is the heaviest read; the badge is cached and the page loads it once per request.
- Reconciled card orders carry the reconcile time as `paid_at`, so they can land a day late. Rare; noted in the page's help text.
