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

export type OrderStatus = "pending" | "paid" | "failed" | "expired";

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
  /** ISO YYYY-MM-DD. */
  child_birthdate: string;
  email: string | null;
  profile_id: string | null;
  renewal_of_plan_id: string | null;
  morning_payment_url: string | null;
  morning_transaction_id: string | null;
  morning_document_id: string | null;
  morning_document_url: string | null;
  raw_webhook: unknown | null;
  paid_at: string | null;
  fulfilled_at: string | null;
  fulfillment_error: string | null;
  created_at: string;
  updated_at: string;
}

export type PlanRowStatus = "active" | "cancelled";
export type PlanSource = "online" | "manual";

export interface TraineePlan {
  id: string;
  profile_id: string;
  product_id: string;
  branch_id: string;
  order_id: string | null;
  starts_on: string;
  ends_on: string;
  sessions_total: number | null;
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
  child_birthdate: string;
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
  signed_at: string;
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
