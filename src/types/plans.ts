/**
 * קריית אתא signup: catalog, orders, plans, agreements.
 * None of these tables are in the generated Supabase types; reads go through
 * typedFrom() and these interfaces are the source of truth.
 */

export type PlanKind = "subscription" | "session_card" | "term" | "addon";

export interface PlanProduct {
  id: string;
  branch_id: string;
  slug: string;
  name_he: string;
  blurb_he: string | null;
  kind: PlanKind;
  price_ils: number;
  sessions_total: number | null;
  duration_days: number;
  once_per_trainee: boolean;
  gift_he: string | null;
  is_active: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
}

/** charging: the card is at the acquirer; a second submit finds nothing to claim. */
/**
 * How the money arrived. card = the site's own card page; arbox = paid in
 * Arbox, recorded here only to create the plan; the rest are taken by staff.
 */
export type PaymentMethod = "cash" | "transfer" | "bit" | "card" | "arbox";

export const PAYMENT_METHOD_LABELS_HE: Record<PaymentMethod, string> = {
  cash: "מזומן",
  transfer: "העברה בנקאית",
  bit: "ביט",
  card: "כרטיס אשראי",
  arbox: "Arbox",
};

/** voided: the sale was undone (Void); refunded: money went back after a Cancellation. */
export type OrderStatus = "pending" | "charging" | "paid" | "failed" | "expired" | "voided" | "refunded";

export interface Order {
  id: string;
  product_id: string;
  branch_id: string;
  status: OrderStatus;
  amount_ils: number;
  currency: string;
  parent_name: string;
  payer_phone: string;
  login_phone: string;
  child_name: string;
  /** ISO YYYY-MM-DD; null for a staff signup until the parent signs. */
  child_birthdate: string | null;
  email: string | null;
  profile_id: string | null;
  renewal_of_plan_id: string | null;
  morning_payment_url: string | null;
  morning_transaction_id: string | null;
  morning_document_id: string | null;
  morning_document_url: string | null;
  raw_webhook: unknown | null;
  /** Who charged the card. Morning for the hosted page, isracard for the site's own page (through the Pelecard gateway). */
  payment_provider: "morning" | "isracard" | "manual";
  provider_transaction_id: string | null;
  approval_number: string | null;
  card_brand: string | null;
  card_last4: string | null;
  installments: number;
  provider_response: unknown | null;
  payment_method: PaymentMethod | null;
  /** אסמכתא for transfers and Bit. */
  reference: string | null;
  /** The staff member who took a manual payment. */
  received_by: string | null;
  /** The list price of a discounted sale; null when sold at list price (amount_ils is what was paid). */
  list_price_ils: number | null;
  discount_reason: string | null;
  discounted_by: string | null;
  paid_at: string | null;
  fulfilled_at: string | null;
  fulfillment_error: string | null;
  created_at: string;
  updated_at: string;
}

/** voided: recorded by mistake and undone, as if never sold. */
export type PlanRowStatus = "active" | "cancelled" | "voided";
export type PlanSource = "online" | "manual";

export interface TraineePlan {
  id: string;
  profile_id: string;
  product_id: string;
  branch_id: string;
  order_id: string | null;
  /**
   * A cached copy of the dates the Plan queue gave the Plan when it was
   * written. The queue (src/lib/plans/plan-queue.ts) is the authority.
   */
  starts_on: string;
  ends_on: string;
  /** Sale-time terms: sessions on a Card, copied at sale. */
  sessions_total: number | null;
  /** Sale-time terms: the earliest day the Plan may start. Null on Plans older than the queue. */
  not_before: string | null;
  /** Sale-time terms: days the Plan runs once it starts. Null on Plans older than the queue. */
  duration_days: number | null;
  /** Sale-time terms: the end date of an Arbox purchase, which never moves. */
  fixed_ends_on: string | null;
  /** The day a Cancellation ended the Plan; it keeps its place in the queue up to it. */
  ended_on: string | null;
  status: PlanRowStatus;
  source: PlanSource;
  note: string | null;
  reminded_3_days_at: string | null;
  reminded_last_session_at: string | null;
  reminded_expired_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Derived, never stored. */
export type PlanStatus = "active" | "ending_soon" | "expired" | "cancelled";

/** What a roster chip or the users list needs to know about one trainee. */
export interface StaffPlanBadge {
  status: PlanStatus;
  sessionsLeft: number | null;
  /** Empty when the trainee has no plan and only carries medical notes. */
  endsOn: string;
  hasMedicalNotes: boolean;
}

export const PLAN_STATUS_LABELS_HE: Record<PlanStatus, string> = {
  active: "פעיל",
  ending_soon: "מסתיים בקרוב",
  expired: "פג תוקף",
  cancelled: "בוטל",
};

export interface EnrollmentAgreement {
  id: string;
  order_id: string | null;
  profile_id: string | null;
  agreement_version: string;
  parent_name: string;
  parent_id_number: string;
  parent_phone: string;
  parent_email: string | null;
  child_name: string;
  /** Null until the parent signs a staff-created agreement. */
  child_birthdate: string | null;
  medical_notes: string | null;
  plan_name: string;
  plan_price_ils: number;
  plan_start_on: string;
  payment_method: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  declares_healthy: boolean;
  accepts_terms: boolean;
  authorizes_payment: boolean;
  photo_consent: boolean;
  signature_name: string;
  /** Null while the parent has not signed yet. */
  signed_at: string | null;
  sign_reminded_at: string | null;
  signed_ip: string | null;
  created_at: string;
}

export interface MorningWebhookEvent {
  delivery_id: string;
  topic: string;
  payload: unknown;
  order_id: string | null;
  received_at: string;
  processed_at: string | null;
  error: string | null;
}
