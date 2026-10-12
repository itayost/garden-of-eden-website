# Financial Reports Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Two admin-only pages, `/admin/finance` (income for a day or range) and `/admin/finance/ending-soon` (who is about to run out, with a menu badge), in the "summary column beside the ledger" layout.

**Architecture:** All money and ending-soon rules live in pure, unit-tested functions in `src/features/finance/lib/` (`income.ts`, `ending-soon.ts`, `range.ts`, `format.ts`, plus `src/lib/utils/money.ts`). Server-only loaders read with the service role behind `verifyAdmin()` and feed those functions; server pages render them. One migration adds `orders.arbox_purchased_on` so Arbox money is dated by its real purchase day.

**Tech Stack:** Next.js 16 App Router (server components, `searchParams` as a Promise), React 19, TypeScript strict, Supabase (service role via `createAdminClient()`), Tailwind 4 + shadcn/Radix (`Table`, `Tabs`, `Badge`, `Button`), nuqs (`BranchUrlFilter`), Vitest.

**Spec:** `docs/superpowers/specs/2026-10-12-financial-reports-phase-1-design.md`. Approved mockup (local, gitignored): `.impeccable/mockups/finance/split.html`, screenshots `.impeccable/mockups/finance/shots/split-*.png`. Design brief: `.impeccable/surfaces/src-app-admin-finance-page-tsx.md`.

## Global Constraints

- Admins only: every loader and page calls `verifyAdmin()` (from `@/lib/actions/shared`); trainers and branch managers get nothing.
- Never import `createAdminClient` into a client component; loaders are `import "server-only"` files, never `"use server"` action files.
- All user-facing text in Hebrew; the app is `dir="rtl"`; use logical CSS (`ms-`, `me-`, `ps-`, `pe-`, `start`, `end`), never `left`/`right`.
- No emojis in code, comments, or copy. No em dashes in copy.
- Immutability: never mutate arrays or objects; build new ones (`map`, `filter`, spread).
- Money renders through `formatIls()`; every amount and count uses `tabular-nums`; a negative amount is wrapped in `dir="ltr"` so it reads "−₪310".
- Counted order statuses: `paid`, `refunded`, `voided`. Never filter income on `status = 'paid'` alone.
- Arbox (`payment_method = 'arbox'`) never joins the app total. A 1 ILS Arbox amount is the import's placeholder for "no amount" and stays out of the Arbox total.
- Staff ending-soon thresholds: 7 days, 2 sessions, 14 days for recently expired. Parent reminders (3 days / 1 session in `src/lib/plans/plan-queue.ts`) are not touched.
- Tests cover pure functions only, no mocks (project rule). Write the test first.
- Files stay under 400 lines; one responsibility per file.
- Commits: conventional with scope, e.g. `feat(finance): ...`, ending with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Use `GRAPHIFY_SKIP_HOOK=1` for branch switches (the graphify post-checkout hook exits 1).
- Production-touching steps (`supabase db push`) are confirmed with the user before running.

## Review Focus

1. **A day with no payments at all** (a quiet Saturday): the page must show zeros and an empty-state line, not a blank or a crash. Test in Task 3 ("an empty day").
2. **A staff member who was deleted**: `orders.received_by` is `ON DELETE SET NULL`, so their old cash payment would read as "אונליין" and vanish from the cash-up. It must read "לא ידוע" and stay a staff payment. Test in Task 3 ("deleted staff").
3. **A hand-typed or stale `?branch=`** (Haifa's id, a non-uuid): must fall back to all selling branches, never query an arbitrary id. Test in Task 2 (`parseBranchParam`).
4. **A hand-entered Arbox repair** (no `arbox_purchased_on`): must still be dated, by the Israel day of `paid_at`. Test in Task 3 ("arbox repair").
5. **A refund on a Plan that had no order** (manual grant): `salePaidAt` is null; the row must still subtract and read "ללא הזמנה" instead of a sale date. Test in Task 3 ("refund without an order").

---

### Task 1: Arbox purchase date on orders

**Files:**
- Create: `supabase/migrations/20261012120000_orders_arbox_purchased_on.sql`
- Modify: `src/lib/plans/arbox-import-plan.ts` (`ImportOrderDraft`, `orderDraft`)
- Modify: `src/features/plans/lib/arbox-import-apply.ts` (`insertOrder`)
- Modify: `src/types/database.generated.ts` (regenerated, never by hand)
- Test: `src/lib/plans/__tests__/arbox-import-plan.test.ts`

**Interfaces:**
- Produces: column `orders.arbox_purchased_on date NULL` (CHECK: NULL unless `payment_method = 'arbox'`); `ImportOrderDraft.purchasedOn: string` (ISO date).

- [ ] **Step 1: Write the failing test**

In `src/lib/plans/__tests__/arbox-import-plan.test.ts`, inside `describe("new plan", ...)`, the first test's expected `order` object gains `purchasedOn: "2026-09-28"` (the `cardPurchase()` fixture's `purchaseDate`; confirm by reading the fixture at the top of the file). Then add:

```ts
  test("the order carries the Arbox purchase day, not the import day", () => {
    const { actions } = run({ purchases: [cardPurchase({ purchaseDate: "2026-09-20" })] });

    expect(actions[0].order.purchasedOn).toBe("2026-09-20");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/lib/plans/__tests__/arbox-import-plan.test.ts`
Expected: FAIL, `purchasedOn` is undefined.

- [ ] **Step 3: Implement the draft field**

In `src/lib/plans/arbox-import-plan.ts`, add to `ImportOrderDraft`:

```ts
  /** The day the purchase was made in Arbox; the order's paid_at is the import night. */
  readonly purchasedOn: string;
```

and in `orderDraft()` add `purchasedOn: p.purchaseDate,` after `reference`.

In `src/features/plans/lib/arbox-import-apply.ts`, `insertOrder()`, add after `reference: o.reference,`:

```ts
      arbox_purchased_on: o.purchasedOn,
```

- [ ] **Step 4: Write the migration**

`supabase/migrations/20261012120000_orders_arbox_purchased_on.sql`:

```sql
-- The day an Arbox purchase was made. The nightly import's paid_at is the
-- night it ran, so income reports date Arbox money by this column instead.
-- NULL for app sales and for hand-entered Arbox repairs (those fall back to
-- the Israel day of paid_at).
ALTER TABLE public.orders ADD COLUMN arbox_purchased_on date;

ALTER TABLE public.orders ADD CONSTRAINT orders_arbox_purchased_on_check
  CHECK (arbox_purchased_on IS NULL OR payment_method = 'arbox');

-- Backfill from the Plan note the import writes:
--   "Arbox import <item> <YYYY-MM-DD> (<membership id>)"
-- Counts first, so the original state is on record before the UPDATE.
DO $$
DECLARE
  matched integer;
  unmatched integer;
BEGIN
  SELECT
    count(*) FILTER (WHERE tp.note ~ ' (\d{4}-\d{2}-\d{2}) \(\d+\)$'),
    count(*) FILTER (WHERE tp.note IS NULL OR tp.note !~ ' (\d{4}-\d{2}-\d{2}) \(\d+\)$')
  INTO matched, unmatched
  FROM public.orders o
  JOIN public.trainee_plans tp ON tp.order_id = o.id
  WHERE o.payment_method = 'arbox' AND o.provider_transaction_id LIKE 'arbox:%';
  RAISE NOTICE 'arbox_purchased_on backfill: % matched, % unmatched', matched, unmatched;
END $$;

UPDATE public.orders o
SET arbox_purchased_on = substring(tp.note from ' (\d{4}-\d{2}-\d{2}) \(\d+\)$')::date
FROM public.trainee_plans tp
WHERE tp.order_id = o.id
  AND o.payment_method = 'arbox'
  AND o.provider_transaction_id LIKE 'arbox:%'
  AND tp.note ~ ' (\d{4}-\d{2}-\d{2}) \(\d+\)$';
```

- [ ] **Step 5: Push the migration and regenerate types (ask the user first: this writes to production)**

Run: `supabase db push`
Expected: the NOTICE line, e.g. `arbox_purchased_on backfill: 98 matched, 0 unmatched`. Report the numbers to the user.

Run: `npm run db:types && npm run db:schema`
Expected: `src/types/database.generated.ts` now has `arbox_purchased_on: string | null` on `orders` Row/Insert/Update.

Verify with a read-only query:

```bash
supabase db query --linked "select count(*) filter (where arbox_purchased_on is not null) as dated, count(*) filter (where arbox_purchased_on is null) as undated from orders where payment_method = 'arbox'"
```

- [ ] **Step 6: Run tests and type-check**

Run: `npm run test:run -- src/lib/plans/__tests__/arbox-import-plan.test.ts && npx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20261012120000_orders_arbox_purchased_on.sql src/lib/plans/arbox-import-plan.ts src/features/plans/lib/arbox-import-apply.ts src/types/database.generated.ts src/lib/plans/__tests__/arbox-import-plan.test.ts
git commit -m "feat(finance): orders keep the Arbox purchase day

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Money, range and date formatting helpers

**Files:**
- Create: `src/lib/utils/money.ts`
- Create: `src/features/finance/lib/range.ts`
- Create: `src/features/finance/lib/format.ts`
- Test: `src/lib/utils/__tests__/money.test.ts`, `src/features/finance/lib/__tests__/range.test.ts`, `src/features/finance/lib/__tests__/format.test.ts`

**Interfaces:**
- Produces:
  - `formatIls(amount: number): string`
  - `MAX_RANGE_DAYS = 93`, `STRIP_DAYS = 6`, `type RangePreset = "day" | "week" | "month" | "custom"`, `interface ReportRange { from: string; to: string; preset: RangePreset; clipped: boolean }`, `parseRange(params: { range?: string; from?: string; to?: string }, today: string): ReportRange`, `stripStart(range: Pick<ReportRange, "from" | "to">): string`, `parseBranchParam(value: string | undefined, allowed: readonly string[]): string | null`
  - `timeOf(iso: string): string` ("HH:MM" in Israel), `longDay(day: string): string` ("יום שני, 12 באוקטובר 2026"), `shortDay(day: string): string` ("ב׳ 12.10"), `rangeLabel(range: ReportRange): string`

- [ ] **Step 1: Write the failing tests**

`src/lib/utils/__tests__/money.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { formatIls } from "../money";

describe("formatIls", () => {
  test("groups thousands with a shekel sign", () => {
    expect(formatIls(1200)).toBe("₪1,200");
  });
  test("keeps agorot when there are any", () => {
    expect(formatIls(12.5)).toBe("₪12.5");
  });
  test("zero and negative zero read ₪0", () => {
    expect(formatIls(0)).toBe("₪0");
    expect(formatIls(-0)).toBe("₪0");
  });
  test("a negative amount leads with a minus sign", () => {
    expect(formatIls(-310)).toBe("−₪310");
  });
});
```

`src/features/finance/lib/__tests__/range.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { parseBranchParam, parseRange, stripStart } from "../range";

const TODAY = "2026-10-12";

describe("parseRange", () => {
  test("no params is today", () => {
    expect(parseRange({}, TODAY)).toEqual({ from: TODAY, to: TODAY, preset: "day", clipped: false });
  });
  test("week is the last seven days including today", () => {
    expect(parseRange({ range: "week" }, TODAY)).toEqual({ from: "2026-10-06", to: TODAY, preset: "week", clipped: false });
  });
  test("month runs from the first of this month", () => {
    expect(parseRange({ range: "month" }, TODAY)).toEqual({ from: "2026-10-01", to: TODAY, preset: "month", clipped: false });
  });
  test("a custom range is kept", () => {
    expect(parseRange({ range: "custom", from: "2026-09-01", to: "2026-09-30" }, TODAY)).toEqual({
      from: "2026-09-01",
      to: "2026-09-30",
      preset: "custom",
      clipped: false,
    });
  });
  test("malformed or impossible dates fall back to today", () => {
    expect(parseRange({ range: "custom", from: "2026-02-30", to: "2026-03-01" }, TODAY).preset).toBe("day");
    expect(parseRange({ range: "custom", from: "yesterday", to: TODAY }, TODAY).preset).toBe("day");
    expect(parseRange({ range: "custom" }, TODAY).preset).toBe("day");
  });
  test("a reversed range falls back to today", () => {
    expect(parseRange({ range: "custom", from: "2026-10-10", to: "2026-10-01" }, TODAY).preset).toBe("day");
  });
  test("a future end is cut to today; a wholly future range falls back to today", () => {
    expect(parseRange({ range: "custom", from: "2026-10-01", to: "2026-12-01" }, TODAY).to).toBe(TODAY);
    expect(parseRange({ range: "custom", from: "2026-11-01", to: "2026-12-01" }, TODAY).preset).toBe("day");
  });
  test("a range over 93 days keeps its last 93 and says so", () => {
    const range = parseRange({ range: "custom", from: "2026-01-01", to: "2026-10-12" }, TODAY);
    expect(range).toEqual({ from: "2026-07-12", to: TODAY, preset: "custom", clipped: true });
  });
  test("an unknown preset is today", () => {
    expect(parseRange({ range: "year" }, TODAY).preset).toBe("day");
  });
});

describe("stripStart", () => {
  test("a single day shows six days of context", () => {
    expect(stripStart({ from: TODAY, to: TODAY })).toBe("2026-10-07");
  });
  test("a longer range starts the strip at its own start", () => {
    expect(stripStart({ from: "2026-10-01", to: TODAY })).toBe("2026-10-01");
  });
});

describe("parseBranchParam", () => {
  const allowed = ["ka-id"];
  test("an allowed branch id is kept", () => {
    expect(parseBranchParam("ka-id", allowed)).toBe("ka-id");
  });
  test("a missing, unknown or hand-typed value means all branches", () => {
    expect(parseBranchParam(undefined, allowed)).toBeNull();
    expect(parseBranchParam("haifa-id", allowed)).toBeNull();
    expect(parseBranchParam("'; drop table", allowed)).toBeNull();
  });
});
```

`src/features/finance/lib/__tests__/format.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { longDay, rangeLabel, shortDay, timeOf } from "../format";

describe("timeOf", () => {
  test("reads the time in Israel, summer and winter", () => {
    expect(timeOf("2026-10-12T05:12:00Z")).toBe("08:12");
    expect(timeOf("2026-12-01T06:12:00Z")).toBe("08:12");
  });
});

describe("day labels", () => {
  test("long and short forms", () => {
    expect(longDay("2026-10-12")).toBe("יום שני, 12 באוקטובר 2026");
    expect(shortDay("2026-10-12")).toBe("ב׳ 12.10");
  });
  test("a range label names both ends", () => {
    expect(rangeLabel({ from: "2026-10-12", to: "2026-10-12", preset: "day", clipped: false })).toBe("יום שני, 12 באוקטובר 2026");
    expect(rangeLabel({ from: "2026-10-06", to: "2026-10-12", preset: "week", clipped: false })).toBe("6.10 עד 12.10.2026");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:run -- src/lib/utils/__tests__/money.test.ts src/features/finance/lib/__tests__`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement**

`src/lib/utils/money.ts`:

```ts
/**
 * Shekels for a screen: "₪1,200", "₪12.5". A negative amount reads "−₪310"
 * with a real minus sign; callers isolate it with dir="ltr" so RTL text does
 * not move the sign to the far end.
 */
export function formatIls(amount: number): string {
  const digits = Math.abs(amount).toLocaleString("he-IL", { maximumFractionDigits: 2 });
  return amount < 0 ? `−₪${digits}` : `₪${digits}`;
}
```

`src/features/finance/lib/range.ts`:

```ts
import { addDays, daysBetween } from "@/lib/utils/iso-date";

/** The longest range a report reads; a longer ask keeps its last days. */
export const MAX_RANGE_DAYS = 93;
/** Days of context the day strip shows when the range is shorter. */
export const STRIP_DAYS = 6;

export type RangePreset = "day" | "week" | "month" | "custom";

export interface ReportRange {
  /** First Israel day, ISO YYYY-MM-DD, inclusive. */
  from: string;
  /** Last Israel day, inclusive; never after today. */
  to: string;
  preset: RangePreset;
  /** The asked range was longer than MAX_RANGE_DAYS and was cut. */
  clipped: boolean;
}

export interface RangeParams {
  range?: string;
  from?: string;
  to?: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A real calendar date: 2026-02-30 is rejected because it would roll over. */
const isIsoDate = (value: string | undefined): value is string =>
  value !== undefined && ISO_DATE.test(value) && addDays(value, 0) === value;

/** The report range from the URL; anything unusable falls back to today. */
export function parseRange(params: RangeParams, today: string): ReportRange {
  const day: ReportRange = { from: today, to: today, preset: "day", clipped: false };
  if (params.range === "week") return { from: addDays(today, -6), to: today, preset: "week", clipped: false };
  if (params.range === "month") return { from: `${today.slice(0, 8)}01`, to: today, preset: "month", clipped: false };
  if (params.range !== "custom" || !isIsoDate(params.from) || !isIsoDate(params.to)) return day;

  const to = params.to > today ? today : params.to;
  if (params.from > to) return day;
  if (daysBetween(params.from, to) + 1 > MAX_RANGE_DAYS) {
    return { from: addDays(to, -(MAX_RANGE_DAYS - 1)), to, preset: "custom", clipped: true };
  }
  return { from: params.from, to, preset: "custom", clipped: false };
}

/** The first day of the day strip: the range's start, or STRIP_DAYS back for a short range. */
export function stripStart(range: Pick<ReportRange, "from" | "to">): string {
  const back = addDays(range.to, -(STRIP_DAYS - 1));
  return range.from < back ? range.from : back;
}

/** A ?branch= value the report may filter by, or null for every selling branch. */
export function parseBranchParam(value: string | undefined, allowed: readonly string[]): string | null {
  return value !== undefined && allowed.includes(value) ? value : null;
}
```

`src/features/finance/lib/format.ts`:

```ts
import type { ReportRange } from "./range";

const TIME = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Jerusalem",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const LONG_DAY = new Intl.DateTimeFormat("he-IL", {
  timeZone: "UTC",
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const WEEKDAY_LETTER = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];

const asDate = (day: string) => new Date(`${day}T00:00:00Z`);
const dayMonth = (day: string) => `${Number(day.slice(8, 10))}.${Number(day.slice(5, 7))}`;

/** "08:12": the Israel wall-clock time of an ISO timestamp. */
export const timeOf = (iso: string): string => TIME.format(new Date(iso));

/** "יום שני, 12 באוקטובר 2026". */
export const longDay = (day: string): string => LONG_DAY.format(asDate(day));

/** "ב׳ 12.10", for the day strip and multi-day rows. */
export const shortDay = (day: string): string =>
  `${WEEKDAY_LETTER[asDate(day).getUTCDay()]} ${dayMonth(day)}`;

/** The page subtitle: one day in full, a range as "6.10 עד 12.10.2026". */
export function rangeLabel(range: ReportRange): string {
  if (range.from === range.to) return longDay(range.from);
  return `${dayMonth(range.from)} עד ${dayMonth(range.to)}.${range.to.slice(0, 4)}`;
}
```

If `longDay` returns a slightly different Hebrew form on this Node's ICU (for example without the comma), adjust the test expectation to the ICU output after checking it once with `node -e`, not the implementation.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test:run -- src/lib/utils/__tests__/money.test.ts src/features/finance/lib/__tests__`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/money.ts src/lib/utils/__tests__/money.test.ts src/features/finance/lib/range.ts src/features/finance/lib/format.ts src/features/finance/lib/__tests__/range.test.ts src/features/finance/lib/__tests__/format.test.ts
git commit -m "feat(finance): report range, money and day formatting helpers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The income report (pure)

**Files:**
- Create: `src/features/finance/lib/income.ts`
- Test: `src/features/finance/lib/__tests__/income.test.ts`

**Interfaces:**
- Consumes: `addDays`, `daysBetween` (`@/lib/utils/iso-date`), `israelDateStr` (`@/lib/utils/israel-time`), `OrderStatus`, `PaymentMethod` (`@/types/plans`).
- Produces (exact names; Tasks 5 and 7 import them):

```ts
export const COUNTED_STATUSES: readonly OrderStatus[];
export const ARBOX_PLACEHOLDER_ILS = 1;
export const INCOME_METHODS: readonly ["cash", "card", "bit", "transfer", "free"];
export type IncomeMethod = "cash" | "card" | "bit" | "transfer" | "free";
export type RefundMethod = "card" | "cash" | "transfer" | "bit" | "arbox" | "none";
export interface StaffRef { id: string; name: string }
export const UNKNOWN_STAFF: StaffRef;
export interface IncomeOrderRow { id; status; paidAt; amountIls; method: PaymentMethod | null; installments; listPriceIls; discountReason; reference; receivedBy: StaffRef | null; paymentLinkBy: StaffRef | null; childName; parentName; profileId; planName; branchId; branchName; receiptUrl; arboxPurchasedOn: string | null }
export interface IncomeRefundRow { id; createdAt; amountIls; method: RefundMethod; kind: "void" | "cancellation"; createdBy: StaffRef; childName; planName; branchId; creditNoteNumber: string | null; salePaidAt: string | null }
export type Collector = { kind: "staff"; staff: StaffRef } | { kind: "link"; staff: StaffRef } | { kind: "online" };
export function collectorOf(o: Pick<IncomeOrderRow, "receivedBy" | "paymentLinkBy" | "method">): Collector;
export interface IncomePayment extends IncomeOrderRow { day: string; collector: Collector; incomeMethod: IncomeMethod }
export interface IncomeRefund extends IncomeRefundRow { day: string }
export interface ArboxEntry extends IncomeOrderRow { day: string; unknownAmount: boolean }
export interface DayTotal { day: string; received: number; refunds: number; net: number; count: number }
export interface MethodTotal { method: IncomeMethod; total: number; count: number }
export interface BranchTotal { branchId: string; branchName: string; total: number; count: number }
export interface StaffCashUp { staff: StaffRef; cash: number; bit: number; transfer: number; cashRefundsOut: number; inHand: number; linksSent: { orderId: string; childName: string; amountIls: number }[]; freeGiven: number }
export interface IncomeReport { from; to; received; refunds; net; paymentCount; freeCount; installmentsIls; days: DayTotal[]; byMethod: MethodTotal[]; byBranch: BranchTotal[]; staff: StaffCashUp[]; payments: IncomePayment[]; refundRows: IncomeRefund[]; arbox: { entries: ArboxEntry[]; total: number; unknownCount: number } }
export interface IncomeInput { from: string; to: string; stripFrom: string; orders: readonly IncomeOrderRow[]; refunds: readonly IncomeRefundRow[] }
export function buildIncomeReport(input: IncomeInput): IncomeReport;
```

- [ ] **Step 1: Write the failing tests**

`src/features/finance/lib/__tests__/income.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import {
  buildIncomeReport,
  collectorOf,
  UNKNOWN_STAFF,
  type IncomeOrderRow,
  type IncomeRefundRow,
} from "../income";

const YOAV = { id: "s-yoav", name: "יואב כהן" };
const NOA = { id: "s-noa", name: "נועה פרץ" };
const EDEN = { id: "s-eden", name: "עדן" };
const DAY = "2026-10-12";

function order(overrides: Partial<IncomeOrderRow> = {}): IncomeOrderRow {
  return {
    id: "o-1",
    status: "paid",
    paidAt: "2026-10-12T09:00:00Z",
    amountIls: 450,
    method: "cash",
    installments: 1,
    listPriceIls: null,
    discountReason: null,
    reference: null,
    receivedBy: YOAV,
    paymentLinkBy: null,
    childName: "אורי לוי",
    parentName: "מיכל לוי",
    profileId: "p-1",
    planName: "מנוי חודשי",
    branchId: "ka",
    branchName: "קריית אתא",
    receiptUrl: "https://morning.example/doc/1",
    arboxPurchasedOn: null,
    ...overrides,
  };
}

function refund(overrides: Partial<IncomeRefundRow> = {}): IncomeRefundRow {
  return {
    id: "r-1",
    createdAt: "2026-10-12T15:00:00Z",
    amountIls: 310,
    method: "transfer",
    kind: "cancellation",
    createdBy: EDEN,
    childName: "תמר גולן",
    planName: "מנוי חודשי",
    branchId: "ka",
    creditNoteNumber: "40021",
    salePaidAt: "2026-09-28T08:00:00Z",
    ...overrides,
  };
}

const report = (
  orders: IncomeOrderRow[],
  refunds: IncomeRefundRow[] = [],
  from = DAY,
  to = DAY,
  stripFrom = from,
) => buildIncomeReport({ from, to, stripFrom, orders, refunds });

describe("Israel days", () => {
  test("23:30 in Israel stays on its day; 00:30 belongs to the next, in summer", () => {
    const late = order({ id: "late", paidAt: "2026-10-12T20:30:00Z" });
    const early = order({ id: "early", paidAt: "2026-10-12T21:30:00Z" });
    expect(report([late, early]).payments.map((p) => p.id)).toEqual(["late"]);
    expect(report([late, early], [], "2026-10-13", "2026-10-13").payments.map((p) => p.id)).toEqual(["early"]);
  });
  test("the same edges in winter", () => {
    const late = order({ id: "late", paidAt: "2026-12-01T21:30:00Z" });
    const early = order({ id: "early", paidAt: "2026-12-01T22:30:00Z" });
    expect(report([late, early], [], "2026-12-01", "2026-12-01").payments.map((p) => p.id)).toEqual(["late"]);
    expect(report([late, early], [], "2026-12-02", "2026-12-02").payments.map((p) => p.id)).toEqual(["early"]);
  });
  test("the night clocks go back still counts to the right day", () => {
    const night = order({ paidAt: "2026-10-24T21:30:00Z" });
    expect(report([night], [], "2026-10-25", "2026-10-25").paymentCount).toBe(1);
  });
});

describe("which orders count", () => {
  test("paid, refunded and voided count on the day they were paid", () => {
    const rows = [
      order({ id: "a", status: "paid" }),
      order({ id: "b", status: "refunded" }),
      order({ id: "c", status: "voided" }),
    ];
    expect(report(rows).received).toBe(1350);
    expect(report(rows).payments.map((p) => p.status)).toEqual(["paid", "refunded", "voided"]);
  });
  test("failed, pending, charging and expired never count", () => {
    const rows = (["failed", "pending", "charging", "expired"] as const).map((status, i) =>
      order({ id: `x${i}`, status }),
    );
    expect(report(rows).received).toBe(0);
    expect(report(rows).payments).toEqual([]);
  });
});

describe("refunds", () => {
  test("a refund subtracts on its own day, not the sale's", () => {
    const sale = order({ paidAt: "2026-10-10T09:00:00Z", amountIls: 450 });
    const back = refund({ createdAt: "2026-10-12T15:00:00Z", amountIls: 310 });
    const today = report([sale], [back]);
    expect(today.received).toBe(0);
    expect(today.refunds).toBe(310);
    expect(today.net).toBe(-310);
    expect(report([sale], [back], "2026-10-10", "2026-10-10").refunds).toBe(0);
  });
  test("refund without an order: kept, with no sale date", () => {
    const grant = refund({ salePaidAt: null, amountIls: 0, method: "none" });
    expect(report([], [grant]).refundRows).toHaveLength(1);
    expect(report([], [grant]).refundRows[0].salePaidAt).toBeNull();
  });
});

describe("Arbox", () => {
  test("never joins the app total and has its own", () => {
    const app = order({ amountIls: 450 });
    const arbox = order({ id: "ax", method: "arbox", receivedBy: null, amountIls: 1329, arboxPurchasedOn: DAY });
    const r = report([app, arbox]);
    expect(r.received).toBe(450);
    expect(r.payments.map((p) => p.id)).toEqual(["o-1"]);
    expect(r.arbox.total).toBe(1329);
    expect(r.arbox.entries.map((e) => e.id)).toEqual(["ax"]);
  });
  test("is dated by its purchase day even when imported later", () => {
    const arbox = order({ method: "arbox", receivedBy: null, paidAt: "2026-10-14T01:00:00Z", arboxPurchasedOn: DAY });
    expect(report([arbox]).arbox.entries).toHaveLength(1);
  });
  test("arbox repair with no purchase day falls back to the Israel day of paid_at", () => {
    const repair = order({ method: "arbox", receivedBy: EDEN, paidAt: "2026-10-12T20:30:00Z", arboxPurchasedOn: null });
    expect(report([repair]).arbox.entries.map((e) => e.day)).toEqual([DAY]);
  });
  test("a 1 ILS placeholder is listed, flagged, and left out of the Arbox total", () => {
    const known = order({ id: "k", method: "arbox", receivedBy: null, amountIls: 520, arboxPurchasedOn: DAY });
    const unknown = order({ id: "u", method: "arbox", receivedBy: null, amountIls: 1, arboxPurchasedOn: DAY });
    const r = report([known, unknown]);
    expect(r.arbox.total).toBe(520);
    expect(r.arbox.unknownCount).toBe(1);
    expect(r.arbox.entries.find((e) => e.id === "u")?.unknownAmount).toBe(true);
  });
});

describe("methods, installments and free", () => {
  const rows = [
    order({ id: "cash", method: "cash", amountIls: 450 }),
    order({ id: "card12", method: "card", receivedBy: null, paymentLinkBy: NOA, amountIls: 1200, installments: 12 }),
    order({ id: "card3", method: "card", receivedBy: null, amountIls: 520, installments: 3 }),
    order({ id: "card1", method: "card", receivedBy: null, amountIls: 300, installments: 1 }),
    order({ id: "free", method: "free", amountIls: 0, listPriceIls: 520, discountReason: "מלגה", receivedBy: EDEN }),
  ];
  test("totals per method in a fixed order, skipping methods with nothing", () => {
    expect(report(rows).byMethod).toEqual([
      { method: "cash", total: 450, count: 1 },
      { method: "card", total: 2020, count: 3 },
      { method: "free", total: 0, count: 1 },
    ]);
  });
  test("card money split into installments is summed apart", () => {
    expect(report(rows).installmentsIls).toBe(1720);
  });
  test("free adds nothing but is counted", () => {
    expect(report(rows).received).toBe(2470);
    expect(report(rows).freeCount).toBe(1);
  });
  test("a legacy Morning order with no method is a card payment", () => {
    expect(report([order({ method: null, receivedBy: null })]).byMethod[0].method).toBe("card");
  });
});

describe("branches", () => {
  test("totals per branch, largest first", () => {
    const rows = [
      order({ id: "a", branchId: "ka", branchName: "קריית אתא", amountIls: 450 }),
      order({ id: "b", branchId: "hf", branchName: "חיפה", amountIls: 900 }),
    ];
    expect(report(rows).byBranch).toEqual([
      { branchId: "hf", branchName: "חיפה", total: 900, count: 1 },
      { branchId: "ka", branchName: "קריית אתא", total: 450, count: 1 },
    ]);
  });
});

describe("who took it", () => {
  test("staff, link and online", () => {
    expect(collectorOf({ receivedBy: YOAV, paymentLinkBy: null, method: "cash" })).toEqual({ kind: "staff", staff: YOAV });
    expect(collectorOf({ receivedBy: null, paymentLinkBy: NOA, method: "card" })).toEqual({ kind: "link", staff: NOA });
    expect(collectorOf({ receivedBy: null, paymentLinkBy: null, method: "card" })).toEqual({ kind: "online" });
  });
  test("deleted staff: a hand payment stays a staff payment by an unknown person", () => {
    expect(collectorOf({ receivedBy: null, paymentLinkBy: null, method: "cash" })).toEqual({ kind: "staff", staff: UNKNOWN_STAFF });
  });
});

describe("cash-up per staff member", () => {
  const rows = [
    order({ id: "y1", method: "cash", amountIls: 450, receivedBy: YOAV }),
    order({ id: "y2", method: "bit", amountIls: 450, receivedBy: YOAV }),
    order({ id: "y3", method: "cash", amountIls: 520, receivedBy: YOAV, status: "voided" }),
    order({ id: "n1", method: "cash", amountIls: 380, receivedBy: NOA }),
    order({ id: "n2", method: "card", amountIls: 1200, receivedBy: null, paymentLinkBy: NOA, childName: "דניאל מזרחי" }),
    order({ id: "e1", method: "transfer", amountIls: 900, receivedBy: EDEN }),
    order({ id: "e2", method: "free", amountIls: 0, receivedBy: EDEN }),
  ];
  const refunds = [refund({ method: "cash", amountIls: 520, createdBy: EDEN })];

  test("each person's cash, Bit and transfer, minus cash refunds they paid out", () => {
    const staff = report(rows, refunds).staff;
    expect(staff.find((s) => s.staff.id === YOAV.id)).toMatchObject({ cash: 970, bit: 450, transfer: 0, cashRefundsOut: 0, inHand: 1420 });
    expect(staff.find((s) => s.staff.id === EDEN.id)).toMatchObject({ transfer: 900, cashRefundsOut: 520, inHand: 380, freeGiven: 1 });
  });
  test("card links are listed, never added to what they hold", () => {
    const noa = report(rows, refunds).staff.find((s) => s.staff.id === NOA.id);
    expect(noa?.inHand).toBe(380);
    expect(noa?.linksSent).toEqual([{ orderId: "n2", childName: "דניאל מזרחי", amountIls: 1200 }]);
  });
  test("a refund by transfer does not touch anyone's cash", () => {
    const staff = report(rows, [refund({ method: "transfer", createdBy: EDEN })]).staff;
    expect(staff.find((s) => s.staff.id === EDEN.id)?.cashRefundsOut).toBe(0);
  });
});

describe("days", () => {
  test("every day in the strip, with totals only from that day", () => {
    const rows = [
      order({ id: "a", paidAt: "2026-10-11T09:00:00Z", amountIls: 100 }),
      order({ id: "b", paidAt: "2026-10-12T09:00:00Z", amountIls: 450 }),
    ];
    const r = report(rows, [refund()], DAY, DAY, "2026-10-10");
    expect(r.days).toEqual([
      { day: "2026-10-10", received: 0, refunds: 0, net: 0, count: 0 },
      { day: "2026-10-11", received: 100, refunds: 0, net: 100, count: 1 },
      { day: "2026-10-12", received: 450, refunds: 310, net: 140, count: 1 },
    ]);
    expect(r.received).toBe(450);
  });
});

describe("an empty day", () => {
  test("zeros and empty lists, never undefined", () => {
    const r = report([]);
    expect(r).toMatchObject({ received: 0, refunds: 0, net: 0, paymentCount: 0, freeCount: 0, installmentsIls: 0 });
    expect(r.byMethod).toEqual([]);
    expect(r.staff).toEqual([]);
    expect(r.arbox).toEqual({ entries: [], total: 0, unknownCount: 0 });
    expect(r.days).toEqual([{ day: DAY, received: 0, refunds: 0, net: 0, count: 0 }]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:run -- src/features/finance/lib/__tests__/income.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

`src/features/finance/lib/income.ts`:

```ts
/**
 * The income report: which money came in on which Israel day, how it split,
 * and who holds it. Pure: the loader fetches a slightly wider window and this
 * decides every day, every total and every exclusion, so the rules are tested
 * here and nowhere else. Spec: docs/superpowers/specs/2026-10-12-financial-reports-phase-1-design.md
 */
import { addDays, daysBetween } from "@/lib/utils/iso-date";
import { israelDateStr } from "@/lib/utils/israel-time";
import type { OrderStatus, PaymentMethod } from "@/types/plans";

/** A sale counts on the day it was paid even if it was later voided or refunded. */
export const COUNTED_STATUSES: readonly OrderStatus[] = ["paid", "refunded", "voided"];
/** The Arbox import writes 1 ILS when Arbox reported no amount. */
export const ARBOX_PLACEHOLDER_ILS = 1;
export const INCOME_METHODS = ["cash", "card", "bit", "transfer", "free"] as const;
export type IncomeMethod = (typeof INCOME_METHODS)[number];
export type RefundMethod = "card" | "cash" | "transfer" | "bit" | "arbox" | "none";

export interface StaffRef {
  id: string;
  name: string;
}

/** A staff payment whose staff member was deleted (received_by is ON DELETE SET NULL). */
export const UNKNOWN_STAFF: StaffRef = { id: "unknown", name: "לא ידוע" };

const HAND_METHODS: readonly PaymentMethod[] = ["cash", "bit", "transfer", "free"];

export interface IncomeOrderRow {
  id: string;
  status: OrderStatus;
  /** ISO timestamp the money arrived. */
  paidAt: string;
  amountIls: number;
  method: PaymentMethod | null;
  installments: number;
  listPriceIls: number | null;
  discountReason: string | null;
  reference: string | null;
  receivedBy: StaffRef | null;
  paymentLinkBy: StaffRef | null;
  childName: string;
  parentName: string;
  profileId: string | null;
  planName: string;
  branchId: string;
  branchName: string;
  receiptUrl: string | null;
  /** The Arbox purchase day; null for app sales and hand-entered Arbox repairs. */
  arboxPurchasedOn: string | null;
}

export interface IncomeRefundRow {
  id: string;
  createdAt: string;
  amountIls: number;
  method: RefundMethod;
  kind: "void" | "cancellation";
  createdBy: StaffRef;
  childName: string;
  planName: string;
  branchId: string;
  creditNoteNumber: string | null;
  /** When the refunded sale was paid; null when the Plan had no order. */
  salePaidAt: string | null;
}

export type Collector =
  | { kind: "staff"; staff: StaffRef }
  | { kind: "link"; staff: StaffRef }
  | { kind: "online" };

export interface IncomePayment extends IncomeOrderRow {
  day: string;
  collector: Collector;
  incomeMethod: IncomeMethod;
}

export interface IncomeRefund extends IncomeRefundRow {
  day: string;
}

export interface ArboxEntry extends IncomeOrderRow {
  day: string;
  unknownAmount: boolean;
}

export interface DayTotal {
  day: string;
  received: number;
  refunds: number;
  net: number;
  count: number;
}

export interface MethodTotal {
  method: IncomeMethod;
  total: number;
  count: number;
}

export interface BranchTotal {
  branchId: string;
  branchName: string;
  total: number;
  count: number;
}

export interface StaffCashUp {
  staff: StaffRef;
  cash: number;
  bit: number;
  transfer: number;
  /** Cash refunds this person recorded and paid out. */
  cashRefundsOut: number;
  /** cash + bit + transfer - cashRefundsOut: what they should account for. */
  inHand: number;
  /** Card links they sent that were paid: listed, never added. */
  linksSent: { orderId: string; childName: string; amountIls: number }[];
  freeGiven: number;
}

export interface IncomeReport {
  from: string;
  to: string;
  received: number;
  refunds: number;
  net: number;
  paymentCount: number;
  freeCount: number;
  installmentsIls: number;
  days: DayTotal[];
  byMethod: MethodTotal[];
  byBranch: BranchTotal[];
  staff: StaffCashUp[];
  payments: IncomePayment[];
  refundRows: IncomeRefund[];
  arbox: { entries: ArboxEntry[]; total: number; unknownCount: number };
}

export interface IncomeInput {
  from: string;
  to: string;
  /** First day of the day strip; on or before `from`. */
  stripFrom: string;
  orders: readonly IncomeOrderRow[];
  refunds: readonly IncomeRefundRow[];
}

/** Sums money without floating-point drift: numeric(10,2) amounts stay exact. */
const sum = (amounts: readonly number[]): number =>
  Math.round(amounts.reduce((total, amount) => total + amount, 0) * 100) / 100;

const dayList = (from: string, to: string): string[] =>
  Array.from({ length: daysBetween(from, to) + 1 }, (_, i) => addDays(from, i));

export function collectorOf(o: Pick<IncomeOrderRow, "receivedBy" | "paymentLinkBy" | "method">): Collector {
  if (o.receivedBy) return { kind: "staff", staff: o.receivedBy };
  if (o.paymentLinkBy) return { kind: "link", staff: o.paymentLinkBy };
  if (o.method !== null && HAND_METHODS.includes(o.method)) return { kind: "staff", staff: UNKNOWN_STAFF };
  return { kind: "online" };
}

/** Legacy Morning-hosted orders carry no method; they were card payments. */
const incomeMethodOf = (o: IncomeOrderRow): IncomeMethod => (o.method ?? "card") as IncomeMethod;

function staffCashUp(payments: readonly IncomePayment[], refunds: readonly IncomeRefund[]): StaffCashUp[] {
  const people = new Map<string, StaffRef>([
    ...payments.flatMap((p): [string, StaffRef][] =>
      p.collector.kind === "online" ? [] : [[p.collector.staff.id, p.collector.staff]],
    ),
    ...refunds.filter((r) => r.method === "cash").map((r): [string, StaffRef] => [r.createdBy.id, r.createdBy]),
  ]);

  return [...people.values()]
    .map((staff) => {
      const own = payments.filter((p) => p.collector.kind === "staff" && p.collector.staff.id === staff.id);
      const links = payments.filter((p) => p.collector.kind === "link" && p.collector.staff.id === staff.id);
      const by = (method: IncomeMethod) => sum(own.filter((p) => p.incomeMethod === method).map((p) => p.amountIls));
      const cash = by("cash");
      const bit = by("bit");
      const transfer = by("transfer");
      const cashRefundsOut = sum(
        refunds.filter((r) => r.method === "cash" && r.createdBy.id === staff.id).map((r) => r.amountIls),
      );
      return {
        staff,
        cash,
        bit,
        transfer,
        cashRefundsOut,
        inHand: sum([cash, bit, transfer, -cashRefundsOut]),
        linksSent: links.map((p) => ({ orderId: p.id, childName: p.childName, amountIls: p.amountIls })),
        freeGiven: own.filter((p) => p.incomeMethod === "free").length,
      };
    })
    .sort((a, b) => b.inHand - a.inHand);
}

export function buildIncomeReport({ from, to, stripFrom, orders, refunds }: IncomeInput): IncomeReport {
  const inRange = (day: string) => day >= from && day <= to;
  const counted = orders.filter((o) => COUNTED_STATUSES.includes(o.status));

  const allPayments: IncomePayment[] = counted
    .filter((o) => o.method !== "arbox")
    .map((o) => ({ ...o, day: israelDateStr(o.paidAt), collector: collectorOf(o), incomeMethod: incomeMethodOf(o) }));
  const allRefunds: IncomeRefund[] = refunds.map((r) => ({ ...r, day: israelDateStr(r.createdAt) }));

  const payments = allPayments.filter((p) => inRange(p.day)).sort((a, b) => a.paidAt.localeCompare(b.paidAt));
  const refundRows = allRefunds.filter((r) => inRange(r.day)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const arboxEntries: ArboxEntry[] = counted
    .filter((o) => o.method === "arbox")
    .map((o) => ({
      ...o,
      day: o.arboxPurchasedOn ?? israelDateStr(o.paidAt),
      unknownAmount: o.amountIls === ARBOX_PLACEHOLDER_ILS,
    }))
    .filter((e) => inRange(e.day))
    .sort((a, b) => a.day.localeCompare(b.day));

  const received = sum(payments.map((p) => p.amountIls));
  const refunded = sum(refundRows.map((r) => r.amountIls));

  const byMethod = INCOME_METHODS.map((method) => {
    const rows = payments.filter((p) => p.incomeMethod === method);
    return { method, total: sum(rows.map((p) => p.amountIls)), count: rows.length };
  }).filter((m) => m.count > 0);

  const branchIds = [...new Set(payments.map((p) => p.branchId))];
  const byBranch = branchIds
    .map((branchId) => {
      const rows = payments.filter((p) => p.branchId === branchId);
      return { branchId, branchName: rows[0].branchName, total: sum(rows.map((p) => p.amountIls)), count: rows.length };
    })
    .sort((a, b) => b.total - a.total);

  const days = dayList(stripFrom, to).map((day) => {
    const dayPayments = allPayments.filter((p) => p.day === day);
    const dayReceived = sum(dayPayments.map((p) => p.amountIls));
    const dayRefunds = sum(allRefunds.filter((r) => r.day === day).map((r) => r.amountIls));
    return { day, received: dayReceived, refunds: dayRefunds, net: sum([dayReceived, -dayRefunds]), count: dayPayments.length };
  });

  return {
    from,
    to,
    received,
    refunds: refunded,
    net: sum([received, -refunded]),
    paymentCount: payments.length,
    freeCount: payments.filter((p) => p.incomeMethod === "free").length,
    installmentsIls: sum(payments.filter((p) => p.incomeMethod === "card" && p.installments > 1).map((p) => p.amountIls)),
    days,
    byMethod,
    byBranch,
    staff: staffCashUp(payments, refundRows),
    payments,
    refundRows,
    arbox: {
      entries: arboxEntries,
      total: sum(arboxEntries.filter((e) => !e.unknownAmount).map((e) => e.amountIls)),
      unknownCount: arboxEntries.filter((e) => e.unknownAmount).length,
    },
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test:run -- src/features/finance/lib/__tests__/income.test.ts`
Expected: PASS. If a test fails, fix the implementation, not the test, unless the test contradicts the spec.

- [ ] **Step 5: Commit**

```bash
git add src/features/finance/lib/income.ts src/features/finance/lib/__tests__/income.test.ts
git commit -m "feat(finance): income report rules, tested

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The ending-soon list (pure)

**Files:**
- Create: `src/features/finance/lib/ending-soon.ts`
- Test: `src/features/finance/lib/__tests__/ending-soon.test.ts`

**Interfaces:**
- Consumes: `daysBetween` (`@/lib/utils/iso-date`), `PlanStatus` (`@/types/plans`).
- Produces:

```ts
export const STAFF_ENDING_DAYS = 7;
export const STAFF_ENDING_SESSIONS = 2;
export const RECENTLY_EXPIRED_DAYS = 14;
export interface EndingInput { profileId: string; status: PlanStatus; endsOn: string; sessionsLeft: number | null; cardsOnly: boolean; booked: number; reminded: boolean; linkWaiting: boolean; frozen: { endsOn: string | null } | null; paidInArbox: boolean }
export type EndingEntry<T extends EndingInput> = T & { by: "date" | "sessions"; daysLeft: number };
export type ExpiredEntry<T extends EndingInput> = T & { daysAgo: number };
export interface EndingSplit<T extends EndingInput> { ending: EndingEntry<T>[]; expired: ExpiredEntry<T>[] }
export function splitEnding<T extends EndingInput>(inputs: readonly T[], today: string): EndingSplit<T>;
export function endingSoonCount(inputs: readonly EndingInput[], today: string): number;
export type EndingFilter = "all" | "link" | "reminded" | "arbox" | "expired";
export function parseEndingFilter(value: string | undefined): EndingFilter;
export interface EndingCounts { all: number; byDate: number; bySessions: number; link: number; reminded: number; arbox: number; expired: number }
export function endingCounts<T extends EndingInput>(split: EndingSplit<T>): EndingCounts;
export function filterEnding<T extends EndingInput>(split: EndingSplit<T>, filter: EndingFilter): (EndingEntry<T> | ExpiredEntry<T>)[];
```

- [ ] **Step 1: Write the failing tests**

`src/features/finance/lib/__tests__/ending-soon.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import {
  endingCounts,
  endingSoonCount,
  filterEnding,
  parseEndingFilter,
  splitEnding,
  type EndingInput,
} from "../ending-soon";

const TODAY = "2026-10-12";

function queue(overrides: Partial<EndingInput> = {}): EndingInput {
  return {
    profileId: "p-1",
    status: "active",
    endsOn: "2026-12-31",
    sessionsLeft: null,
    cardsOnly: false,
    booked: 0,
    reminded: false,
    linkWaiting: false,
    frozen: null,
    paidInArbox: false,
    ...overrides,
  };
}

describe("ending by date", () => {
  test("7 days left is in; 8 is out", () => {
    expect(splitEnding([queue({ endsOn: "2026-10-19" })], TODAY).ending).toHaveLength(1);
    expect(splitEnding([queue({ endsOn: "2026-10-20" })], TODAY).ending).toHaveLength(0);
  });
  test("ending today is in, with 0 days left", () => {
    expect(splitEnding([queue({ endsOn: TODAY, status: "ending_soon" })], TODAY).ending[0]).toMatchObject({ by: "date", daysLeft: 0 });
  });
  test("a queue with a renewal behind it ends far out and is not listed", () => {
    expect(splitEnding([queue({ endsOn: "2026-12-20" })], TODAY).ending).toEqual([]);
  });
});

describe("ending by sessions", () => {
  test("a cards-only queue with 2 left is in; 3 is out", () => {
    expect(splitEnding([queue({ cardsOnly: true, sessionsLeft: 2 })], TODAY).ending[0]).toMatchObject({ by: "sessions" });
    expect(splitEnding([queue({ cardsOnly: true, sessionsLeft: 3 })], TODAY).ending).toEqual([]);
  });
  test("a mixed queue uses the date rule only", () => {
    expect(splitEnding([queue({ cardsOnly: false, sessionsLeft: 1 })], TODAY).ending).toEqual([]);
  });
});

describe("statuses", () => {
  test("cancelled queues are never listed", () => {
    const split = splitEnding([queue({ status: "cancelled", endsOn: "2026-10-13" })], TODAY);
    expect(split).toEqual({ ending: [], expired: [] });
  });
  test("expired 1 to 14 days ago is recently expired; 15 is not", () => {
    const split = splitEnding(
      [
        queue({ profileId: "a", status: "expired", endsOn: "2026-10-11" }),
        queue({ profileId: "b", status: "expired", endsOn: "2026-09-28" }),
        queue({ profileId: "c", status: "expired", endsOn: "2026-09-27" }),
      ],
      TODAY,
    );
    expect(split.expired.map((e) => [e.profileId, e.daysAgo])).toEqual([
      ["a", 1],
      ["b", 14],
    ]);
  });
});

describe("order and count", () => {
  const inputs = [
    queue({ profileId: "far", endsOn: "2026-10-19" }),
    queue({ profileId: "near", endsOn: "2026-10-13" }),
    queue({ profileId: "card0", cardsOnly: true, sessionsLeft: 0, endsOn: "2026-10-16" }),
    queue({ profileId: "card2", cardsOnly: true, sessionsLeft: 2, endsOn: "2026-10-16" }),
    queue({ profileId: "gone", status: "expired", endsOn: "2026-10-10" }),
  ];
  test("most urgent first: days left, then sessions left", () => {
    expect(splitEnding(inputs, TODAY).ending.map((e) => e.profileId)).toEqual(["near", "card0", "card2", "far"]);
  });
  test("the badge counts only the ending group", () => {
    expect(endingSoonCount(inputs, TODAY)).toBe(4);
  });
});

describe("filters", () => {
  const split = splitEnding(
    [
      queue({ profileId: "link", endsOn: "2026-10-14", linkWaiting: true }),
      queue({ profileId: "rem", endsOn: "2026-10-14", reminded: true }),
      queue({ profileId: "arbox", cardsOnly: true, sessionsLeft: 1, paidInArbox: true }),
      queue({ profileId: "gone", status: "expired", endsOn: "2026-10-05" }),
    ],
    TODAY,
  );
  test("counts per filter", () => {
    expect(endingCounts(split)).toEqual({ all: 3, byDate: 2, bySessions: 1, link: 1, reminded: 1, arbox: 1, expired: 1 });
  });
  test("each filter narrows the list", () => {
    expect(filterEnding(split, "link").map((e) => e.profileId)).toEqual(["link"]);
    expect(filterEnding(split, "reminded").map((e) => e.profileId)).toEqual(["rem"]);
    expect(filterEnding(split, "arbox").map((e) => e.profileId)).toEqual(["arbox"]);
    expect(filterEnding(split, "expired").map((e) => e.profileId)).toEqual(["gone"]);
    expect(filterEnding(split, "all")).toHaveLength(3);
  });
  test("an unknown ?show= is all", () => {
    expect(parseEndingFilter("nope")).toBe("all");
    expect(parseEndingFilter(undefined)).toBe("all");
    expect(parseEndingFilter("expired")).toBe("expired");
  });
});

describe("extra fields ride through", () => {
  test("display fields on the input come back on the entry", () => {
    const withName = { ...queue({ endsOn: "2026-10-14" }), traineeName: "ליה כהן" };
    expect(splitEnding([withName], TODAY).ending[0].traineeName).toBe("ליה כהן");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:run -- src/features/finance/lib/__tests__/ending-soon.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

`src/features/finance/lib/ending-soon.ts`:

```ts
/**
 * Who staff should call before a plan runs out. Pure, over each Trainee's
 * resolved Plan queue (src/lib/plans/plan-queue.ts): the queue already folds
 * renewals, freezes and bookings into one end date and one sessions count.
 * These thresholds are staff-only and wider than the parent reminders
 * (ENDING_SOON_DAYS there), on purpose: staff call before the parent's
 * WhatsApp goes out.
 */
import { daysBetween } from "@/lib/utils/iso-date";
import type { PlanStatus } from "@/types/plans";

export const STAFF_ENDING_DAYS = 7;
export const STAFF_ENDING_SESSIONS = 2;
export const RECENTLY_EXPIRED_DAYS = 14;

export interface EndingInput {
  profileId: string;
  status: PlanStatus;
  /** The last day of the whole queue. */
  endsOn: string;
  /** Unbooked sessions left on the queue's Cards; null with no Card. */
  sessionsLeft: number | null;
  cardsOnly: boolean;
  /** Future Bookings already charged to the queue. */
  booked: number;
  /** A parent reminder stamp is set on the queue's last Plan. */
  reminded: boolean;
  /** An unpaid Payment link waits for this Trainee. */
  linkWaiting: boolean;
  frozen: { endsOn: string | null } | null;
  /** The queue ends on a Plan paid in Arbox: no automatic reminder goes out. */
  paidInArbox: boolean;
}

export type EndingEntry<T extends EndingInput> = T & { by: "date" | "sessions"; daysLeft: number };
export type ExpiredEntry<T extends EndingInput> = T & { daysAgo: number };

export interface EndingSplit<T extends EndingInput> {
  ending: EndingEntry<T>[];
  expired: ExpiredEntry<T>[];
}

const RUNNING: readonly PlanStatus[] = ["active", "ending_soon"];

function endingBy(q: EndingInput, today: string): "date" | "sessions" | null {
  if (!RUNNING.includes(q.status)) return null;
  if (q.cardsOnly && q.sessionsLeft !== null && q.sessionsLeft <= STAFF_ENDING_SESSIONS) return "sessions";
  if (daysBetween(today, q.endsOn) <= STAFF_ENDING_DAYS) return "date";
  return null;
}

const bySessionsLeft = (q: EndingInput) => q.sessionsLeft ?? Number.MAX_SAFE_INTEGER;

export function splitEnding<T extends EndingInput>(inputs: readonly T[], today: string): EndingSplit<T> {
  const ending = inputs
    .flatMap((q): EndingEntry<T>[] => {
      const by = endingBy(q, today);
      return by ? [{ ...q, by, daysLeft: daysBetween(today, q.endsOn) }] : [];
    })
    .sort((a, b) => a.daysLeft - b.daysLeft || bySessionsLeft(a) - bySessionsLeft(b));

  const expired = inputs
    .flatMap((q): ExpiredEntry<T>[] => {
      if (q.status !== "expired") return [];
      const daysAgo = daysBetween(q.endsOn, today);
      return daysAgo >= 1 && daysAgo <= RECENTLY_EXPIRED_DAYS ? [{ ...q, daysAgo }] : [];
    })
    .sort((a, b) => a.daysAgo - b.daysAgo);

  return { ending, expired };
}

export function endingSoonCount(inputs: readonly EndingInput[], today: string): number {
  return splitEnding(inputs, today).ending.length;
}

export type EndingFilter = "all" | "link" | "reminded" | "arbox" | "expired";
const FILTERS: readonly EndingFilter[] = ["all", "link", "reminded", "arbox", "expired"];

export function parseEndingFilter(value: string | undefined): EndingFilter {
  return FILTERS.find((f) => f === value) ?? "all";
}

export interface EndingCounts {
  all: number;
  byDate: number;
  bySessions: number;
  link: number;
  reminded: number;
  arbox: number;
  expired: number;
}

export function endingCounts<T extends EndingInput>(split: EndingSplit<T>): EndingCounts {
  const { ending, expired } = split;
  return {
    all: ending.length,
    byDate: ending.filter((e) => e.by === "date").length,
    bySessions: ending.filter((e) => e.by === "sessions").length,
    link: ending.filter((e) => e.linkWaiting).length,
    reminded: ending.filter((e) => e.reminded).length,
    arbox: ending.filter((e) => e.paidInArbox).length,
    expired: expired.length,
  };
}

export function filterEnding<T extends EndingInput>(
  split: EndingSplit<T>,
  filter: EndingFilter,
): (EndingEntry<T> | ExpiredEntry<T>)[] {
  switch (filter) {
    case "link":
      return split.ending.filter((e) => e.linkWaiting);
    case "reminded":
      return split.ending.filter((e) => e.reminded);
    case "arbox":
      return split.ending.filter((e) => e.paidInArbox);
    case "expired":
      return split.expired;
    default:
      return split.ending;
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test:run -- src/features/finance/lib/__tests__/ending-soon.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/finance/lib/ending-soon.ts src/features/finance/lib/__tests__/ending-soon.test.ts
git commit -m "feat(finance): ending-soon rules for staff, tested

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Loaders, the badge count, and the menu

**Files:**
- Create: `src/features/finance/lib/queries.ts`
- Create: `src/features/finance/lib/cache-tags.ts`
- Create: `src/features/finance/lib/ending-soon-count.ts`
- Modify: `src/features/plans/lib/revalidate-staff.ts`
- Modify: `src/lib/navigation/admin-nav.ts`
- Modify: `src/app/admin/layout.tsx` (the `navBadges` block, around the `getTaskCountsAction()` call)

**Interfaces:**
- Consumes: everything from Tasks 2 to 4; `loadPlanQueues`, `PlanQueueView` (`@/features/plans/lib/queries`); `verifyAdmin` (`@/lib/actions/shared`); `createAdminClient` (`@/lib/supabase/admin`); `typedFrom` (`@/lib/supabase/helpers`); `israelToday` (`@/lib/utils/tasks`); `orderPlanName` (`@/lib/plans/manual-card`); `BranchOption` (`@/types/branches`).
- Produces:

```ts
export type FinanceResult<T> = { success: true; data: T } | { success: false; error: string };
export interface FinanceBranches { selling: BranchOption[]; notSelling: BranchOption[] }
export function loadFinanceBranches(): Promise<FinanceBranches>;
export function loadIncomeReport(range: ReportRange, branchId: string | null): Promise<FinanceResult<IncomeReport>>;
export interface EndingRow extends EndingInput { traineeName: string; guardianName: string | null; guardianPhone: string | null; branchId: string; branchName: string; planName: string; frozenLabel: string | null }
export function loadEndingInputs(db: SupabaseClient, branchId: string | null): Promise<EndingRow[]>;
export function loadEndingSoon(branchId: string | null): Promise<FinanceResult<EndingSplit<EndingRow>>>;
// cache-tags.ts (no imports, so plan actions can import it cheaply)
export const ENDING_SOON_TAG = "finance-ending-soon";
// ending-soon-count.ts
export function endingSoonBadgeCount(): Promise<number>;
```

This task is I/O glue with no unit tests (project rule: tests cover pure functions only). It is verified by `tsc` here and by the manual preview check in Task 8.

- [ ] **Step 1: Write the loaders**

`src/features/finance/lib/queries.ts`:

```ts
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { verifyAdmin } from "@/lib/actions/shared";
import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/helpers";
import { addDays } from "@/lib/utils/iso-date";
import { israelToday } from "@/lib/utils/tasks";
import { orderPlanName } from "@/lib/plans/manual-card";
import { loadPlanQueues, type PlanQueueView } from "@/features/plans/lib/queries";
import type { BranchOption } from "@/types/branches";
import type { OrderStatus, PaymentMethod } from "@/types/plans";
import {
  buildIncomeReport,
  COUNTED_STATUSES,
  type IncomeOrderRow,
  type IncomeRefundRow,
  type IncomeReport,
  type RefundMethod,
  type StaffRef,
} from "./income";
import { splitEnding, type EndingInput, type EndingSplit } from "./ending-soon";
import { stripStart, type ReportRange } from "./range";

export type FinanceResult<T> = { success: true; data: T } | { success: false; error: string };

const NO_ACCESS = "אין הרשאה לדוחות הכספיים";
const LOAD_FAILED = "לא הצלחנו לטעון את הדוח. נסו לרענן את הדף";

export interface FinanceBranches {
  /** Branches that sell in the app: an active product or any counted order. */
  selling: BranchOption[];
  /** Active branches that do not (today חיפה, which runs on Arbox). */
  notSelling: BranchOption[];
}

export async function loadFinanceBranches(): Promise<FinanceBranches> {
  const { error } = await verifyAdmin();
  if (error) return { selling: [], notSelling: [] };
  const db = createAdminClient();
  const { data: branches } = (await typedFrom(db, "branches")
    .select("id, name_he")
    .eq("is_active", true)
    .order("order_index")) as { data: { id: string; name_he: string }[] | null };

  const sells = await Promise.all(
    (branches ?? []).map(async (b) => {
      const [products, orders] = await Promise.all([
        typedFrom(db, "plan_products").select("id", { count: "exact", head: true }).eq("branch_id", b.id).eq("is_active", true),
        typedFrom(db, "orders").select("id", { count: "exact", head: true }).eq("branch_id", b.id).in("status", [...COUNTED_STATUSES]),
      ]);
      return (products.count ?? 0) + (orders.count ?? 0) > 0;
    }),
  );
  const options = (branches ?? []).map((b) => ({ id: b.id, nameHe: b.name_he }));
  return {
    selling: options.filter((_, i) => sells[i]),
    notSelling: options.filter((_, i) => !sells[i]),
  };
}

const ORDER_SELECT =
  "id, status, paid_at, amount_ils, payment_method, installments, list_price_ils, discount_reason, reference, child_name, parent_name, profile_id, branch_id, morning_document_url, arbox_purchased_on, terms_sessions_total, terms_duration_days, product:plan_products(name_he), branch:branches(name_he), receiver:profiles!orders_received_by_fkey(id, full_name), linker:profiles!orders_payment_link_by_fkey(id, full_name)";

interface OrderSelectRow {
  id: string;
  status: OrderStatus;
  paid_at: string | null;
  amount_ils: number | string;
  payment_method: PaymentMethod | null;
  installments: number;
  list_price_ils: number | string | null;
  discount_reason: string | null;
  reference: string | null;
  child_name: string;
  parent_name: string;
  profile_id: string | null;
  branch_id: string;
  morning_document_url: string | null;
  arbox_purchased_on: string | null;
  terms_sessions_total: number | null;
  terms_duration_days: number | null;
  product: { name_he: string } | null;
  branch: { name_he: string } | null;
  receiver: { id: string; full_name: string | null } | null;
  linker: { id: string; full_name: string | null } | null;
}

const REFUND_SELECT =
  "id, created_at, amount_ils, method, kind, credit_note_number, creator:profiles!plan_refunds_created_by_fkey(id, full_name), plan:trainee_plans!plan_refunds_plan_id_fkey(branch_id, product:plan_products(name_he), trainee:profiles!trainee_plans_profile_id_fkey(full_name)), order:orders!plan_refunds_order_id_fkey(child_name, paid_at)";

interface RefundSelectRow {
  id: string;
  created_at: string;
  amount_ils: number | string;
  method: RefundMethod;
  kind: "void" | "cancellation";
  credit_note_number: string | null;
  creator: { id: string; full_name: string | null } | null;
  plan: { branch_id: string; product: { name_he: string } | null; trainee: { full_name: string | null } | null } | null;
  order: { child_name: string; paid_at: string | null } | null;
}

const staffRef = (p: { id: string; full_name: string | null } | null): StaffRef | null =>
  p ? { id: p.id, name: p.full_name ?? "לא ידוע" } : null;

function toOrderRow(o: OrderSelectRow): IncomeOrderRow {
  return {
    id: o.id,
    status: o.status,
    paidAt: o.paid_at as string,
    amountIls: Number(o.amount_ils),
    method: o.payment_method,
    installments: o.installments,
    listPriceIls: o.list_price_ils === null ? null : Number(o.list_price_ils),
    discountReason: o.discount_reason,
    reference: o.reference,
    receivedBy: staffRef(o.receiver),
    paymentLinkBy: staffRef(o.linker),
    childName: o.child_name,
    parentName: o.parent_name,
    profileId: o.profile_id,
    planName: orderPlanName(o.product?.name_he ?? "מסלול", o),
    branchId: o.branch_id,
    branchName: o.branch?.name_he ?? "",
    receiptUrl: o.morning_document_url,
    arboxPurchasedOn: o.arbox_purchased_on,
  };
}

function toRefundRow(r: RefundSelectRow): IncomeRefundRow {
  return {
    id: r.id,
    createdAt: r.created_at,
    amountIls: Number(r.amount_ils),
    method: r.method,
    kind: r.kind,
    createdBy: staffRef(r.creator) ?? { id: "unknown", name: "לא ידוע" },
    childName: r.order?.child_name ?? r.plan?.trainee?.full_name ?? "",
    planName: r.plan?.product?.name_he ?? "מסלול",
    branchId: r.plan?.branch_id ?? "",
    creditNoteNumber: r.credit_note_number,
    salePaidAt: r.order?.paid_at ?? null,
  };
}

export async function loadIncomeReport(
  range: ReportRange,
  branchId: string | null,
): Promise<FinanceResult<IncomeReport>> {
  const { error } = await verifyAdmin();
  if (error) return { success: false, error: NO_ACCESS };

  try {
    const db = createAdminClient();
    const stripFrom = stripStart(range);
    // One day wider on each side: the pure report assigns Israel days.
    const fromIso = `${addDays(stripFrom, -1)}T00:00:00Z`;
    const toIso = `${addDays(range.to, 2)}T00:00:00Z`;
    const scoped = <Q extends { eq: (c: string, v: string) => Q }>(q: Q): Q => (branchId ? q.eq("branch_id", branchId) : q);

    const [byPaidAt, arboxByDay, refunds] = await Promise.all([
      scoped(typedFrom(db, "orders").select(ORDER_SELECT))
        .in("status", [...COUNTED_STATUSES])
        .gte("paid_at", fromIso)
        .lt("paid_at", toIso),
      // An Arbox purchase can be imported days after it happened.
      scoped(typedFrom(db, "orders").select(ORDER_SELECT))
        .in("status", [...COUNTED_STATUSES])
        .eq("payment_method", "arbox")
        .gte("arbox_purchased_on", range.from)
        .lte("arbox_purchased_on", range.to),
      typedFrom(db, "plan_refunds").select(REFUND_SELECT).gte("created_at", fromIso).lt("created_at", toIso),
    ]);
    if (byPaidAt.error || arboxByDay.error || refunds.error) {
      console.error("loadIncomeReport error:", byPaidAt.error ?? arboxByDay.error ?? refunds.error);
      return { success: false, error: LOAD_FAILED };
    }

    const orderRows = [...((byPaidAt.data ?? []) as OrderSelectRow[]), ...((arboxByDay.data ?? []) as OrderSelectRow[])];
    const uniqueOrders = [...new Map(orderRows.map((o) => [o.id, o])).values()].filter((o) => o.paid_at !== null);
    const refundRows = ((refunds.data ?? []) as RefundSelectRow[])
      .map(toRefundRow)
      .filter((r) => !branchId || r.branchId === branchId);

    return {
      success: true,
      data: buildIncomeReport({
        from: range.from,
        to: range.to,
        stripFrom,
        orders: uniqueOrders.map(toOrderRow),
        refunds: refundRows,
      }),
    };
  } catch (err) {
    console.error("loadIncomeReport failed:", err);
    return { success: false, error: LOAD_FAILED };
  }
}

export interface EndingRow extends EndingInput {
  traineeName: string;
  guardianName: string | null;
  guardianPhone: string | null;
  branchId: string;
  branchName: string;
  planName: string;
  /** "מוקפא עד 20.10" or "מוקפא" for an open freeze; null when not frozen. */
  frozenLabel: string | null;
}

const REMINDER_STAMPS = ["reminded_3_days_at", "reminded_last_session_at", "reminded_expired_at"] as const;

function toEndingInput(profileId: string, view: PlanQueueView, linkWaiting: boolean): EndingInput {
  const last = view.queue.plans.at(-1)?.plan ?? view.plan;
  return {
    profileId,
    status: view.status,
    endsOn: view.endsOn,
    sessionsLeft: view.sessionsLeft,
    cardsOnly: view.queue.cardsOnly,
    booked: view.queue.ahead.reduce((total, p) => total + p.booked, 0),
    reminded: REMINDER_STAMPS.some((stamp) => last[stamp] !== null),
    linkWaiting,
    frozen: view.queue.frozen ? { endsOn: view.queue.frozen.endsOn } : null,
    paidInArbox: last.paidInArbox,
  };
}

/** Every Trainee with a sold Plan, as ending-soon inputs. No auth check: callers gate. */
export async function loadEndingInputs(db: SupabaseClient, branchId: string | null): Promise<EndingRow[]> {
  const planQuery = typedFrom(db, "trainee_plans").select("profile_id").neq("status", "voided");
  const { data: planRows } = (await (branchId ? planQuery.eq("branch_id", branchId) : planQuery)) as {
    data: { profile_id: string }[] | null;
  };
  const ids = [...new Set((planRows ?? []).map((r) => r.profile_id))];
  if (ids.length === 0) return [];

  const today = israelToday();
  const [queues, { data: profiles }, { data: links }, { data: branches }] = await Promise.all([
    loadPlanQueues(db, ids, today),
    typedFrom(db, "profiles").select("id, full_name, guardian_name, guardian_phone").in("id", ids),
    typedFrom(db, "orders").select("profile_id").in("status", ["pending", "expired"]).in("profile_id", ids),
    typedFrom(db, "branches").select("id, name_he"),
  ]);
  const profileById = new Map(
    ((profiles ?? []) as { id: string; full_name: string | null; guardian_name: string | null; guardian_phone: string | null }[]).map(
      (p) => [p.id, p],
    ),
  );
  const waiting = new Set(((links ?? []) as { profile_id: string | null }[]).map((l) => l.profile_id));
  const branchName = new Map(((branches ?? []) as { id: string; name_he: string }[]).map((b) => [b.id, b.name_he]));

  return [...queues].map(([profileId, view]) => {
    const profile = profileById.get(profileId);
    const input = toEndingInput(profileId, view, waiting.has(profileId));
    const freezeEnd = input.frozen?.endsOn;
    return {
      ...input,
      traineeName: profile?.full_name ?? "ללא שם",
      guardianName: profile?.guardian_name ?? null,
      guardianPhone: profile?.guardian_phone ?? null,
      branchId: view.plan.branch_id,
      branchName: branchName.get(view.plan.branch_id) ?? "",
      planName: view.product.name_he,
      frozenLabel: input.frozen
        ? freezeEnd
          ? `מוקפא עד ${Number(freezeEnd.slice(8, 10))}.${Number(freezeEnd.slice(5, 7))}`
          : "מוקפא"
        : null,
    };
  });
}

export async function loadEndingSoon(branchId: string | null): Promise<FinanceResult<EndingSplit<EndingRow>>> {
  const { error } = await verifyAdmin();
  if (error) return { success: false, error: NO_ACCESS };
  try {
    const rows = await loadEndingInputs(createAdminClient(), branchId);
    return { success: true, data: splitEnding(rows, israelToday()) };
  } catch (err) {
    console.error("loadEndingSoon failed:", err);
    return { success: false, error: LOAD_FAILED };
  }
}
```

If `tsc` rejects the generic `scoped()` helper against the Supabase builder types, inline the two branch conditions instead (`let q = ...; if (branchId) q = q.eq("branch_id", branchId);` is mutation of a local binding, which is acceptable for a query builder; prefer a ternary: `const q = branchId ? base.eq("branch_id", branchId) : base;`).

- [ ] **Step 2: Write the cached badge count**

`src/features/finance/lib/cache-tags.ts`:

```ts
/** Cache tag of the ending-soon menu badge; plan changes clear it. */
export const ENDING_SOON_TAG = "finance-ending-soon";
```

`src/features/finance/lib/ending-soon-count.ts`:

```ts
import "server-only";

import { unstable_cache } from "next/cache";
import { verifyAdmin } from "@/lib/actions/shared";
import { createAdminClient } from "@/lib/supabase/admin";
import { israelToday } from "@/lib/utils/tasks";
import { ENDING_SOON_TAG } from "./cache-tags";
import { endingSoonCount } from "./ending-soon";
import { loadEndingInputs } from "./queries";

/** Ten minutes; plan changes clear it at once through revalidateStaffSurfaces. */
const BADGE_SECONDS = 600;

const cachedCount = unstable_cache(
  async () => endingSoonCount(await loadEndingInputs(createAdminClient(), null), israelToday()),
  ["finance-ending-soon-count"],
  { revalidate: BADGE_SECONDS, tags: [ENDING_SOON_TAG] },
);

/** The menu badge: 0 for non-admins and on any failure, so the menu never breaks. */
export async function endingSoonBadgeCount(): Promise<number> {
  const { error } = await verifyAdmin();
  if (error) return 0;
  try {
    return await cachedCount();
  } catch (err) {
    console.error("endingSoonBadgeCount failed:", err);
    return 0;
  }
}
```

- [ ] **Step 3: Clear the badge and the finance pages on every plan change**

`src/features/plans/lib/revalidate-staff.ts` becomes:

```ts
import "server-only";

import { revalidatePath, revalidateTag } from "next/cache";
import { ENDING_SOON_TAG } from "@/features/finance/lib/cache-tags";

/** Every staff screen that shows a trainee's plan or orders. */
export function revalidateStaffSurfaces(profileId: string): void {
  revalidatePath(`/admin/users/${profileId}`);
  revalidatePath("/admin/users");
  revalidatePath("/admin/plans");
  revalidatePath("/admin/orders");
  revalidatePath("/admin/schedule");
  revalidatePath("/admin/calendar");
  revalidatePath("/admin/finance");
  revalidatePath("/admin/finance/ending-soon");
  // Next 16 takes a cache-life profile; expire 0 drops the cached count now.
  revalidateTag(ENDING_SOON_TAG, { expire: 0 });
}
```

Keep the existing signature exactly (callers pass a profile id; if the file on this branch already accepts `string | null`, keep that and guard the first `revalidatePath` with `if (profileId)`).

- [ ] **Step 4: Add the menu section**

In `src/lib/navigation/admin-nav.ts`, add `Hourglass` and `Wallet` to the lucide import, remove the `/admin/orders` item from "שיווק ולקוחות", and insert after the "תפעול" section:

```ts
  {
    label: "דוחות כספיים",
    items: [
      { href: "/admin/finance", label: "הכנסות", icon: Wallet, exact: true, adminOnly: true },
      { href: "/admin/finance/ending-soon", label: "מסתיימים בקרוב", icon: Hourglass, adminOnly: true },
      { href: "/admin/orders", label: "הזמנות", icon: Receipt, adminOnly: true },
    ],
  },
```

`exact: true` on `/admin/finance` keeps it from lighting up on `/admin/finance/ending-soon`.

- [ ] **Step 5: Put the badge on the menu**

In `src/app/admin/layout.tsx`, import `endingSoonBadgeCount` from `@/features/finance/lib/ending-soon-count` and replace the task-count lines with a parallel read:

```ts
  const [countsResult, endingSoon] = await Promise.all([
    getTaskCountsAction(),
    isAdmin ? endingSoonBadgeCount() : Promise.resolve(0),
  ]);
  const taskBadge =
    "success" in countsResult
      ? isAdmin
        ? countsResult.data.overdue + countsResult.data.awaitingReview
        : countsResult.data.open
      : 0;
  const navBadges = { "/admin/tasks": taskBadge, "/admin/finance/ending-soon": endingSoon };
```

Keep the existing comments above these lines.

- [ ] **Step 6: Type-check, lint, and run the whole suite**

Run: `npx tsc --noEmit && npm run lint && npm run test:run`
Expected: no type errors, no lint errors, all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/features/finance/lib/queries.ts src/features/finance/lib/cache-tags.ts src/features/finance/lib/ending-soon-count.ts src/features/plans/lib/revalidate-staff.ts src/lib/navigation/admin-nav.ts src/app/admin/layout.tsx
git commit -m "feat(finance): report loaders, ending-soon badge and menu section

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: The income page

**Files:**
- Create: `src/app/admin/finance/page.tsx`
- Create: `src/features/finance/components/RangeControl.tsx`
- Create: `src/features/finance/components/SummarySection.tsx`
- Create: `src/features/finance/components/IncomeSummary.tsx`
- Create: `src/features/finance/components/IncomeLedger.tsx`
- Create: `src/features/finance/components/IncomeTables.tsx`

**Interfaces:**
- Consumes: `loadFinanceBranches`, `loadIncomeReport` (Task 5); `parseRange`, `parseBranchParam`, `ReportRange` (Task 2); `formatIls` (Task 2); `timeOf`, `shortDay`, `rangeLabel` (Task 2); report types (Task 3); `BranchUrlFilter` (`@/features/branches/components/BranchUrlFilter`); `ToolbarDateRange` (`@/components/admin/TableToolbar`); `useIsMobile` (`@/hooks/use-mobile` or the path the repo uses; find it with `grep -rn "export function useIsMobile" src`); shadcn `Table`, `Tabs`, `Badge`; `PAYMENT_METHOD_LABELS_HE`.
- Produces: the `/admin/finance` route.

Visual reference: `.impeccable/mockups/finance/shots/split-income-desk.png` and `split-income-phone.png`. Match the composition: a 340px start-side sticky column (RTL: the first grid column renders on the right), the ledger beside it; on phone the summary stacks first with collapsible sections.

- [ ] **Step 1: Range control (client)**

`src/features/finance/components/RangeControl.tsx`:

```tsx
"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ToolbarDateRange } from "@/components/admin/TableToolbar";
import { cn } from "@/lib/utils";
import type { RangePreset, ReportRange } from "../lib/range";

const PRESETS: { value: RangePreset; label: string }[] = [
  { value: "day", label: "היום" },
  { value: "week", label: "שבוע" },
  { value: "month", label: "חודש" },
  { value: "custom", label: "טווח" },
];

/** Day, week, month or a typed range, kept in the URL so the server page reads it. */
export function RangeControl({ range }: { range: ReportRange }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);

  const go = (next: Record<string, string | null>) => {
    const entries = [...search.entries()].filter(([key]) => !(key in next));
    const added = Object.entries(next).filter((entry): entry is [string, string] => entry[1] !== null);
    router.push(`${pathname}?${new URLSearchParams([...entries, ...added]).toString()}`);
  };

  const choose = (preset: RangePreset) => {
    if (preset === "day") go({ range: null, from: null, to: null });
    else if (preset === "custom") go({ range: "custom", from, to });
    else go({ range: preset, from: null, to: null });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div role="radiogroup" aria-label="טווח הדוח" className="inline-flex gap-0.5 rounded-lg bg-muted p-1">
        {PRESETS.map((p) => (
          <button
            key={p.value}
            type="button"
            role="radio"
            aria-checked={range.preset === p.value}
            onClick={() => choose(p.value)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring",
              range.preset === p.value && "bg-card text-foreground shadow-sm",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      {range.preset === "custom" && (
        <ToolbarDateRange
          startDate={from}
          endDate={to}
          onStartDateChange={(value) => {
            setFrom(value);
            go({ range: "custom", from: value, to });
          }}
          onEndDateChange={(value) => {
            setTo(value);
            go({ range: "custom", from, to: value });
          }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Collapsible summary section (client)**

`src/features/finance/components/SummarySection.tsx`:

```tsx
"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

/**
 * A summary block: always open on desktop; on a phone it collapses unless it
 * is the one staff need first (the cash-up).
 */
export function SummarySection({
  title,
  meta,
  openOnPhone = false,
  children,
}: {
  title: string;
  meta?: string;
  openOnPhone?: boolean;
  children: ReactNode;
}) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(openOnPhone);
  const shown = !isMobile || open;

  return (
    <section className="border-t px-4 py-4 first:border-t-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={shown}
        disabled={!isMobile}
        className="flex w-full items-baseline justify-between gap-3 text-start disabled:cursor-default"
      >
        <h2 className="text-sm font-bold">{title}</h2>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          {meta}
          {isMobile && <ChevronDown className={cn("h-4 w-4 transition-transform", shown && "rotate-180")} />}
        </span>
      </button>
      {shown && <div className="mt-3">{children}</div>}
    </section>
  );
}
```

Use the repo's actual `useIsMobile` import path (find it with `grep -rn "export function useIsMobile" src`).

- [ ] **Step 3: The summary column (server)**

`src/features/finance/components/IncomeSummary.tsx`:

```tsx
import Link from "next/link";
import { ArrowLeftRight, Banknote, CreditCard, Gift, Smartphone, type LucideIcon } from "lucide-react";
import { formatIls } from "@/lib/utils/money";
import { cn } from "@/lib/utils";
import { shortDay } from "../lib/format";
import type { IncomeMethod, IncomeReport } from "../lib/income";
import { SummarySection } from "./SummarySection";

const METHOD: Record<IncomeMethod, { label: string; icon: LucideIcon }> = {
  cash: { label: "מזומן", icon: Banknote },
  card: { label: "אשראי", icon: CreditCard },
  bit: { label: "ביט", icon: Smartphone },
  transfer: { label: "העברה", icon: ArrowLeftRight },
  free: { label: "ללא תשלום", icon: Gift },
};

const Money = ({ amount, className }: { amount: number; className?: string }) => (
  <span dir="ltr" className={cn("tabular-nums", className)}>
    {formatIls(amount)}
  </span>
);

export function IncomeSummary({ report, dayHref }: { report: IncomeReport; dayHref: (day: string) => string }) {
  const maxMethod = Math.max(1, ...report.byMethod.map((m) => m.total));
  const branchTotal = report.byBranch.reduce((total, b) => total + b.total, 0);

  return (
    <aside aria-label="סיכום" className="rounded-xl border bg-card lg:sticky lg:top-4">
      <nav aria-label="ימים" className="flex gap-1.5 overflow-x-auto border-b p-3">
        {report.days.map((d) => {
          const selected = d.day >= report.from && d.day <= report.to;
          return (
            <Link
              key={d.day}
              href={dayHref(d.day)}
              aria-current={selected && report.from === report.to ? "date" : undefined}
              className={cn(
                "min-w-16 shrink-0 rounded-lg bg-muted px-2 py-1.5 text-center text-xs text-muted-foreground transition-colors hover:bg-secondary",
                selected && "bg-secondary text-foreground ring-1 ring-primary/40",
              )}
            >
              <span className="block">{shortDay(d.day)}</span>
              <Money amount={d.net} className="block font-bold text-foreground" />
            </Link>
          );
        })}
      </nav>

      <div className="border-b px-4 py-5">
        <p className="text-sm text-muted-foreground">{report.from === report.to ? "נטו היום" : "נטו בטווח"}</p>
        <Money amount={report.net} className="block text-4xl font-black leading-tight" />
        <p className="mt-1 text-sm">
          התקבל <Money amount={report.received} className="font-semibold" /> · הוחזר{" "}
          <Money amount={report.refunds} className="font-semibold text-destructive" />
        </p>
        {(report.arbox.entries.length > 0) && (
          <p className="mt-2 text-sm text-muted-foreground">
            נמכר ב-Arbox: <Money amount={report.arbox.total} className="font-semibold text-foreground" /> (
            {report.arbox.entries.length} רכישות)
            {report.arbox.unknownCount > 0 && ` · ${report.arbox.unknownCount} ללא סכום`}
          </p>
        )}
      </div>

      <SummarySection title="לפי אמצעי תשלום" meta={`${report.byMethod.length} אמצעים`}>
        {report.byMethod.length === 0 ? (
          <p className="text-sm text-muted-foreground">אין תשלומים בטווח</p>
        ) : (
          <ul className="space-y-3">
            {report.byMethod.map((m) => {
              const { label, icon: Icon } = METHOD[m.method];
              return (
                <li key={m.method}>
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-1.5">
                      <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
                      {label}
                      <span className="text-xs text-muted-foreground tabular-nums">{m.count}</span>
                    </span>
                    <Money amount={m.total} className="font-semibold" />
                  </div>
                  {m.method !== "free" && (
                    <div className="mt-1 h-1.5 rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ inlineSize: `${(m.total / maxMethod) * 100}%` }} />
                    </div>
                  )}
                  {m.method === "card" && report.installmentsIls > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      מתוכם <Money amount={report.installmentsIls} /> בתשלומים
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </SummarySection>

      <SummarySection title="לפי סניף" meta={`${report.byBranch.length} סניפים`}>
        {report.byBranch.length > 1 && branchTotal > 0 && (
          <div className="mb-2 flex h-2 overflow-hidden rounded-full bg-muted">
            {report.byBranch.map((b, i) => (
              <div
                key={b.branchId}
                className={i === 0 ? "bg-primary" : "bg-primary/40"}
                style={{ inlineSize: `${(b.total / branchTotal) * 100}%` }}
              />
            ))}
          </div>
        )}
        <ul className="space-y-1 text-sm">
          {report.byBranch.map((b) => (
            <li key={b.branchId} className="flex justify-between gap-2">
              <span>
                {b.branchName} <span className="text-xs text-muted-foreground tabular-nums">{b.count}</span>
              </span>
              <Money amount={b.total} className="font-semibold" />
            </li>
          ))}
        </ul>
      </SummarySection>

      <SummarySection title="קופה לפי איש צוות" meta="מזומן, ביט והעברה" openOnPhone>
        {report.staff.length === 0 ? (
          <p className="text-sm text-muted-foreground">אף איש צוות לא גבה כסף בטווח</p>
        ) : (
          <ul className="divide-y">
            {report.staff.map((s) => (
              <li key={s.staff.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-bold">{s.staff.name}</span>
                  <span className="text-sm">
                    <span className="text-xs text-muted-foreground">בידיים </span>
                    <Money amount={s.inHand} className="text-lg font-bold" />
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {[
                    s.cash > 0 && `מזומן ${formatIls(s.cash)}`,
                    s.bit > 0 && `ביט ${formatIls(s.bit)}`,
                    s.transfer > 0 && `העברה ${formatIls(s.transfer)}`,
                    s.freeGiven > 0 && `${s.freeGiven} ללא תשלום`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {s.cashRefundsOut > 0 && (
                  <p className="mt-1 rounded-md bg-destructive/10 px-2 py-1 text-xs text-destructive">
                    שילם החזר במזומן <Money amount={s.cashRefundsOut} />, ירד מהקופה
                  </p>
                )}
                {s.linksSent.length > 0 && (
                  <p className="mt-1 rounded-md bg-secondary px-2 py-1 text-xs">
                    קישורי אשראי שנשלחו:{" "}
                    {s.linksSent.map((l) => `${l.childName} ${formatIls(l.amountIls)}`).join(", ")} · לא עבר בידיים
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </SummarySection>
    </aside>
  );
}
```

- [ ] **Step 4: The ledger tables (server)**

`src/features/finance/components/IncomeTables.tsx`:

```tsx
import { FileText, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatIls } from "@/lib/utils/money";
import { israelDateStr } from "@/lib/utils/israel-time";
import { shortDay, timeOf } from "../lib/format";
import type { ArboxEntry, IncomePayment, IncomeRefund } from "../lib/income";

const METHOD_LABEL = { cash: "מזומן", card: "אשראי", bit: "ביט", transfer: "העברה", free: "ללא תשלום" } as const;
const REFUND_METHOD_LABEL = { card: "אשראי", cash: "מזומן", transfer: "העברה", bit: "ביט", arbox: "Arbox", none: "ללא" } as const;
const REFUND_KIND_LABEL = { void: "ביטול רישום", cancellation: "ביטול מסלול" } as const;

const Money = ({ amount, className }: { amount: number; className?: string }) => (
  <span dir="ltr" className={`tabular-nums ${className ?? ""}`}>
    {formatIls(amount)}
  </span>
);

const when = (iso: string, day: string, multiDay: boolean) => (multiDay ? `${shortDay(day)} ${timeOf(iso)}` : timeOf(iso));

function takenBy(p: IncomePayment): string {
  if (p.collector.kind === "online") return "אונליין";
  if (p.collector.kind === "link") return `קישור · ${p.collector.staff.name}`;
  return p.collector.staff.name;
}

function AmountCell({ p }: { p: IncomePayment }) {
  const undone = p.status === "voided" || p.status === "refunded";
  return (
    <div>
      <Money amount={p.amountIls} className={`font-semibold ${undone ? "line-through decoration-muted-foreground" : ""}`} />
      {p.status === "voided" && <Badge variant="destructive" className="ms-2">בוטל</Badge>}
      {p.status === "refunded" && <Badge variant="outline" className="ms-2">הוחזר</Badge>}
      {p.incomeMethod === "card" && p.installments > 1 && (
        <div className="text-xs text-muted-foreground">{p.installments} תשלומים</div>
      )}
      {p.listPriceIls !== null && (
        <div className="text-xs text-muted-foreground">
          <Money amount={p.listPriceIls} className="line-through" /> · {p.discountReason}
        </div>
      )}
    </div>
  );
}

export function PaymentsTable({ payments, multiDay }: { payments: IncomePayment[]; multiDay: boolean }) {
  if (payments.length === 0) {
    return <p className="px-4 py-12 text-center text-muted-foreground">לא נרשם תשלום בטווח הזה</p>;
  }
  return (
    <>
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-start">שעה</TableHead>
              <TableHead className="text-start">חניך / הורה</TableHead>
              <TableHead className="text-start">מסלול</TableHead>
              <TableHead className="text-start">סניף</TableHead>
              <TableHead className="text-start">אמצעי</TableHead>
              <TableHead className="text-start">סכום</TableHead>
              <TableHead className="text-start">התקבל ע״י</TableHead>
              <TableHead className="text-start">קבלה</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="tabular-nums text-muted-foreground">{when(p.paidAt, p.day, multiDay)}</TableCell>
                <TableCell>
                  <div className="font-medium">{p.childName}</div>
                  <div className="text-xs text-muted-foreground">{p.parentName}</div>
                </TableCell>
                <TableCell>{p.planName}</TableCell>
                <TableCell>{p.branchName}</TableCell>
                <TableCell>
                  {METHOD_LABEL[p.incomeMethod]}
                  {p.reference && <div className="text-xs text-muted-foreground">אסמכתא {p.reference}</div>}
                </TableCell>
                <TableCell>
                  <AmountCell p={p} />
                </TableCell>
                <TableCell>{takenBy(p)}</TableCell>
                <TableCell>
                  {p.receiptUrl ? (
                    <a href={p.receiptUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline" aria-label={`קבלה של ${p.childName}`}>
                      <FileText className="h-4 w-4" aria-hidden />
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground">אין</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ul className="divide-y md:hidden">
        {payments.map((p) => (
          <li key={p.id} className="flex justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <div className="font-medium">
                <span className="me-2 text-sm text-muted-foreground tabular-nums">{when(p.paidAt, p.day, multiDay)}</span>
                {p.childName}
              </div>
              <div className="text-xs text-muted-foreground">
                {p.planName} · {p.branchName}
              </div>
              <div className="text-xs text-muted-foreground">התקבל ע״י {takenBy(p)}</div>
            </div>
            <div className="shrink-0 text-end">
              <AmountCell p={p} />
              <div className="text-xs text-muted-foreground">{METHOD_LABEL[p.incomeMethod]}</div>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

export function RefundsTable({ refunds, multiDay }: { refunds: IncomeRefund[]; multiDay: boolean }) {
  if (refunds.length === 0) {
    return <p className="px-4 py-12 text-center text-muted-foreground">לא נרשם החזר בטווח הזה</p>;
  }
  return (
    <ul className="divide-y">
      {refunds.map((r) => (
        <li key={r.id} className="grid gap-1 px-4 py-3 md:grid-cols-[6rem_1fr_8rem_8rem_10rem] md:items-center">
          <span className="tabular-nums text-muted-foreground">{when(r.createdAt, r.day, multiDay)}</span>
          <div>
            <div className="font-medium">{r.childName}</div>
            <div className="text-xs text-muted-foreground">
              {r.planName} · {REFUND_KIND_LABEL[r.kind]} · {r.salePaidAt ? `נמכר ${shortDay(israelDateStr(r.salePaidAt))}` : "ללא הזמנה"}
            </div>
          </div>
          <Money amount={-r.amountIls} className="font-semibold text-destructive" />
          <span className="text-sm">
            {REFUND_METHOD_LABEL[r.method]} · {r.createdBy.name}
          </span>
          {r.creditNoteNumber ? (
            <span className="text-sm tabular-nums">זיכוי {r.creditNoteNumber}</span>
          ) : r.amountIls > 0 ? (
            <Badge className="w-fit bg-warning text-warning-foreground hover:bg-warning">
              <TriangleAlert className="me-1 h-3 w-3" aria-hidden />
              חסר זיכוי
            </Badge>
          ) : (
            <span className="text-sm text-muted-foreground">ללא זיכוי</span>
          )}
        </li>
      ))}
    </ul>
  );
}

export function ArboxTable({ entries }: { entries: ArboxEntry[] }) {
  if (entries.length === 0) {
    return <p className="px-4 py-12 text-center text-muted-foreground">אין רכישות Arbox בטווח הזה</p>;
  }
  return (
    <div>
      <p className="px-4 pt-3 text-sm text-muted-foreground">
        נרכשו ושולמו ב-Arbox ונקלטו הלילה. הן לא נספרות בהכנסות; התאריך הוא יום הרכישה ב-Arbox.
      </p>
      <ul className="divide-y">
        {entries.map((e) => (
          <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div>
              <div className="font-medium">{e.childName}</div>
              <div className="text-xs text-muted-foreground">
                {e.planName} · נרכש {shortDay(e.day)}
              </div>
            </div>
            {e.unknownAmount ? (
              <Badge variant="outline">סכום לא ידוע</Badge>
            ) : (
              <Money amount={e.amountIls} className="font-semibold" />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

`RefundsTable` uses a CSS grid with fixed tracks; `md:grid-cols-[...]` lays out right to left automatically under `dir="rtl"`.

- [ ] **Step 5: The ledger with tabs**

`src/features/finance/components/IncomeLedger.tsx`:

```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { IncomeReport } from "../lib/income";
import { ArboxTable, PaymentsTable, RefundsTable } from "./IncomeTables";

export function IncomeLedger({ report }: { report: IncomeReport }) {
  const multiDay = report.from !== report.to;
  return (
    <section aria-label="פירוט" className="min-w-0 rounded-xl border bg-card">
      <Tabs defaultValue="payments" dir="rtl">
        <TabsList className="m-3">
          <TabsTrigger value="payments">תשלומים ({report.paymentCount})</TabsTrigger>
          <TabsTrigger value="refunds">החזרים ({report.refundRows.length})</TabsTrigger>
          <TabsTrigger value="arbox">Arbox ({report.arbox.entries.length}) · מחוץ לסכום</TabsTrigger>
        </TabsList>
        <TabsContent value="payments">
          <PaymentsTable payments={report.payments} multiDay={multiDay} />
        </TabsContent>
        <TabsContent value="refunds">
          <RefundsTable refunds={report.refundRows} multiDay={multiDay} />
        </TabsContent>
        <TabsContent value="arbox">
          <ArboxTable entries={report.arbox.entries} />
        </TabsContent>
      </Tabs>
    </section>
  );
}
```

- [ ] **Step 6: The page**

`src/app/admin/finance/page.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { verifyAdmin } from "@/lib/actions/shared";
import { israelToday } from "@/lib/utils/tasks";
import { BranchUrlFilter } from "@/features/branches/components/BranchUrlFilter";
import { loadFinanceBranches, loadIncomeReport } from "@/features/finance/lib/queries";
import { parseBranchParam, parseRange, MAX_RANGE_DAYS } from "@/features/finance/lib/range";
import { rangeLabel } from "@/features/finance/lib/format";
import { RangeControl } from "@/features/finance/components/RangeControl";
import { IncomeSummary } from "@/features/finance/components/IncomeSummary";
import { IncomeLedger } from "@/features/finance/components/IncomeLedger";

export const metadata: Metadata = { title: "הכנסות | Garden of Eden" };

interface PageProps {
  searchParams: Promise<{ range?: string; from?: string; to?: string; branch?: string }>;
}

export default async function FinanceIncomePage({ searchParams }: PageProps) {
  const { error } = await verifyAdmin();
  if (error) redirect("/admin");

  const params = await searchParams;
  const range = parseRange(params, israelToday());
  const branches = await loadFinanceBranches();
  const branchId = parseBranchParam(params.branch, branches.selling.map((b) => b.id));
  const result = await loadIncomeReport(range, branchId);

  const dayHref = (day: string) => {
    const query = new URLSearchParams({ range: "custom", from: day, to: day, ...(branchId ? { branch: branchId } : {}) });
    return `/admin/finance?${query.toString()}`;
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="mb-1 text-3xl font-bold">הכנסות</h1>
          <p className="text-muted-foreground">{rangeLabel(range)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <RangeControl range={range} />
          {branches.selling.length > 1 && <BranchUrlFilter branches={branches.selling} />}
        </div>
      </header>

      {range.clipped && (
        <p className="text-sm text-warning-emphasis">הטווח ארוך מ-{MAX_RANGE_DAYS} ימים, ולכן מוצגים רק {MAX_RANGE_DAYS} הימים האחרונים שבו</p>
      )}
      {branches.notSelling.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {branches.notSelling.map((b) => b.nameHe).join(", ")} מנוהל ב-Arbox ולכן לא מופיע כאן. המעקב שלו ב
          <Link href="/admin/retention" className="underline underline-offset-4">
            שימור לקוחות
          </Link>
          .
        </p>
      )}

      {!result.success ? (
        <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 p-6 text-destructive">
          {result.error}
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)] lg:items-start">
          <IncomeSummary report={result.data} dayHref={dayHref} />
          <div className="min-w-0 space-y-2">
            <IncomeLedger report={result.data} />
            <p className="text-xs text-muted-foreground">
              תשלום כרטיס שהושלם בבדיקה מול פלאקארד נרשם ביום הבדיקה. תשלום כרטיס בתשלומים נספר במלואו ביום החיוב.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 7: Type-check, lint, build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: all succeed. Fix any type error in the component props before moving on.

- [ ] **Step 8: Look at it**

Run `npm run dev`, sign in as an admin, open `/admin/finance` at 1440px and 390px wide. Compare against `.impeccable/mockups/finance/shots/split-income-desk.png` and `split-income-phone.png`: summary column on the right on desktop, sticky while the ledger scrolls; summary first on phone with the cash-up open. Check `?range=week`, `?range=custom&from=2026-02-30&to=2026-03-01` (falls back to today), and `?branch=not-a-branch` (all branches).

- [ ] **Step 9: Commit**

```bash
git add src/app/admin/finance/page.tsx src/features/finance/components/RangeControl.tsx src/features/finance/components/SummarySection.tsx src/features/finance/components/IncomeSummary.tsx src/features/finance/components/IncomeLedger.tsx src/features/finance/components/IncomeTables.tsx
git commit -m "feat(finance): income page, summary beside the ledger

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: The ending-soon page

**Files:**
- Create: `src/app/admin/finance/ending-soon/page.tsx`
- Create: `src/features/finance/components/EndingFilters.tsx`
- Create: `src/features/finance/components/EndingList.tsx`

**Interfaces:**
- Consumes: `loadFinanceBranches`, `loadEndingSoon`, `EndingRow` (Task 5); `endingCounts`, `filterEnding`, `parseEndingFilter`, `EndingFilter`, `EndingEntry`, `ExpiredEntry` (Task 4); `parseBranchParam` (Task 2); `formatPhoneToLocal` (`@/lib/validations/common`); `waShareUrl` (`@/lib/whatsapp/share`).
- Produces: the `/admin/finance/ending-soon` route.

Visual reference: `.impeccable/mockups/finance/shots/split-ending-desk.png` and `split-ending-phone.png`.

- [ ] **Step 1: Filter column (server, links)**

`src/features/finance/components/EndingFilters.tsx`:

```tsx
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { EndingCounts, EndingFilter } from "../lib/ending-soon";

const ITEMS: { value: EndingFilter; label: string; hint: (c: EndingCounts) => string; count: (c: EndingCounts) => number; attention?: boolean }[] = [
  { value: "all", label: "כל המסתיימים", hint: (c) => `${c.byDate} לפי תאריך · ${c.bySessions} לפי אימונים`, count: (c) => c.all },
  { value: "link", label: "קישור ממתין", hint: () => "ההורה קיבל קישור ועוד לא שילם", count: (c) => c.link },
  { value: "reminded", label: "קיבלו תזכורת", hint: () => "ההודעה האוטומטית כבר יצאה", count: (c) => c.reminded },
  { value: "arbox", label: "שולם ב-Arbox", hint: () => "אין תזכורת אוטומטית, צריך לפנות", count: (c) => c.arbox, attention: true },
  { value: "expired", label: "פגו לאחרונה", hint: () => "ב-14 הימים האחרונים, בלי מסלול חדש", count: (c) => c.expired },
];

export function EndingFilters({ counts, active, hrefFor }: { counts: EndingCounts; active: EndingFilter; hrefFor: (f: EndingFilter) => string }) {
  return (
    <nav aria-label="סינון" className="rounded-xl border bg-card p-2 lg:sticky lg:top-4">
      <ul className="flex gap-2 overflow-x-auto lg:flex-col lg:gap-1">
        {ITEMS.map((item) => {
          const count = item.count(counts);
          return (
            <li key={item.value} className="shrink-0">
              <Link
                href={hrefFor(item.value)}
                aria-current={active === item.value ? "page" : undefined}
                className={cn(
                  "flex items-center justify-between gap-4 rounded-lg px-3 py-2 transition-colors hover:bg-muted",
                  active === item.value && "bg-secondary ring-1 ring-primary/40",
                )}
              >
                <span>
                  <span className="block font-semibold">{item.label}</span>
                  <span className="hidden text-xs text-muted-foreground lg:block">{item.hint(counts)}</span>
                </span>
                <span className={cn("text-lg font-bold tabular-nums", item.attention && count > 0 && "text-warning-emphasis")}>{count}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="hidden border-t px-3 pt-2 text-xs text-muted-foreground lg:block">
        מסלול שמסתיים בעוד 7 ימים או פחות, או כרטיסייה עם 2 אימונים או פחות. מסלול שכבר חודש לא מופיע כאן.
      </p>
    </nav>
  );
}
```

- [ ] **Step 2: The call list**

`src/features/finance/components/EndingList.tsx`:

```tsx
import Link from "next/link";
import { BellRing, ChevronLeft, Link2, MessageCircle, Phone, Snowflake, Store } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatPhoneToLocal } from "@/lib/validations/common";
import { waShareUrl } from "@/lib/whatsapp/share";
import { cn } from "@/lib/utils";
import type { EndingEntry, ExpiredEntry } from "../lib/ending-soon";
import type { EndingRow } from "../lib/queries";

type Row = EndingEntry<EndingRow> | ExpiredEntry<EndingRow>;

const isExpired = (row: Row): row is ExpiredEntry<EndingRow> => "daysAgo" in row;

function leftLabel(row: Row): { text: string; urgent: boolean } {
  if (isExpired(row)) return { text: `לפני ${row.daysAgo === 1 ? "יום" : `${row.daysAgo} ימים`}`, urgent: true };
  if (row.by === "sessions") {
    const left = row.sessionsLeft ?? 0;
    const base = left === 0 ? "0 נותרו" : left === 1 ? "אימון אחד" : `${left} אימונים`;
    return { text: row.booked > 0 ? `${base} · ${row.booked} שמורים` : base, urgent: left <= 1 };
  }
  if (row.daysLeft === 0) return { text: "מסתיים היום", urgent: true };
  return { text: row.daysLeft === 1 ? "יום אחד" : `${row.daysLeft} ימים`, urgent: row.daysLeft <= 3 };
}

function Flags({ row }: { row: Row }) {
  return (
    <div className="flex flex-wrap gap-1">
      {row.reminded && (
        <Badge variant="outline" className="gap-1 font-normal">
          <BellRing className="h-3 w-3" aria-hidden /> תזכורת נשלחה
        </Badge>
      )}
      {row.linkWaiting && (
        <Badge variant="outline" className="gap-1 border-info/40 font-normal text-info">
          <Link2 className="h-3 w-3" aria-hidden /> קישור ממתין
        </Badge>
      )}
      {row.frozenLabel && (
        <Badge variant="outline" className="gap-1 font-normal text-info">
          <Snowflake className="h-3 w-3" aria-hidden /> {row.frozenLabel}
        </Badge>
      )}
      {row.paidInArbox && (
        <Badge className="gap-1 bg-warning font-normal text-warning-foreground hover:bg-warning">
          <Store className="h-3 w-3" aria-hidden /> שולם ב-Arbox · אין תזכורת
        </Badge>
      )}
    </div>
  );
}

function Contact({ row }: { row: Row }) {
  if (!row.guardianPhone) return <span className="text-xs text-muted-foreground">אין טלפון הורה</span>;
  return (
    <div className="flex gap-1">
      <Button asChild variant="outline" size="icon" aria-label={`התקשרות ל${row.guardianName ?? "הורה"}`}>
        <a href={`tel:${row.guardianPhone}`}>
          <Phone className="h-4 w-4" />
        </a>
      </Button>
      <Button asChild variant="outline" size="icon" aria-label={`וואטסאפ ל${row.guardianName ?? "הורה"}`}>
        <a href={waShareUrl(row.guardianPhone, "")} target="_blank" rel="noreferrer">
          <MessageCircle className="h-4 w-4" />
        </a>
      </Button>
      <Button asChild variant="ghost" size="icon" aria-label={`לדף של ${row.traineeName}`}>
        <Link href={`/admin/users/${row.profileId}`}>
          <ChevronLeft className="h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
}

export function EndingList({ rows, title, empty }: { rows: Row[]; title: string; empty: string }) {
  return (
    <section aria-label={title} className="min-w-0 rounded-xl border bg-card">
      <h2 className="flex items-baseline justify-between px-4 pt-4 font-bold">
        {title}
        <span className="text-xs font-normal text-muted-foreground tabular-nums">{rows.length} חניכים</span>
      </h2>
      {rows.length === 0 ? (
        <p className="px-4 py-12 text-center text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-2 divide-y">
          {rows.map((row) => {
            const left = leftLabel(row);
            return (
              <li key={row.profileId} className="grid gap-2 px-4 py-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_7rem_minmax(0,1.2fr)_auto] md:items-center">
                <div className="min-w-0">
                  <Link href={`/admin/users/${row.profileId}`} className="font-bold hover:underline">
                    {row.traineeName}
                  </Link>
                  <div className="text-xs text-muted-foreground">{row.guardianName ?? "הורה לא רשום"}</div>
                  {row.guardianPhone && (
                    <div dir="ltr" className="text-end text-xs text-muted-foreground tabular-nums md:text-start">
                      {formatPhoneToLocal(row.guardianPhone)}
                    </div>
                  )}
                </div>
                <div className="text-sm">
                  {row.planName}
                  <div className="text-xs text-muted-foreground">
                    {row.branchName} · {isExpired(row) ? "הסתיים" : "מסתיים"} {Number(row.endsOn.slice(8, 10))}.{Number(row.endsOn.slice(5, 7))}
                  </div>
                </div>
                <span className={cn("font-bold tabular-nums", left.urgent ? "text-destructive" : "text-warning-emphasis")}>{left.text}</span>
                <Flags row={row} />
                <Contact row={row} />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
```

If `Button` in this repo has no `size="icon"`, use `size="sm"` with `className="h-9 w-9 p-0"` (check `src/components/ui/button.tsx`).

- [ ] **Step 3: The page**

`src/app/admin/finance/ending-soon/page.tsx`:

```tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { verifyAdmin } from "@/lib/actions/shared";
import { BranchUrlFilter } from "@/features/branches/components/BranchUrlFilter";
import { loadEndingSoon, loadFinanceBranches } from "@/features/finance/lib/queries";
import { parseBranchParam } from "@/features/finance/lib/range";
import { endingCounts, filterEnding, parseEndingFilter, type EndingFilter } from "@/features/finance/lib/ending-soon";
import { EndingFilters } from "@/features/finance/components/EndingFilters";
import { EndingList } from "@/features/finance/components/EndingList";

export const metadata: Metadata = { title: "מסתיימים בקרוב | Garden of Eden" };

interface PageProps {
  searchParams: Promise<{ branch?: string; show?: string }>;
}

const TITLES: Record<EndingFilter, string> = {
  all: "לפי דחיפות",
  link: "קישור ממתין",
  reminded: "קיבלו תזכורת",
  arbox: "שולם ב-Arbox",
  expired: "פגו לאחרונה",
};

export default async function EndingSoonPage({ searchParams }: PageProps) {
  const { error } = await verifyAdmin();
  if (error) redirect("/admin");

  const params = await searchParams;
  const show = parseEndingFilter(params.show);
  const branches = await loadFinanceBranches();
  const branchId = parseBranchParam(params.branch, branches.selling.map((b) => b.id));
  const result = await loadEndingSoon(branchId);

  const hrefFor = (filter: EndingFilter) => {
    const query = new URLSearchParams({ ...(filter !== "all" ? { show: filter } : {}), ...(branchId ? { branch: branchId } : {}) });
    const qs = query.toString();
    return qs ? `/admin/finance/ending-soon?${qs}` : "/admin/finance/ending-soon";
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="mb-1 text-3xl font-bold">מסתיימים בקרוב</h1>
          <p className="text-muted-foreground">
            מסלול שמסתיים בעוד 7 ימים או פחות, או כרטיסייה עם 2 אימונים או פחות. ההורה מקבל תזכורת לבד ב-3 ימים או אימון אחד.
          </p>
        </div>
        {branches.selling.length > 1 && <BranchUrlFilter branches={branches.selling} />}
      </header>

      {!result.success ? (
        <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 p-6 text-destructive">
          {result.error}
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)] lg:items-start">
          <EndingFilters counts={endingCounts(result.data)} active={show} hrefFor={hrefFor} />
          <div className="space-y-6">
            <EndingList rows={filterEnding(result.data, show)} title={TITLES[show]} empty="אין כרגע אף חניך ברשימה הזאת" />
            {show === "all" && result.data.expired.length > 0 && (
              <EndingList rows={result.data.expired} title="פגו לאחרונה" empty="" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Type-check, lint, build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: all succeed.

- [ ] **Step 5: Look at it**

With `npm run dev`, open `/admin/finance/ending-soon` at 1440px and 390px. Compare with `split-ending-desk.png` and `split-ending-phone.png`. Check every filter (`?show=link`, `reminded`, `arbox`, `expired`, `nope`), the call and WhatsApp links open the right number, and the menu badge equals the "כל המסתיימים" count.

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/finance/ending-soon/page.tsx src/features/finance/components/EndingFilters.tsx src/features/finance/components/EndingList.tsx
git commit -m "feat(finance): ending-soon call list with filters

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Verify against production, document, review

**Files:**
- Modify: `CLAUDE.md` (a "Finance reports" paragraph under Architecture, after the קריית אתא signup section)

- [ ] **Step 1: Full checks**

Run: `npx tsc --noEmit && npm run lint && npm run test:coverage && npm run build`
Expected: all pass; coverage of `src/features/finance/lib/` (pure files) at or above 80%.

- [ ] **Step 2: Production data check on the Vercel preview**

Push the branch (ask the user first) and open the preview as an admin:
- `/admin/finance` for today and for the last week: compare the cash total per staff member with what Eden knows was collected; every row in `/admin/orders` with status paid today appears here.
- The Arbox line: its count matches `select count(*) from orders where payment_method = 'arbox' and arbox_purchased_on = <today>`.
- `/admin/finance/ending-soon`: every trainee in `/admin/plans?status=ending_soon` also appears here (the staff window is wider, so this list is a superset).
- The menu badge equals the page's "כל המסתיימים" count; record a test payment or adjustment and confirm the badge refreshes without waiting ten minutes.

- [ ] **Step 3: Design finish (impeccable)**

Capture `.impeccable/review/desktop.png` (1440 wide, full page) and `.impeccable/review/mobile.png` (390 wide) of `/admin/finance` and of `/admin/finance/ending-soon` from the preview. Run `~/.claude/skills/impeccable/scripts/impeccable detect --json src/features/finance/components src/app/admin/finance` and fix mechanical findings. Spawn the `impeccable-finish-reviewer` agent with: the request, the surface brief `.impeccable/surfaces/src-app-admin-finance-page-tsx.md` (direction contract), the screenshots, the mockup `.impeccable/mockups/finance/split.html` as the critique reference, and the craft-floor path `~/.claude/skills/impeccable/reference/craft-floor.md`. Apply its fix list in one batch. This is an extension of the existing admin world: the documenter compares against the incumbent system and does not rewrite DESIGN.md.

- [ ] **Step 4: Document**

Add to `CLAUDE.md`, after the קריית אתא signup section:

```markdown
### Finance reports

Admin-only. `/admin/finance` is the income report: `buildIncomeReport()` (`src/features/finance/lib/income.ts`, pure) puts each counted order (`paid`, `refunded`, `voided`) on the Israel day of its `paid_at`, subtracts `plan_refunds` on their own day, keeps Arbox (`payment_method = 'arbox'`) in its own total dated by `orders.arbox_purchased_on` (1 ILS placeholders flagged and left out), counts card installments in full on the charge day, and gives each staff member's cash-up (cash, Bit, transfer, minus cash refunds they paid out; card links listed apart). `/admin/finance/ending-soon` lists queues ending within 7 days or cards-only with 2 or fewer sessions (`splitEnding()` in `src/features/finance/lib/ending-soon.ts`; staff thresholds, wider than the parent reminders), plus queues that expired in the last 14 days; its count is the menu badge, cached 10 minutes under the `finance-ending-soon` tag and cleared by `revalidateStaffSurfaces()`. Loaders in `src/features/finance/lib/queries.ts` (service role, behind `verifyAdmin()`). Branches that do not sell in the app (today חיפה) are left out with a note. Spec: `docs/superpowers/specs/2026-10-12-financial-reports-phase-1-design.md`.
```

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(finance): finance reports in CLAUDE.md

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 6: Code review and PR**

Run the `code-reviewer` and `security-reviewer` agents on `git diff main...HEAD` (admin-only service-role reads are the security-sensitive part). Address CRITICAL and HIGH findings. Open the PR only when the user asks; the body lists the migration (already pushed in Task 1), the two pages, the badge, and the manual checks from Step 2.
