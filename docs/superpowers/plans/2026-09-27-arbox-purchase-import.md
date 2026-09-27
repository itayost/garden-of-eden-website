# Arbox Purchase Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A nightly step turns each new Arbox card or membership of a קריית אתא trainee into an order and a `trainee_plans` row (new, chained, or merged), exactly once, so the trainee can book without staff re-entering the sale.

**Architecture:** Three layers. Pure row handling (`src/lib/arbox/purchase-rows.ts`) turns Arbox report rows into purchases keyed by Arbox's `membership_user_id`. A pure planner (`src/lib/plans/arbox-import-plan.ts`) decides, per purchase, skip / create / merge against our plans. A thin I/O module (`src/features/plans/lib/arbox-import.ts`) loads both sides, runs the planner and applies the actions with the service-role client. The nightly `arbox-sync` cron calls it behind an env flag; a script gives the dry run.

**Tech Stack:** Next.js 16 route handler, TypeScript strict, Supabase JS (service role, typed `Database`), Vitest, tsx scripts.

**Spec:** `docs/superpowers/specs/2026-09-27-arbox-purchase-import-design.md`

## Global Constraints

- קריית אתא only; the branch is found by `name_he = "קריית אתא"`.
- Identity: `orders.provider_transaction_id = "arbox:<membership_user_id>"` with `payment_provider = "manual"`, `payment_method = "arbox"`. The existing unique index on (`payment_provider`, `provider_transaction_id`) is the duplicate guard. No migration.
- Imported statuses: `active`, `activeMemberWithFutureCancel`.
- Card: name contains `כרטיסי`. Membership: name starts with `מנוי`. Excluded: name contains `מחנה` or `טעות`.
- Card sessions come from `sessions_left`, never `total_sessions`. Durations come from `start_date`/`end_date`, never the name.
- Products by slug: `card_10` (sessions <= 10), `card_20`, `monthly` (membership span <= 45 days), `term_4_months`. Never `intro_pack` or add-ons.
- `amount_ils` = Arbox `paid`, or 1 when 0 or missing (orders require > 0).
- Phones must match `^\+972\d{9}$` or the purchase is skipped as `invalid_phone`.
- The import never touches profile fields, branches, agreements, Morning, WhatsApp.
- Plans are written with `source = "manual"`, `created_by = null`; orders with `received_by = null`, `fulfilled_at` set.
- The cron step runs only when `ARBOX_IMPORT_PURCHASES === "on"`.
- No emojis; Hebrew user-facing text; immutable updates; files under 400 lines.
- Tests cover pure functions only (project rule: no mock-based tests).

## Review Focus

- Arbox sends numbers as strings (`"1250"`, `"4"`): amounts and `sessions_left` must still parse. Test in Task 1.
- Two identical card rows (same user, item, start date) matching a single sale would share one key: both must be reported unmatched, never imported twice. Test in Task 1.
- A purchase whose Arbox `start_date` is in the future must start then, not today. Test in Task 2.
- Two purchases for a trainee with no plan in the same run: the second merges into the plan the first creates (a placeholder id the applier resolves). Planner test in Task 2; applier resolution in Task 3.
- A card merge into a `session_card` plan whose `sessions_total` is null must treat it as 0, not produce NaN. Test in Task 2.

---

### Task 1: Arbox purchase rows

**Files:**
- Create: `src/lib/arbox/purchase-rows.ts`
- Test: `src/lib/arbox/__tests__/purchase-rows.test.ts`

**Interfaces:**
- Produces:
  - `type ArboxPurchaseKind = "card" | "membership"`
  - `interface ArboxPurchase { membershipUserId: number; userId: number; kind: ArboxPurchaseKind; itemName: string; purchaseDate: string; startDate: string; endDate: string | null; sessionsLeft: number | null; paid: number | null; status: string }`
  - `interface SessionsReportRow`, `interface MembershipsReportRow`, `interface SalesReportRow` (raw report shapes)
  - `interface UnmatchedCard { userId: number; itemName: string; startDate: string | null; matches: number }`
  - `purchaseKindOf(name: string | null | undefined): ArboxPurchaseKind | null`
  - `purchasesFromReports(input: { cards: readonly SessionsReportRow[]; memberships: readonly MembershipsReportRow[]; sales: readonly SalesReportRow[] }): { purchases: ArboxPurchase[]; unmatchedCards: UnmatchedCard[] }`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, test } from "vitest";

import {
  purchaseKindOf,
  purchasesFromReports,
  type MembershipsReportRow,
  type SalesReportRow,
  type SessionsReportRow,
} from "../purchase-rows";

function card(overrides: Partial<SessionsReportRow> = {}): SessionsReportRow {
  return {
    user_id: 100,
    membership_type_name: "כרטיסייה",
    purchase_date: "2026-09-22",
    start_date: "2026-09-22",
    end_date: "2026-12-21",
    sessions_left: 9,
    paid: 1000,
    status: "active",
    ...overrides,
  };
}

function sale(overrides: Partial<SalesReportRow> = {}): SalesReportRow {
  return {
    user_id: 100,
    item_name: "כרטיסייה",
    item_type: "session",
    membership_user_id: 5001,
    start_date: "2026-09-22",
    status: "active",
    ...overrides,
  };
}

function membership(overrides: Partial<MembershipsReportRow> = {}): MembershipsReportRow {
  return {
    user_id: 200,
    membership_type_name: "מנוי מתקדמים 4 חודשים",
    membership_user_id: 7001,
    purchase_date: "2026-09-02",
    start_date: "2026-09-02",
    end_date: "2027-01-01",
    paid: 3200,
    status: "active",
    ...overrides,
  };
}

describe("purchaseKindOf", () => {
  test("classifies cards and memberships", () => {
    expect(purchaseKindOf("כרטיסייה")).toBe("card");
    expect(purchaseKindOf("כרטיסית פרימיום קריות")).toBe("card");
    expect(purchaseKindOf("מנוי מתקדמים חודש")).toBe("membership");
  });

  test("excludes camps, mistakes, and anything else", () => {
    expect(purchaseKindOf("מחנה קיץ - הכנה לעונה")).toBe(null);
    expect(purchaseKindOf("מחנה סוכות")).toBe(null);
    expect(purchaseKindOf("מנוי מתקדמים 4 חודשים - טעות")).toBe(null);
    expect(purchaseKindOf("קורס דיגיטלי")).toBe(null);
    expect(purchaseKindOf(null)).toBe(null);
  });
});

describe("purchasesFromReports", () => {
  test("keys a card by its single matching sale", () => {
    const { purchases, unmatchedCards } = purchasesFromReports({
      cards: [card()],
      memberships: [],
      sales: [sale()],
    });

    expect(unmatchedCards).toEqual([]);
    expect(purchases).toEqual([
      {
        membershipUserId: 5001,
        userId: 100,
        kind: "card",
        itemName: "כרטיסייה",
        purchaseDate: "2026-09-22",
        startDate: "2026-09-22",
        endDate: "2026-12-21",
        sessionsLeft: 9,
        paid: 1000,
        status: "active",
      },
    ]);
  });

  test("reports a card with no matching sale instead of guessing", () => {
    const { purchases, unmatchedCards } = purchasesFromReports({
      cards: [card({ start_date: "2025-12-30", purchase_date: "2025-12-30" })],
      memberships: [],
      sales: [sale()],
    });

    expect(purchases).toEqual([]);
    expect(unmatchedCards).toEqual([
      { userId: 100, itemName: "כרטיסייה", startDate: "2025-12-30", matches: 0 },
    ]);
  });

  test("reports a card that matches two sales", () => {
    const { purchases, unmatchedCards } = purchasesFromReports({
      cards: [card()],
      memberships: [],
      sales: [sale(), sale({ membership_user_id: 5002 })],
    });

    expect(purchases).toEqual([]);
    expect(unmatchedCards[0].matches).toBe(2);
  });

  test("ignores sales that are not active sessions", () => {
    const { purchases } = purchasesFromReports({
      cards: [card()],
      memberships: [],
      sales: [sale({ status: "inactive" }), sale({ item_type: "plan", membership_user_id: 5003 })],
    });

    expect(purchases).toEqual([]);
  });

  test("two identical card rows sharing one sale are both unmatched", () => {
    const { purchases, unmatchedCards } = purchasesFromReports({
      cards: [card(), card({ sessions_left: 10 })],
      memberships: [],
      sales: [sale()],
    });

    expect(purchases).toEqual([]);
    expect(unmatchedCards).toHaveLength(2);
  });

  test("parses numbers Arbox sends as strings", () => {
    const { purchases } = purchasesFromReports({
      cards: [card({ user_id: "100", sessions_left: "4", paid: "2250" })],
      memberships: [],
      sales: [sale({ user_id: "100", membership_user_id: "5001" })],
    });

    expect(purchases[0]).toMatchObject({ userId: 100, sessionsLeft: 4, paid: 2250, membershipUserId: 5001 });
  });

  test("takes memberships with their own id", () => {
    const { purchases } = purchasesFromReports({ cards: [], memberships: [membership()], sales: [] });

    expect(purchases).toEqual([
      {
        membershipUserId: 7001,
        userId: 200,
        kind: "membership",
        itemName: "מנוי מתקדמים 4 חודשים",
        purchaseDate: "2026-09-02",
        startDate: "2026-09-02",
        endDate: "2027-01-01",
        sessionsLeft: null,
        paid: 3200,
        status: "active",
      },
    ]);
  });

  test("drops camps and rows without an id or start date", () => {
    const { purchases } = purchasesFromReports({
      cards: [card({ membership_type_name: "מחנה סוכות" })],
      memberships: [
        membership({ membership_user_id: null }),
        membership({ start_date: null, membership_user_id: 7002 }),
      ],
      sales: [sale({ item_name: "מחנה סוכות" })],
    });

    expect(purchases).toEqual([]);
  });

  test("falls back to the start date when the purchase date is missing", () => {
    const { purchases } = purchasesFromReports({
      cards: [],
      memberships: [membership({ purchase_date: null })],
      sales: [],
    });

    expect(purchases[0].purchaseDate).toBe("2026-09-02");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:run -- src/lib/arbox/__tests__/purchase-rows.test.ts`
Expected: FAIL, cannot resolve `../purchase-rows`.

- [ ] **Step 3: Implement**

```ts
/**
 * Arbox purchases as the nightly import sees them.
 *
 * A purchase is keyed by Arbox's own `membership_user_id`, the one id that is
 * stable and unique per sale. Memberships carry it in their report; the cards
 * report does not, so a card is joined to its sale on (user, item, start
 * date). A card that matches no sale or several is reported, never guessed:
 * a wrong key would import the same card twice or two cards as one.
 */

export type ArboxPurchaseKind = "card" | "membership";

export interface ArboxPurchase {
  /** Arbox's id for the purchase; the import's identity. */
  readonly membershipUserId: number;
  readonly userId: number;
  readonly kind: ArboxPurchaseKind;
  readonly itemName: string;
  readonly purchaseDate: string;
  readonly startDate: string;
  readonly endDate: string | null;
  /** Cards only: what Arbox says is left. `total_sessions` is a template. */
  readonly sessionsLeft: number | null;
  readonly paid: number | null;
  readonly status: string;
}

type Num = number | string | null | undefined;

export interface SessionsReportRow {
  readonly user_id?: Num;
  readonly membership_type_name?: string | null;
  readonly purchase_date?: string | null;
  readonly start_date?: string | null;
  readonly end_date?: string | null;
  readonly sessions_left?: Num;
  readonly paid?: Num;
  readonly status?: string | null;
}

export interface MembershipsReportRow {
  readonly user_id?: Num;
  readonly membership_type_name?: string | null;
  readonly membership_user_id?: Num;
  readonly purchase_date?: string | null;
  readonly start_date?: string | null;
  readonly end_date?: string | null;
  readonly paid?: Num;
  readonly status?: string | null;
}

export interface SalesReportRow {
  readonly user_id?: Num;
  readonly item_name?: string | null;
  readonly item_type?: string | null;
  readonly membership_user_id?: Num;
  readonly start_date?: string | null;
  readonly status?: string | null;
}

export interface UnmatchedCard {
  readonly userId: number;
  readonly itemName: string;
  readonly startDate: string | null;
  readonly matches: number;
}

function toNumber(value: Num): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Which purchases become plans. Camps and mistaken items never do. */
export function purchaseKindOf(name: string | null | undefined): ArboxPurchaseKind | null {
  if (!name) return null;
  if (name.includes("מחנה") || name.includes("טעות")) return null;
  if (name.includes("כרטיסי")) return "card";
  if (name.trim().startsWith("מנוי")) return "membership";
  return null;
}

const saleKey = (userId: number, itemName: string, startDate: string): string =>
  `${userId}|${itemName}|${startDate}`;

function activeSessionSalesByKey(sales: readonly SalesReportRow[]): Map<string, Set<number>> {
  const byKey = new Map<string, Set<number>>();
  for (const s of sales) {
    const userId = toNumber(s.user_id);
    const id = toNumber(s.membership_user_id);
    if (s.item_type !== "session" || s.status !== "active") continue;
    if (userId === null || id === null || !s.item_name || !s.start_date) continue;
    const key = saleKey(userId, s.item_name, s.start_date);
    byKey.set(key, new Set([...(byKey.get(key) ?? []), id]));
  }
  return byKey;
}

interface CardCandidate {
  readonly row: SessionsReportRow;
  readonly userId: number;
  readonly itemName: string;
  readonly ids: readonly number[];
}

function cardCandidates(
  cards: readonly SessionsReportRow[],
  sales: Map<string, Set<number>>,
): CardCandidate[] {
  return cards.flatMap((row) => {
    const userId = toNumber(row.user_id);
    const itemName = row.membership_type_name ?? "";
    if (userId === null || purchaseKindOf(itemName) !== "card") return [];
    const ids = row.start_date ? [...(sales.get(saleKey(userId, itemName, row.start_date)) ?? [])] : [];
    return [{ row, userId, itemName, ids }];
  });
}

function toCard(c: CardCandidate, id: number): ArboxPurchase {
  const startDate = c.row.start_date as string;
  return {
    membershipUserId: id,
    userId: c.userId,
    kind: "card",
    itemName: c.itemName,
    purchaseDate: c.row.purchase_date ?? startDate,
    startDate,
    endDate: c.row.end_date ?? null,
    sessionsLeft: toNumber(c.row.sessions_left),
    paid: toNumber(c.row.paid),
    status: c.row.status ?? "",
  };
}

function toMembership(row: MembershipsReportRow): ArboxPurchase | null {
  const userId = toNumber(row.user_id);
  const id = toNumber(row.membership_user_id);
  const itemName = row.membership_type_name ?? "";
  if (userId === null || id === null || !row.start_date) return null;
  if (purchaseKindOf(itemName) !== "membership") return null;
  return {
    membershipUserId: id,
    userId,
    kind: "membership",
    itemName,
    purchaseDate: row.purchase_date ?? row.start_date,
    startDate: row.start_date,
    endDate: row.end_date ?? null,
    sessionsLeft: null,
    paid: toNumber(row.paid),
    status: row.status ?? "",
  };
}

export function purchasesFromReports(input: {
  cards: readonly SessionsReportRow[];
  memberships: readonly MembershipsReportRow[];
  sales: readonly SalesReportRow[];
}): { purchases: ArboxPurchase[]; unmatchedCards: UnmatchedCard[] } {
  const candidates = cardCandidates(input.cards, activeSessionSalesByKey(input.sales));

  // One sale claimed by two card rows would give both the same key.
  const claims = candidates
    .filter((c) => c.ids.length === 1)
    .reduce((acc, c) => acc.set(c.ids[0], (acc.get(c.ids[0]) ?? 0) + 1), new Map<number, number>());
  const isUnique = (c: CardCandidate) => c.ids.length === 1 && claims.get(c.ids[0]) === 1;

  const cards = candidates.filter(isUnique).map((c) => toCard(c, c.ids[0]));
  const unmatchedCards = candidates
    .filter((c) => !isUnique(c))
    .map((c) => ({ userId: c.userId, itemName: c.itemName, startDate: c.row.start_date ?? null, matches: c.ids.length }));
  const memberships = input.memberships
    .map(toMembership)
    .filter((p): p is ArboxPurchase => p !== null);

  return { purchases: [...cards, ...memberships], unmatchedCards };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test:run -- src/lib/arbox/__tests__/purchase-rows.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/arbox/purchase-rows.ts src/lib/arbox/__tests__/purchase-rows.test.ts
git commit -m "feat(plans): key Arbox cards and memberships by Arbox's purchase id"
```

---

### Task 2: The import planner

**Files:**
- Create: `src/lib/plans/arbox-import-plan.ts`
- Test: `src/lib/plans/__tests__/arbox-import-plan.test.ts`

**Interfaces:**
- Consumes: `ArboxPurchase` from `@/lib/arbox/purchase-rows`; `addDays`, `daysBetween`, `shortDate` from `@/lib/utils/iso-date`; `PlanKind` from `@/types/plans`.
- Produces:
  - `purchaseKey(p: Pick<ArboxPurchase, "membershipUserId">): string` → `"arbox:<id>"`
  - `newPlanId(key: string): string` → `"new:<key>"` (placeholder for a plan created in the same run)
  - `interface ImportTrainee { profileId: string; arboxUserId: number; name: string; birthdate: string | null; phone: string | null; guardianName: string | null }`
  - `interface ImportPlanRow { id: string; profileId: string; productKind: PlanKind; startsOn: string; endsOn: string; sessionsTotal: number | null; status: "active" | "cancelled"; createdOn: string; orderPaymentMethod: string | null; orderProviderTransactionId: string | null }`
  - `interface ImportProducts { card10: string; card20: string; monthly: string; term: string }` (product ids)
  - `type ImportSkipReason = "not_linked" | "inactive_status" | "no_end_date" | "ended" | "no_sessions_left" | "already_imported" | "covered_by_hand" | "invalid_phone"`
  - `interface ImportOrderDraft { key; productId; profileId; amountIls: number; reference; childName; childBirthdate: string | null; parentName; phone }`
  - `interface PlanShift { planId; expectStartsOn; startsOn; endsOn }`
  - `interface CreatePlanAction { type: "create"; purchase; profileId; chained: boolean; order: ImportOrderDraft; plan: { id: string; productId; startsOn; endsOn; sessionsTotal: number | null; note: string } }` (`plan.id` is the `newPlanId` placeholder)
  - `interface MergePlanAction { type: "merge"; purchase; profileId; order: ImportOrderDraft; target: { planId; expectSessionsTotal: number | null; expectEndsOn: string }; set: { sessionsTotal: number | null; endsOn: string; clearThreeDays: boolean; clearLastSession: boolean; clearExpired: boolean }; shifts: readonly PlanShift[] }`
  - `type ImportAction = CreatePlanAction | MergePlanAction`
  - `interface ImportSkip { purchase: ArboxPurchase; reason: ImportSkipReason; profileId: string | null }`
  - `planArboxImports(input: { today: string; purchases: readonly ArboxPurchase[]; trainees: readonly ImportTrainee[]; plans: readonly ImportPlanRow[]; importedKeys: ReadonlySet<string>; products: ImportProducts }): { actions: ImportAction[]; skips: ImportSkip[] }`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, test } from "vitest";

import type { ArboxPurchase } from "@/lib/arbox/purchase-rows";
import {
  newPlanId,
  planArboxImports,
  purchaseKey,
  type ImportPlanRow,
  type ImportTrainee,
} from "../arbox-import-plan";

const TODAY = "2026-09-27";
const PRODUCTS = { card10: "p-card10", card20: "p-card20", monthly: "p-monthly", term: "p-term" };
const TRAINEE: ImportTrainee = {
  profileId: "prof-1",
  arboxUserId: 100,
  name: "יון דגן",
  birthdate: "2015-01-01",
  phone: "+972501234567",
  guardianName: null,
};

function cardPurchase(overrides: Partial<ArboxPurchase> = {}): ArboxPurchase {
  return {
    membershipUserId: 5001,
    userId: 100,
    kind: "card",
    itemName: "כרטיסייה",
    purchaseDate: "2026-09-28",
    startDate: "2026-09-28",
    endDate: "2026-12-27",
    sessionsLeft: 10,
    paid: 1250,
    status: "active",
    ...overrides,
  };
}

function membershipPurchase(overrides: Partial<ArboxPurchase> = {}): ArboxPurchase {
  return {
    ...cardPurchase(),
    membershipUserId: 7001,
    kind: "membership",
    itemName: "מנוי מתקדמים 4 חודשים",
    startDate: "2026-09-28",
    endDate: "2027-01-27",
    sessionsLeft: null,
    paid: 3200,
    ...overrides,
  };
}

function plan(overrides: Partial<ImportPlanRow> = {}): ImportPlanRow {
  return {
    id: "plan-1",
    profileId: "prof-1",
    productKind: "session_card",
    startsOn: "2026-09-01",
    endsOn: "2026-11-30",
    sessionsTotal: 10,
    status: "active",
    createdOn: "2026-09-01",
    orderPaymentMethod: "arbox",
    orderProviderTransactionId: "arbox:4000",
    ...overrides,
  };
}

function run(overrides: Partial<Parameters<typeof planArboxImports>[0]> = {}) {
  return planArboxImports({
    today: TODAY,
    purchases: [cardPurchase()],
    trainees: [TRAINEE],
    plans: [],
    importedKeys: new Set(),
    products: PRODUCTS,
    ...overrides,
  });
}

describe("skips", () => {
  test.each([
    ["not_linked", { purchases: [cardPurchase({ userId: 999 })] }],
    ["inactive_status", { purchases: [cardPurchase({ status: "inactive" })] }],
    ["no_end_date", { purchases: [membershipPurchase({ endDate: null })] }],
    ["ended", { purchases: [cardPurchase({ endDate: "2026-09-26" })] }],
    ["no_sessions_left", { purchases: [cardPurchase({ sessionsLeft: 0 })] }],
    ["already_imported", { importedKeys: new Set(["arbox:5001"]) }],
    ["invalid_phone", { trainees: [{ ...TRAINEE, phone: "0501234567" }] }],
  ] as const)("%s", (reason, overrides) => {
    const { actions, skips } = run(overrides);

    expect(actions).toEqual([]);
    expect(skips.map((s) => s.reason)).toEqual([reason]);
  });

  test("a hand-entered Arbox plan created on or after the purchase covers it", () => {
    const hand = plan({ createdOn: "2026-09-28", orderProviderTransactionId: null });

    const { actions, skips } = run({ plans: [hand] });

    expect(actions).toEqual([]);
    expect(skips[0].reason).toBe("covered_by_hand");
  });

  test("a hand-entered plan paid another way does not cover it", () => {
    const cash = plan({ createdOn: "2026-09-28", orderPaymentMethod: "cash", orderProviderTransactionId: null });

    const { skips } = run({ plans: [cash] });

    expect(skips).toEqual([]);
  });

  test("a hand-entered Arbox plan from before the purchase does not cover it", () => {
    const older = plan({ createdOn: "2026-09-24", orderProviderTransactionId: null });

    const { actions } = run({ plans: [older] });

    expect(actions).toHaveLength(1);
  });
});

describe("new plan", () => {
  test("a card with nothing live starts at the later of today and Arbox's start", () => {
    const { actions } = run();

    expect(actions).toEqual([
      {
        type: "create",
        purchase: cardPurchase(),
        profileId: "prof-1",
        chained: false,
        order: {
          key: "arbox:5001",
          productId: "p-card10",
          profileId: "prof-1",
          amountIls: 1250,
          reference: "Arbox כרטיסייה 28.9",
          childName: "יון דגן",
          childBirthdate: "2015-01-01",
          parentName: "הורה",
          phone: "+972501234567",
        },
        plan: {
          id: newPlanId("arbox:5001"),
          productId: "p-card10",
          startsOn: "2026-09-28",
          endsOn: "2026-12-27",
          sessionsTotal: 10,
          note: "Arbox import כרטיסייה 2026-09-28 (5001)",
        },
      },
    ]);
  });

  test("a card bought earlier starts today", () => {
    const { actions } = run({ purchases: [cardPurchase({ startDate: "2026-09-20", purchaseDate: "2026-09-20" })] });

    expect(actions[0].type === "create" && actions[0].plan.startsOn).toBe(TODAY);
  });

  test("more than 10 sessions uses the 20 card", () => {
    const { actions } = run({ purchases: [cardPurchase({ sessionsLeft: 14 })] });

    expect(actions[0].order.productId).toBe("p-card20");
  });

  test("a long membership is a term, a short one monthly", () => {
    const long = run({ purchases: [membershipPurchase()] }).actions[0];
    const short = run({ purchases: [membershipPurchase({ endDate: "2026-10-27" })] }).actions[0];

    expect(long.type === "create" && long.plan).toMatchObject({ productId: "p-term", sessionsTotal: null, endsOn: "2027-01-27" });
    expect(short.order.productId).toBe("p-monthly");
  });

  test("an unpaid purchase is recorded at 1", () => {
    const { actions } = run({ purchases: [cardPurchase({ paid: 0 })] });

    expect(actions[0].order.amountIls).toBe(1);
  });
});

describe("chain", () => {
  test("a card beside a live plan paid another way starts the day after it, keeping its length", () => {
    const online = plan({ orderPaymentMethod: "card", orderProviderTransactionId: null, endsOn: "2026-10-31" });

    const { actions } = run({ plans: [online] });

    expect(actions[0]).toMatchObject({
      type: "create",
      chained: true,
      plan: { startsOn: "2026-11-01", endsOn: "2027-01-30" },
    });
  });

  test("a card beside a live membership starts after the membership", () => {
    const membershipPlan = plan({ productKind: "term", sessionsTotal: null, endsOn: "2026-12-31" });

    const { actions } = run({ plans: [membershipPlan] });

    expect(actions[0]).toMatchObject({ type: "create", chained: true, plan: { startsOn: "2027-01-01" } });
  });
});

describe("merge", () => {
  test("a card adds its sessions to a live Arbox card plan and keeps the later end", () => {
    const { actions } = run({ plans: [plan()] });

    expect(actions[0]).toMatchObject({
      type: "merge",
      target: { planId: "plan-1", expectSessionsTotal: 10, expectEndsOn: "2026-11-30" },
      set: { sessionsTotal: 20, endsOn: "2026-12-27", clearThreeDays: true, clearLastSession: true, clearExpired: true },
      shifts: [],
    });
  });

  test("a null session total counts as zero", () => {
    const { actions } = run({ plans: [plan({ sessionsTotal: null })] });

    expect(actions[0].type === "merge" && actions[0].set.sessionsTotal).toBe(10);
  });

  test("a membership extends a live Arbox membership and moves a queued plan behind it", () => {
    const membershipPlan = plan({ id: "m-1", productKind: "term", sessionsTotal: null, endsOn: "2026-12-31" });
    const queued = plan({ id: "q-1", startsOn: "2027-01-01", endsOn: "2027-03-31" });

    const { actions } = run({ purchases: [membershipPurchase()], plans: [membershipPlan, queued] });

    expect(actions[0]).toMatchObject({
      type: "merge",
      target: { planId: "m-1" },
      set: { sessionsTotal: null, endsOn: "2027-01-27", clearThreeDays: true },
      shifts: [{ planId: "q-1", expectStartsOn: "2027-01-01", startsOn: "2027-01-28", endsOn: "2027-04-27" }],
    });
  });

  test("a membership ending sooner than the live one changes nothing but is recorded", () => {
    const membershipPlan = plan({ id: "m-1", productKind: "term", sessionsTotal: null, endsOn: "2027-06-30" });

    const { actions } = run({ purchases: [membershipPurchase()], plans: [membershipPlan] });

    expect(actions[0]).toMatchObject({
      type: "merge",
      set: { endsOn: "2027-06-30", clearThreeDays: false, clearLastSession: false, clearExpired: false },
      shifts: [],
    });
  });

  test("two cards in one run: the second merges into the plan the first creates", () => {
    const first = cardPurchase({ membershipUserId: 5001, purchaseDate: "2026-09-20", startDate: "2026-09-20", sessionsLeft: 4, endDate: "2026-10-07" });
    const second = cardPurchase({ membershipUserId: 5002, sessionsLeft: 10, endDate: "2026-12-24" });

    const { actions } = run({ purchases: [second, first] });

    expect(actions.map((a) => a.type)).toEqual(["create", "merge"]);
    expect(actions[1]).toMatchObject({
      target: { planId: newPlanId(purchaseKey(first)), expectSessionsTotal: 4, expectEndsOn: "2026-10-07" },
      set: { sessionsTotal: 14, endsOn: "2026-12-24" },
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:run -- src/lib/plans/__tests__/arbox-import-plan.test.ts`
Expected: FAIL, cannot resolve `../arbox-import-plan`.

- [ ] **Step 3: Implement**

```ts
/**
 * What the nightly import does with each Arbox purchase. Pure: the same
 * inputs always give the same actions, so the dry run shows exactly what the
 * cron will write.
 *
 * Our system counts usage; Arbox only tells us a purchase happened. A
 * purchase merges into a live plan of the same kind that is itself paid in
 * Arbox, or starts after whatever is live, because two overlapping plans of
 * one kind double-count sessions (pickRelevantPlan evaluates only one) and a
 * merge into a plan paid another way would keep renewal reminders going.
 */
import type { ArboxPurchase } from "@/lib/arbox/purchase-rows";
import { addDays, daysBetween, shortDate } from "@/lib/utils/iso-date";
import type { PlanKind } from "@/types/plans";

const IMPORTABLE_STATUSES: ReadonlySet<string> = new Set(["active", "activeMemberWithFutureCancel"]);
const LONG_MEMBERSHIP_DAYS = 45;
const CARD_10_MAX_SESSIONS = 10;
const E164_IL = /^\+972\d{9}$/;
const REFERENCE_MAX = 60;

export const purchaseKey = (p: Pick<ArboxPurchase, "membershipUserId">): string =>
  `arbox:${p.membershipUserId}`;

/** A plan created earlier in the same run, before it has a real id. */
export const newPlanId = (key: string): string => `new:${key}`;

export interface ImportTrainee {
  readonly profileId: string;
  readonly arboxUserId: number;
  readonly name: string;
  readonly birthdate: string | null;
  readonly phone: string | null;
  readonly guardianName: string | null;
}

export interface ImportPlanRow {
  readonly id: string;
  readonly profileId: string;
  readonly productKind: PlanKind;
  readonly startsOn: string;
  readonly endsOn: string;
  readonly sessionsTotal: number | null;
  readonly status: "active" | "cancelled";
  /** Israel date the row was created. */
  readonly createdOn: string;
  readonly orderPaymentMethod: string | null;
  readonly orderProviderTransactionId: string | null;
}

export interface ImportProducts {
  readonly card10: string;
  readonly card20: string;
  readonly monthly: string;
  readonly term: string;
}

export type ImportSkipReason =
  | "not_linked"
  | "inactive_status"
  | "no_end_date"
  | "ended"
  | "no_sessions_left"
  | "already_imported"
  | "covered_by_hand"
  | "invalid_phone";

export interface ImportOrderDraft {
  readonly key: string;
  readonly productId: string;
  readonly profileId: string;
  readonly amountIls: number;
  readonly reference: string;
  readonly childName: string;
  readonly childBirthdate: string | null;
  readonly parentName: string;
  readonly phone: string;
}

export interface PlanShift {
  readonly planId: string;
  readonly expectStartsOn: string;
  readonly startsOn: string;
  readonly endsOn: string;
}

export interface CreatePlanAction {
  readonly type: "create";
  readonly purchase: ArboxPurchase;
  readonly profileId: string;
  readonly chained: boolean;
  readonly order: ImportOrderDraft;
  readonly plan: {
    readonly id: string;
    readonly productId: string;
    readonly startsOn: string;
    readonly endsOn: string;
    readonly sessionsTotal: number | null;
    readonly note: string;
  };
}

export interface MergePlanAction {
  readonly type: "merge";
  readonly purchase: ArboxPurchase;
  readonly profileId: string;
  readonly order: ImportOrderDraft;
  readonly target: { readonly planId: string; readonly expectSessionsTotal: number | null; readonly expectEndsOn: string };
  readonly set: {
    readonly sessionsTotal: number | null;
    readonly endsOn: string;
    readonly clearThreeDays: boolean;
    readonly clearLastSession: boolean;
    readonly clearExpired: boolean;
  };
  readonly shifts: readonly PlanShift[];
}

export type ImportAction = CreatePlanAction | MergePlanAction;

export interface ImportSkip {
  readonly purchase: ArboxPurchase;
  readonly reason: ImportSkipReason;
  readonly profileId: string | null;
}

export interface PlanArboxImportsInput {
  readonly today: string;
  readonly purchases: readonly ArboxPurchase[];
  readonly trainees: readonly ImportTrainee[];
  readonly plans: readonly ImportPlanRow[];
  readonly importedKeys: ReadonlySet<string>;
  readonly products: ImportProducts;
}

const laterOf = (a: string, b: string): string => (a > b ? a : b);

const isLive = (p: ImportPlanRow, today: string): boolean =>
  p.status === "active" && p.endsOn >= today && p.productKind !== "addon";

const isArboxPaid = (p: ImportPlanRow): boolean => p.orderPaymentMethod === "arbox";

const isHandEnteredArbox = (p: ImportPlanRow): boolean =>
  isArboxPaid(p) && p.orderProviderTransactionId === null;

const isSameKind = (purchase: ArboxPurchase, p: ImportPlanRow): boolean =>
  purchase.kind === "card"
    ? p.productKind === "session_card"
    : p.productKind === "subscription" || p.productKind === "term";

function skipReason(
  p: ArboxPurchase,
  trainee: ImportTrainee | undefined,
  plans: readonly ImportPlanRow[],
  input: PlanArboxImportsInput,
): ImportSkipReason | null {
  if (!trainee) return "not_linked";
  if (!IMPORTABLE_STATUSES.has(p.status)) return "inactive_status";
  if (p.endDate === null) return "no_end_date";
  if (p.endDate < input.today) return "ended";
  if (p.kind === "card" && (p.sessionsLeft === null || p.sessionsLeft <= 0)) return "no_sessions_left";
  if (input.importedKeys.has(purchaseKey(p))) return "already_imported";
  if (plans.some((pl) => isHandEnteredArbox(pl) && pl.createdOn >= p.purchaseDate)) return "covered_by_hand";
  if (!trainee.phone || !E164_IL.test(trainee.phone)) return "invalid_phone";
  return null;
}

function productFor(p: ArboxPurchase, products: ImportProducts): { id: string; kind: PlanKind } {
  if (p.kind === "card") {
    const id = (p.sessionsLeft ?? 0) <= CARD_10_MAX_SESSIONS ? products.card10 : products.card20;
    return { id, kind: "session_card" };
  }
  return daysBetween(p.startDate, p.endDate as string) > LONG_MEMBERSHIP_DAYS
    ? { id: products.term, kind: "term" }
    : { id: products.monthly, kind: "subscription" };
}

function orderDraft(p: ArboxPurchase, trainee: ImportTrainee, productId: string): ImportOrderDraft {
  return {
    key: purchaseKey(p),
    productId,
    profileId: trainee.profileId,
    amountIls: p.paid !== null && p.paid > 0 ? p.paid : 1,
    reference: `Arbox ${p.itemName} ${shortDate(p.purchaseDate)}`.slice(0, REFERENCE_MAX),
    childName: trainee.name,
    childBirthdate: trainee.birthdate,
    parentName: trainee.guardianName ?? "הורה",
    phone: trainee.phone as string,
  };
}

interface Planned {
  readonly action: ImportAction;
  readonly plans: readonly ImportPlanRow[];
}

function planMerge(
  p: ArboxPurchase,
  target: ImportPlanRow,
  live: readonly ImportPlanRow[],
  plans: readonly ImportPlanRow[],
  order: ImportOrderDraft,
  today: string,
): Planned {
  const endsOn = laterOf(target.endsOn, p.endDate as string);
  const grew = endsOn > target.endsOn;
  const isCard = p.kind === "card";
  const sessionsTotal = isCard ? (target.sessionsTotal ?? 0) + (p.sessionsLeft as number) : target.sessionsTotal;
  const shifts: PlanShift[] = grew
    ? live
        .filter((pl) => pl.id !== target.id && pl.startsOn > today && pl.startsOn <= endsOn)
        .map((pl) => {
          const by = daysBetween(pl.startsOn, endsOn) + 1;
          return { planId: pl.id, expectStartsOn: pl.startsOn, startsOn: addDays(pl.startsOn, by), endsOn: addDays(pl.endsOn, by) };
        })
    : [];
  const shiftById = new Map(shifts.map((s) => [s.planId, s]));

  const action: MergePlanAction = {
    type: "merge",
    purchase: p,
    profileId: target.profileId,
    order,
    target: { planId: target.id, expectSessionsTotal: target.sessionsTotal, expectEndsOn: target.endsOn },
    set: { sessionsTotal, endsOn, clearThreeDays: grew, clearLastSession: isCard || grew, clearExpired: isCard || grew },
    shifts,
  };
  const next = plans.map((pl) => {
    if (pl.id === target.id) return { ...pl, endsOn, sessionsTotal };
    const shift = shiftById.get(pl.id);
    return shift ? { ...pl, startsOn: shift.startsOn, endsOn: shift.endsOn } : pl;
  });
  return { action, plans: next };
}

function planCreate(
  p: ArboxPurchase,
  trainee: ImportTrainee,
  live: readonly ImportPlanRow[],
  plans: readonly ImportPlanRow[],
  product: { id: string; kind: PlanKind },
  order: ImportOrderDraft,
  today: string,
): Planned {
  const windowStart = laterOf(today, p.startDate);
  const span = daysBetween(windowStart, p.endDate as string);
  const latestEnd = live.reduce<string | null>((acc, pl) => (acc === null || pl.endsOn > acc ? pl.endsOn : acc), null);
  const startsOn = latestEnd === null ? windowStart : laterOf(addDays(latestEnd, 1), windowStart);
  const endsOn = addDays(startsOn, span);
  const sessionsTotal = p.kind === "card" ? p.sessionsLeft : null;
  const id = newPlanId(order.key);

  const action: CreatePlanAction = {
    type: "create",
    purchase: p,
    profileId: trainee.profileId,
    chained: latestEnd !== null,
    order,
    plan: { id, productId: product.id, startsOn, endsOn, sessionsTotal, note: `Arbox import ${p.itemName} ${p.purchaseDate} (${p.membershipUserId})` },
  };
  const created: ImportPlanRow = {
    id,
    profileId: trainee.profileId,
    productKind: product.kind,
    startsOn,
    endsOn,
    sessionsTotal,
    status: "active",
    createdOn: today,
    orderPaymentMethod: "arbox",
    orderProviderTransactionId: order.key,
  };
  return { action, plans: [...plans, created] };
}

function planOne(p: ArboxPurchase, trainee: ImportTrainee, plans: readonly ImportPlanRow[], input: PlanArboxImportsInput): Planned {
  const live = plans.filter((pl) => isLive(pl, input.today));
  const target = live
    .filter((pl) => isArboxPaid(pl) && isSameKind(p, pl))
    .reduce<ImportPlanRow | null>((acc, pl) => (acc === null || pl.endsOn > acc.endsOn ? pl : acc), null);
  const product = productFor(p, input.products);
  const order = orderDraft(p, trainee, product.id);
  return target
    ? planMerge(p, target, live, plans, order, input.today)
    : planCreate(p, trainee, live, plans, product, order, input.today);
}

const byPurchaseOrder = (a: ArboxPurchase, b: ArboxPurchase): number =>
  a.userId - b.userId || a.purchaseDate.localeCompare(b.purchaseDate) || a.membershipUserId - b.membershipUserId;

export function planArboxImports(input: PlanArboxImportsInput): { actions: ImportAction[]; skips: ImportSkip[] } {
  const traineeByArbox = new Map(input.trainees.map((t) => [t.arboxUserId, t]));
  const initialPlans = new Map<string, readonly ImportPlanRow[]>(
    input.trainees.map((t) => [t.profileId, input.plans.filter((pl) => pl.profileId === t.profileId)]),
  );

  const result = [...input.purchases].sort(byPurchaseOrder).reduce(
    (state, p) => {
      const trainee = traineeByArbox.get(p.userId);
      const plans = trainee ? state.plans.get(trainee.profileId) ?? [] : [];
      const reason = skipReason(p, trainee, plans, input);
      if (reason || !trainee) {
        const skip: ImportSkip = { purchase: p, reason: reason ?? "not_linked", profileId: trainee?.profileId ?? null };
        return { ...state, skips: [...state.skips, skip] };
      }
      const planned = planOne(p, trainee, plans, input);
      return {
        plans: new Map(state.plans).set(trainee.profileId, planned.plans),
        actions: [...state.actions, planned.action],
        skips: state.skips,
      };
    },
    { plans: initialPlans, actions: [] as ImportAction[], skips: [] as ImportSkip[] },
  );

  return { actions: result.actions, skips: result.skips };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test:run -- src/lib/plans/__tests__/arbox-import-plan.test.ts`
Expected: PASS (all tests). If the file passes 400 lines, move the type declarations into `src/lib/plans/arbox-import-types.ts` and re-export them from `arbox-import-plan.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/plans/arbox-import-plan.ts src/lib/plans/__tests__/arbox-import-plan.test.ts
git commit -m "feat(plans): plan how each Arbox purchase becomes a trainee plan"
```

---

### Task 3: Load, fetch and apply

**Files:**
- Create: `src/lib/arbox/purchases.ts`
- Create: `src/features/plans/lib/arbox-import.ts`

**Interfaces:**
- Consumes: Task 1 (`purchasesFromReports`, row types, `UnmatchedCard`), Task 2 (`planArboxImports`, all types, `newPlanId`), `fetchArboxReport` from `@/lib/arbox/fetch`, `monthWindows` from `@/lib/arbox/access`, `createAdminClient` from `@/lib/supabase/admin`, `israelToday` from `@/lib/utils/tasks`.
- Produces:
  - `fetchArboxPurchases(now: Date): Promise<{ purchases: ArboxPurchase[]; unmatchedCards: UnmatchedCard[] }>`
  - `interface ImportRunResult { dryRun: boolean; purchases: number; unmatchedCards: number; created: number; merged: number; alreadyImported: number; failed: number; skipped: Partial<Record<ImportSkipReason, number>>; touchedProfileIds: string[] }`
  - `runArboxPurchaseImport(opts: { dryRun: boolean; now?: Date }): Promise<{ result: ImportRunResult; actions: ImportAction[]; skips: ImportSkip[]; unmatchedCards: UnmatchedCard[]; traineeNames: Map<string, string> }>`

This module talks to Arbox and the database, so per the project's testing rule it has no unit tests; it is verified by `npx tsc --noEmit` here and by the dry run in Task 5. Neither file may import `server-only`, because the script in Task 4 runs it under tsx.

- [ ] **Step 1: Write the Arbox fetch**

`src/lib/arbox/purchases.ts`:

```ts
import { monthWindows } from "./access";
import { fetchArboxReport } from "./fetch";
import {
  purchasesFromReports,
  type ArboxPurchase,
  type MembershipsReportRow,
  type SalesReportRow,
  type SessionsReportRow,
  type UnmatchedCard,
} from "./purchase-rows";

/** Arbox has no sales before this month; earlier cards cannot be keyed. */
const SALES_HISTORY_START = "2026-02-01";

/** Every live card and membership in Arbox, keyed by Arbox's purchase id. */
export async function fetchArboxPurchases(
  now: Date,
): Promise<{ purchases: ArboxPurchase[]; unmatchedCards: UnmatchedCard[] }> {
  const cards = await fetchArboxReport<SessionsReportRow>("sessionsReport");
  const memberships = await fetchArboxReport<MembershipsReportRow>("activeMembershipsReport");
  // Serial on purpose, like the access step: Arbox rate-limits bursts.
  const salesPages: SalesReportRow[][] = [];
  for (const window of monthWindows(SALES_HISTORY_START, now)) {
    salesPages.push(await fetchArboxReport<SalesReportRow>("salesReport", { fromDate: window.from, toDate: window.to }));
  }
  return purchasesFromReports({ cards, memberships, sales: salesPages.flat() });
}
```

- [ ] **Step 2: Write the loader**

`src/features/plans/lib/arbox-import.ts`, first half:

```ts
/**
 * The nightly Arbox purchase import: read both sides, plan with the pure
 * planner, apply one purchase at a time. Spec:
 * docs/superpowers/specs/2026-09-27-arbox-purchase-import-design.md
 *
 * No "server-only": scripts/import-arbox-purchases.ts runs this under tsx.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { fetchArboxPurchases } from "@/lib/arbox/purchases";
import type { UnmatchedCard } from "@/lib/arbox/purchase-rows";
import {
  newPlanId,
  planArboxImports,
  type CreatePlanAction,
  type ImportAction,
  type ImportOrderDraft,
  type ImportPlanRow,
  type ImportProducts,
  type ImportSkip,
  type ImportSkipReason,
  type ImportTrainee,
  type MergePlanAction,
} from "@/lib/plans/arbox-import-plan";
import { createAdminClient } from "@/lib/supabase/admin";
import { israelToday } from "@/lib/utils/tasks";
import type { Database } from "@/types/database";
import type { PlanKind } from "@/types/plans";

type Db = SupabaseClient<Database>;

/** Same literal as KIRYAT_ATA_BRANCH_NAME in enrollment/lib/catalog.ts, which is server-only. */
const KIRYAT_ATA = "קריית אתא";
const PRODUCT_SLUGS = { card10: "card_10", card20: "card_20", monthly: "monthly", term: "term_4_months" } as const;

interface OurSide {
  readonly branchId: string;
  readonly trainees: ImportTrainee[];
  readonly plans: ImportPlanRow[];
  readonly importedKeys: Set<string>;
  readonly products: ImportProducts;
}

async function loadBranchId(db: Db): Promise<string> {
  const { data, error } = await db.from("branches").select("id").eq("name_he", KIRYAT_ATA).single();
  if (error || !data) throw new Error(`[arbox-import] branch ${KIRYAT_ATA} not found: ${error?.message}`);
  return data.id;
}

async function loadTrainees(db: Db, branchId: string): Promise<ImportTrainee[]> {
  const { data: links, error: linkError } = await db.from("profile_branches").select("profile_id").eq("branch_id", branchId);
  if (linkError) throw new Error(`[arbox-import] branch members: ${linkError.message}`);
  const ids = (links ?? []).map((l) => l.profile_id);
  if (ids.length === 0) return [];

  const { data, error } = await db
    .from("profiles")
    .select("id, full_name, birthdate, phone, guardian_name, arbox_user_id")
    .in("id", ids)
    .eq("role", "trainee")
    .is("deleted_at", null)
    .not("arbox_user_id", "is", null);
  if (error) throw new Error(`[arbox-import] trainees: ${error.message}`);
  return (data ?? []).map((p) => ({
    profileId: p.id,
    arboxUserId: Number(p.arbox_user_id),
    name: p.full_name ?? "מתאמן",
    birthdate: p.birthdate,
    phone: p.phone,
    guardianName: p.guardian_name,
  }));
}

async function loadPlans(db: Db, profileIds: readonly string[]): Promise<ImportPlanRow[]> {
  if (profileIds.length === 0) return [];
  const { data, error } = await db
    .from("trainee_plans")
    .select("id, profile_id, starts_on, ends_on, sessions_total, status, created_at, product:plan_products(kind), order:orders(payment_method, provider_transaction_id)")
    .in("profile_id", [...profileIds]);
  if (error) throw new Error(`[arbox-import] plans: ${error.message}`);
  type Row = {
    id: string; profile_id: string; starts_on: string; ends_on: string; sessions_total: number | null;
    status: string; created_at: string;
    product: { kind: string } | null;
    order: { payment_method: string | null; provider_transaction_id: string | null } | null;
  };
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id,
    profileId: r.profile_id,
    productKind: (r.product?.kind ?? "addon") as PlanKind,
    startsOn: r.starts_on,
    endsOn: r.ends_on,
    sessionsTotal: r.sessions_total,
    status: r.status === "cancelled" ? "cancelled" : "active",
    createdOn: israelToday(new Date(r.created_at)),
    orderPaymentMethod: r.order?.payment_method ?? null,
    orderProviderTransactionId: r.order?.provider_transaction_id ?? null,
  }));
}

async function loadImportedKeys(db: Db): Promise<Set<string>> {
  const { data, error } = await db
    .from("orders")
    .select("provider_transaction_id")
    .eq("payment_provider", "manual")
    .like("provider_transaction_id", "arbox:%");
  if (error) throw new Error(`[arbox-import] imported keys: ${error.message}`);
  return new Set((data ?? []).map((o) => o.provider_transaction_id).filter((k): k is string => k !== null));
}

async function loadProducts(db: Db, branchId: string): Promise<ImportProducts> {
  const { data, error } = await db
    .from("plan_products")
    .select("id, slug")
    .eq("branch_id", branchId)
    .in("slug", Object.values(PRODUCT_SLUGS));
  if (error) throw new Error(`[arbox-import] products: ${error.message}`);
  const bySlug = new Map((data ?? []).map((p) => [p.slug, p.id]));
  const pick = (slug: string): string => {
    const id = bySlug.get(slug);
    if (!id) throw new Error(`[arbox-import] product ${slug} missing in ${KIRYAT_ATA}`);
    return id;
  };
  return {
    card10: pick(PRODUCT_SLUGS.card10),
    card20: pick(PRODUCT_SLUGS.card20),
    monthly: pick(PRODUCT_SLUGS.monthly),
    term: pick(PRODUCT_SLUGS.term),
  };
}

async function loadOurSide(db: Db): Promise<OurSide> {
  const branchId = await loadBranchId(db);
  const trainees = await loadTrainees(db, branchId);
  const [plans, importedKeys, products] = await Promise.all([
    loadPlans(db, trainees.map((t) => t.profileId)),
    loadImportedKeys(db),
    loadProducts(db, branchId),
  ]);
  return { branchId, trainees, plans, importedKeys, products };
}
```

If `npx tsc --noEmit` rejects a typed `.select(...)` string or the `.in("slug", ...)` literal types, cast the query result the way `loadPlans` does rather than falling back to `typedFrom`.

- [ ] **Step 3: Write the applier and the entry point**

Second half of `src/features/plans/lib/arbox-import.ts`:

```ts
type InsertOrderResult = { id: string } | "duplicate" | "failed";

async function insertOrder(db: Db, branchId: string, o: ImportOrderDraft): Promise<InsertOrderResult> {
  const now = new Date().toISOString();
  const { data, error } = await db
    .from("orders")
    .insert({
      product_id: o.productId,
      branch_id: branchId,
      status: "paid",
      paid_at: now,
      fulfilled_at: now,
      payment_provider: "manual",
      payment_method: "arbox",
      provider_transaction_id: o.key,
      reference: o.reference,
      received_by: null,
      amount_ils: o.amountIls,
      parent_name: o.parentName,
      payer_phone: o.phone,
      login_phone: o.phone,
      child_name: o.childName,
      child_birthdate: o.childBirthdate,
      email: null,
      profile_id: o.profileId,
      installments: 1,
    })
    .select("id")
    .single();
  if (error?.code === "23505") return "duplicate";
  if (error || !data) {
    console.error(`[arbox-import] order ${o.key} failed:`, error?.message);
    return "failed";
  }
  return { id: data.id };
}

async function deleteOrder(db: Db, orderId: string): Promise<void> {
  const { error } = await db.from("orders").delete().eq("id", orderId);
  if (error) console.error(`[arbox-import] rollback of order ${orderId} failed:`, error.message);
}

async function logGrant(db: Db, a: ImportAction, orderId: string, planId: string): Promise<void> {
  const { error } = await db.from("activity_logs").insert({
    user_id: a.profileId,
    action: "plan_granted",
    actor_id: null,
    actor_name: "Arbox",
    metadata: { source: "arbox-import", type: a.type, orderId, planId, arboxMembershipUserId: a.purchase.membershipUserId },
  });
  if (error) console.error(`[arbox-import] activity log failed:`, error.message);
}

async function applyCreate(db: Db, branchId: string, a: CreatePlanAction, orderId: string): Promise<string | null> {
  const { data, error } = await db
    .from("trainee_plans")
    .insert({
      profile_id: a.profileId,
      product_id: a.plan.productId,
      branch_id: branchId,
      order_id: orderId,
      starts_on: a.plan.startsOn,
      ends_on: a.plan.endsOn,
      sessions_total: a.plan.sessionsTotal,
      status: "active",
      source: "manual",
      note: a.plan.note,
      created_by: null,
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error(`[arbox-import] plan for ${a.order.key} failed:`, error?.message);
    return null;
  }
  return data.id;
}

async function applyMerge(db: Db, a: MergePlanAction, targetId: string, resolve: (id: string) => string | null): Promise<string | null> {
  const clears = {
    ...(a.set.clearThreeDays ? { reminded_3_days_at: null } : {}),
    ...(a.set.clearLastSession ? { reminded_last_session_at: null } : {}),
    ...(a.set.clearExpired ? { reminded_expired_at: null } : {}),
  };
  const base = db
    .from("trainee_plans")
    .update({ sessions_total: a.set.sessionsTotal, ends_on: a.set.endsOn, ...clears })
    .eq("id", targetId)
    .eq("ends_on", a.target.expectEndsOn);
  // Guarded by the values the plan was read with: a staff edit in between
  // makes this match nothing, and the purchase retries next night.
  const guarded = a.target.expectSessionsTotal === null
    ? base.is("sessions_total", null)
    : base.eq("sessions_total", a.target.expectSessionsTotal);
  const { data, error } = await guarded.select("id");
  if (error || (data ?? []).length === 0) {
    console.error(`[arbox-import] merge of ${a.order.key} into ${targetId} failed:`, error?.message ?? "plan changed");
    return null;
  }
  for (const shift of a.shifts) {
    const planId = resolve(shift.planId);
    if (!planId) continue;
    const { error: shiftError } = await db
      .from("trainee_plans")
      .update({ starts_on: shift.startsOn, ends_on: shift.endsOn })
      .eq("id", planId)
      .eq("starts_on", shift.expectStartsOn);
    if (shiftError) console.error(`[arbox-import] moving queued plan ${planId} failed:`, shiftError.message);
  }
  return targetId;
}

export interface ImportRunResult {
  readonly dryRun: boolean;
  readonly purchases: number;
  readonly unmatchedCards: number;
  readonly created: number;
  readonly merged: number;
  readonly alreadyImported: number;
  readonly failed: number;
  readonly skipped: Partial<Record<ImportSkipReason, number>>;
  readonly touchedProfileIds: string[];
}

type Outcome = "created" | "merged" | "alreadyImported" | "failed";

async function applyOne(
  db: Db,
  branchId: string,
  a: ImportAction,
  resolve: (id: string) => string | null,
  remember: (placeholder: string, realId: string) => void,
): Promise<Outcome> {
  const targetId = a.type === "merge" ? resolve(a.target.planId) : null;
  if (a.type === "merge" && !targetId) return "failed";

  const order = await insertOrder(db, branchId, a.order);
  if (order === "duplicate") return "alreadyImported";
  if (order === "failed") return "failed";

  const planId = a.type === "create"
    ? await applyCreate(db, branchId, a, order.id)
    : await applyMerge(db, a, targetId as string, resolve);
  if (!planId) {
    await deleteOrder(db, order.id);
    return "failed";
  }
  if (a.type === "create") remember(a.plan.id, planId);
  await logGrant(db, a, order.id, planId);
  return a.type === "create" ? "created" : "merged";
}

function countSkips(skips: readonly ImportSkip[]): Partial<Record<ImportSkipReason, number>> {
  return skips.reduce<Partial<Record<ImportSkipReason, number>>>(
    (acc, s) => ({ ...acc, [s.reason]: (acc[s.reason] ?? 0) + 1 }),
    {},
  );
}

export async function runArboxPurchaseImport(opts: { dryRun: boolean; now?: Date }): Promise<{
  result: ImportRunResult;
  actions: ImportAction[];
  skips: ImportSkip[];
  unmatchedCards: UnmatchedCard[];
  traineeNames: Map<string, string>;
}> {
  const now = opts.now ?? new Date();
  const db = createAdminClient() as Db;
  const { purchases, unmatchedCards } = await fetchArboxPurchases(now);
  const ours = await loadOurSide(db);
  const { actions, skips } = planArboxImports({
    today: israelToday(now),
    purchases,
    trainees: ours.trainees,
    plans: ours.plans,
    importedKeys: ours.importedKeys,
    products: ours.products,
  });
  const traineeNames = new Map(ours.trainees.map((t) => [t.profileId, t.name]));

  const realIds = new Map<string, string>();
  const resolve = (id: string): string | null => (id.startsWith(newPlanId("")) ? realIds.get(id) ?? null : id);
  const outcomes: Outcome[] = [];
  if (!opts.dryRun) {
    for (const a of actions) {
      outcomes.push(await applyOne(db, ours.branchId, a, resolve, (p, r) => realIds.set(p, r)));
    }
  }
  const count = (o: Outcome) => outcomes.filter((x) => x === o).length;
  const touched = actions.filter((_, i) => outcomes[i] === "created" || outcomes[i] === "merged").map((a) => a.profileId);

  return {
    result: {
      dryRun: opts.dryRun,
      purchases: purchases.length,
      unmatchedCards: unmatchedCards.length,
      created: count("created"),
      merged: count("merged"),
      alreadyImported: count("alreadyImported"),
      failed: count("failed"),
      skipped: countSkips(skips),
      touchedProfileIds: [...new Set(touched)],
    },
    actions,
    skips,
    unmatchedCards,
    traineeNames,
  };
}
```

If the file passes 400 lines, move the applier (everything from `insertOrder` through `applyOne`) into `src/features/plans/lib/arbox-import-apply.ts` and import it.

- [ ] **Step 4: Type-check and lint**

Run: `npx tsc --noEmit && npx eslint src/lib/arbox/purchases.ts src/features/plans/lib/arbox-import.ts`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add src/lib/arbox/purchases.ts src/features/plans/lib/arbox-import.ts
git commit -m "feat(plans): load, plan and apply Arbox purchase imports"
```

---

### Task 4: Cron step, dry-run script, docs

**Files:**
- Modify: `src/app/api/cron/arbox-sync/route.ts`
- Create: `scripts/import-arbox-purchases.ts`
- Modify: `CLAUDE.md` (Environment Variables and the קריית אתא signup section)

**Interfaces:**
- Consumes: `runArboxPurchaseImport`, `ImportRunResult` (Task 3); `revalidateStaffSurfaces(profileId: string)` from `@/features/plans/lib/revalidate-staff`; `loadEnvLocal` from `scripts/import-utils.ts`.

- [ ] **Step 1: Add the cron step**

In `route.ts`, add the imports:

```ts
import { runArboxPurchaseImport, type ImportRunResult } from "@/features/plans/lib/arbox-import";
import { revalidateStaffSurfaces } from "@/features/plans/lib/revalidate-staff";
```

After the access step's try/catch and before the `return NextResponse.json(...)`:

```ts
    // Runs last: it needs the links the user step just made. Behind a flag
    // until the owner approves a dry run; isolated like the access step.
    let purchasesResult: ImportRunResult | null = null;
    let purchasesError: string | null = null;
    if (process.env.ARBOX_IMPORT_PURCHASES === "on") {
      try {
        const { result } = await runArboxPurchaseImport({ dryRun: false });
        purchasesResult = result;
        result.touchedProfileIds.forEach(revalidateStaffSurfaces);
      } catch (error) {
        purchasesError = error instanceof Error ? error.message : String(error);
        console.error("[Arbox Sync] Purchase import failed:", purchasesError);
      }
    }
```

and add `purchases: purchasesResult, purchasesError,` to the JSON response. Update the route's header comment to mention the fourth step.

- [ ] **Step 2: Write the script**

`scripts/import-arbox-purchases.ts`:

```ts
/**
 * Import Arbox purchases into trainee plans, or preview it.
 *
 * The same code the nightly cron runs (src/features/plans/lib/arbox-import.ts);
 * this is the manual entry point and the dry-run report.
 *
 * Usage:
 *   npx tsx scripts/import-arbox-purchases.ts --dry-run
 *   npx tsx scripts/import-arbox-purchases.ts
 *
 * CRITICAL: writes to the PRODUCTION Supabase database. --dry-run is safe.
 */
import { runArboxPurchaseImport } from "../src/features/plans/lib/arbox-import.ts";
import { loadEnvLocal } from "./import-utils.ts";

const DRY_RUN = process.argv.includes("--dry-run");

async function main(): Promise<void> {
  loadEnvLocal();
  const { result, actions, skips, unmatchedCards, traineeNames } = await runArboxPurchaseImport({ dryRun: DRY_RUN });
  const name = (id: string | null) => (id ? traineeNames.get(id) ?? id : "-");

  console.log(`${result.purchases} Arbox purchases, ${result.unmatchedCards} cards without a unique sale\n`);
  console.log(`${actions.length} to apply:`);
  for (const a of actions) {
    const p = a.purchase;
    const what = a.type === "create"
      ? `${a.chained ? "chain" : "new"} ${a.plan.startsOn} -> ${a.plan.endsOn}, sessions ${a.plan.sessionsTotal ?? "-"}`
      : `merge into ${a.target.planId}: ends ${a.target.expectEndsOn} -> ${a.set.endsOn}, sessions ${a.target.expectSessionsTotal ?? "-"} -> ${a.set.sessionsTotal ?? "-"}${a.shifts.length ? `, moves ${a.shifts.length} queued` : ""}`;
    console.log(`  ${name(a.profileId)} | ${p.itemName} ${p.purchaseDate} (${p.membershipUserId}) | ${what} | ${a.order.amountIls} ILS`);
  }

  const shown = skips.filter((s) => s.reason !== "not_linked" && s.reason !== "already_imported");
  console.log(`\nskipped: ${JSON.stringify(result.skipped)}`);
  for (const s of shown) {
    console.log(`  ${s.reason} | ${name(s.profileId)} | ${s.purchase.itemName} ${s.purchase.purchaseDate} (${s.purchase.membershipUserId})`);
  }
  for (const c of unmatchedCards) {
    console.log(`  no unique sale | arbox user ${c.userId} | ${c.itemName} ${c.startDate} | ${c.matches} matches`);
  }

  if (!DRY_RUN) {
    console.log(`\napplied: created ${result.created}, merged ${result.merged}, already imported ${result.alreadyImported}, failed ${result.failed}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

- [ ] **Step 3: Document**

In `CLAUDE.md`, Environment Variables paragraph, add:

```text
`ARBOX_IMPORT_PURCHASES=on` turns on the nightly import of Arbox cards and memberships into קריית אתא plans (fourth step of `/api/cron/arbox-sync`); preview with `npx tsx scripts/import-arbox-purchases.ts --dry-run`.
```

In the קריית אתא signup section, after the Staff payments paragraph, add:

```text
Arbox purchases: `src/features/plans/lib/arbox-import.ts` imports each Arbox card or membership once, keyed `orders.provider_transaction_id = arbox:<membership_user_id>`; it merges into a live Arbox-paid plan of the same kind or starts after what is live. Rules live in the pure `planArboxImports()` (`src/lib/plans/arbox-import-plan.ts`). Spec: `docs/superpowers/specs/2026-09-27-arbox-purchase-import-design.md`.
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npx eslint src/app/api/cron/arbox-sync/route.ts scripts/import-arbox-purchases.ts && npm run test:run`
Expected: tsc and eslint silent; the suite fails only on the 20 known localStorage tests (goals, streak-tracking).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/cron/arbox-sync/route.ts scripts/import-arbox-purchases.ts CLAUDE.md
git commit -m "feat(plans): nightly Arbox purchase import behind ARBOX_IMPORT_PURCHASES, with a dry-run script"
```

---

### Task 5: Dry run against production

**Files:** none changed.

- [ ] **Step 1: Run the dry run**

Run: `npx tsx scripts/import-arbox-purchases.ts --dry-run`
Expected: a list of actions and skips. As of 2026-09-27, every קריית אתא trainee with an Arbox purchase has a hand-entered plan, so expect 0 actions, many `covered_by_hand`, and `not_linked` for purchases of trainees outside קריית אתא. Any action listed must be explainable from Arbox data.

- [ ] **Step 2: Sanity-check the covered set**

Run: `npx tsx scripts/import-arbox-purchases.ts --dry-run | grep -c covered_by_hand`
Expected: a count close to the number of live Arbox purchases of linked קריית אתא trainees (about 40).

- [ ] **Step 3: Show the output to the owner and stop**

Do not set `ARBOX_IMPORT_PURCHASES` and do not run the script without `--dry-run`. Open the PR with the dry-run summary in its description; enabling the flag is the owner's call after merge.
