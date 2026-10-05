/**
 * What the nightly import does with each Arbox purchase. Pure: the same
 * inputs always give the same actions, so the dry run shows exactly what the
 * cron will write.
 *
 * Our system counts usage; Arbox only tells us a purchase happened. Every
 * purchase becomes its own Plan at the end of the Trainee's Plan queue
 * (ADR-0008): nothing is merged or extended. It carries Arbox's sessions and
 * keeps the end date Arbox gave it, so a Plan that waits in line has less
 * time. The queue resolver dates it; the start here is only a forecast.
 */
import type { ArboxPurchase } from "@/lib/arbox/purchase-rows";
import { daysBetween, shortDate } from "@/lib/utils/iso-date";
import type { PlanKind } from "@/types/plans";
import { placeNewPlan, type NewPlanTerms, type QueuePlan, type QueueRow } from "./plan-queue";

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

/** A stored Plan in the queue's shape, with what the skip rules need. */
export interface ImportPlanRow extends QueuePlan {
  readonly profileId: string;
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
  | "ends_before_start"
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

export interface CreatePlanAction {
  readonly type: "create";
  readonly purchase: ArboxPurchase;
  readonly profileId: string;
  /** A Plan ahead of it holds it past the day it could start. */
  readonly queued: boolean;
  /** Forecast to start after its own Arbox end: it would never run. */
  readonly neverRuns: boolean;
  readonly order: ImportOrderDraft;
  readonly plan: {
    readonly id: string;
    readonly productId: string;
    /** Sale-time term: the later of today and Arbox's start. */
    readonly notBefore: string;
    /** The queue's forecast start; the queue decides when it runs. */
    readonly startsOn: string;
    /** Sale-time term: Arbox's end date, which never moves. */
    readonly fixedEndsOn: string;
    readonly sessionsTotal: number | null;
    readonly note: string;
  };
}

export type ImportAction = CreatePlanAction;

export interface ImportSkip {
  readonly purchase: ArboxPurchase;
  readonly reason: ImportSkipReason;
  readonly profileId: string | null;
}

export interface PlanArboxImportsInput {
  readonly today: string;
  /** The branch the import sells in. */
  readonly branchId: string;
  readonly purchases: readonly ArboxPurchase[];
  readonly trainees: readonly ImportTrainee[];
  readonly plans: readonly ImportPlanRow[];
  /** Each Trainee's roster rows, which the queue charges to Plans. */
  readonly rows: ReadonlyMap<string, readonly QueueRow[]>;
  readonly importedKeys: ReadonlySet<string>;
  readonly products: ImportProducts;
}

const laterOf = (a: string, b: string): string => (a > b ? a : b);

const isArboxPaid = (p: ImportPlanRow): boolean => p.orderPaymentMethod === "arbox";

const isHandEnteredArbox = (p: ImportPlanRow): boolean =>
  isArboxPaid(p) && p.orderProviderTransactionId === null;

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
  if (p.startDate > p.endDate) return "ends_before_start";
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

function planOne(p: ArboxPurchase, trainee: ImportTrainee, plans: readonly ImportPlanRow[], input: PlanArboxImportsInput): Planned {
  const { today } = input;
  const product = productFor(p, input.products);
  const order = orderDraft(p, trainee, product.id);
  const notBefore = laterOf(today, p.startDate);
  const fixedEndsOn = p.endDate as string;
  const terms: NewPlanTerms = {
    kind: product.kind,
    branchId: input.branchId,
    sessionsTotal: p.kind === "card" ? p.sessionsLeft : null,
    durationDays: daysBetween(notBefore, fixedEndsOn) + 1,
    notBefore,
    fixedEndsOn,
  };
  const { startsOn } = placeNewPlan(plans, input.rows.get(trainee.profileId) ?? [], terms, today);
  const id = newPlanId(order.key);

  const action: CreatePlanAction = {
    type: "create",
    purchase: p,
    profileId: trainee.profileId,
    queued: startsOn > notBefore,
    neverRuns: startsOn > fixedEndsOn,
    order,
    plan: {
      id,
      productId: product.id,
      notBefore,
      startsOn,
      fixedEndsOn,
      sessionsTotal: terms.sessionsTotal,
      note: `Arbox import ${p.itemName} ${p.purchaseDate} (${p.membershipUserId})`,
    },
  };
  // Later purchases in the same run queue behind this one: it sorts after
  // every stored Plan, in the order the run creates them, and before the
  // Plan placeNewPlan is placing.
  const created: ImportPlanRow = {
    ...terms,
    id,
    status: "active",
    createdAt: `\ufffe${String(plans.length).padStart(4, "0")}`,
    profileId: trainee.profileId,
    createdOn: today,
    orderPaymentMethod: "arbox",
    orderProviderTransactionId: order.key,
  };
  return { action, plans: [...plans, created] };
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
