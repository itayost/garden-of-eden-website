/**
 * What the nightly import does with each Arbox purchase. Pure: the same
 * inputs always give the same actions, so the dry run shows exactly what the
 * cron will write.
 *
 * Our system counts usage; Arbox only tells us a purchase happened. A
 * purchase merges into a live plan of the same kind that is itself paid in
 * Arbox, or starts after whatever is live, because two overlapping plans of
 * one kind double-count sessions (only one of them was counted) and a
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
  /** Roster sessions counted against the plan so far (countSessionsUsedFromRows). */
  readonly sessionsUsed: number;
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

/**
 * A card with no sessions left is not running, even inside its dates, so a new
 * purchase starts now rather than after it (fulfillment does the same).
 */
const isUsedUpCard = (p: ImportPlanRow): boolean =>
  p.productKind === "session_card" && p.sessionsTotal !== null && p.sessionsUsed >= p.sessionsTotal;

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
  const latestEnd = live
    .filter((pl) => !isUsedUpCard(pl))
    .reduce<string | null>((acc, pl) => (acc === null || pl.endsOn > acc ? pl.endsOn : acc), null);
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
    sessionsUsed: 0,
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
