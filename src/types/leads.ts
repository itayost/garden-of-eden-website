/**
 * Leads CRM types
 *
 * Leads are potential customers — NOT auth users.
 * Phone stored as 972xxxxxxxxx (no + prefix) to match WhatsApp API format.
 */

import type { LeadTab } from "./lead-tabs";
export type { LeadTab } from "./lead-tabs";

// =============================================================================
// Enum tuples (single source of truth for runtime + types)
// =============================================================================

export const LEAD_STATUSES = [
  "new",
  "callback",
  "in_progress",
  "closed",
  "disqualified",
] as const;
export const LEAD_CONTACT_TYPES = ["call", "whatsapp", "meeting", "message_sent"] as const;
export const LEAD_CONTACT_OUTCOMES = [
  "interested",
  "not_interested",
  "callback",
  "no_answer",
] as const;
export const LEAD_MESSAGE_TYPES = ["template", "flow", "text"] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];
export type LeadContactType = (typeof LEAD_CONTACT_TYPES)[number];
export type LeadContactOutcome = (typeof LEAD_CONTACT_OUTCOMES)[number];
export type LeadMessageType = (typeof LEAD_MESSAGE_TYPES)[number];

// =============================================================================
// Shared constants
// =============================================================================

/** PostgREST select string for a lead with its assigned trainer and tab joined. */
export const LEAD_SELECT_WITH_RELATIONS =
  "*, assigned_trainer:profiles!leads_assigned_trainer_id_fkey(id, full_name), tab:lead_tabs!leads_tab_id_fkey(id, slug, name, color, position, is_default, created_at, updated_at)";

/** Sentinel value for the "unassigned" option in trainer pickers and filters. */
export const LEAD_UNASSIGNED_VALUE = "__unassigned__";

/** Whether a value matches the WhatsApp-formatted Israeli phone shape (972XXXXXXXXX). */
export const LEAD_PHONE_REGEX = /^972\d{9}$/;
export function isLeadPhone(value: string): boolean {
  return LEAD_PHONE_REGEX.test(value);
}

// =============================================================================
// Table interfaces
// =============================================================================

export interface Lead {
  id: string;
  phone: string;
  name: string;
  is_from_haifa: boolean;
  status: LeadStatus;
  note: string | null;
  payment: number | null;
  months: number | null;
  total_payment: number | null;
  flow_age_group: string | null;
  flow_team: string | null;
  flow_frequency: string | null;
  club: string | null;
  birth_year: number | null;
  additional_info: string | null;
  assigned_trainer_id: string | null;
  assigned_trainer?: { id: string; full_name: string | null } | null;
  tab_id: string;
  tab?: LeadTab | null;
  created_at: string;
  updated_at: string;
}

export interface LeadSentMessage {
  id: string;
  lead_id: string;
  message_id: string | null;
  message_type: LeadMessageType;
  campaign: string | null;
  sent_at: string;
}

export interface LeadFlowResponse {
  id: string;
  lead_id: string;
  flow_token: string | null;
  screen: string | null;
  data: Record<string, unknown> | null;
  is_complete: boolean;
  created_at: string;
}

export interface LeadContactLog {
  id: string;
  lead_id: string;
  contact_type: LeadContactType;
  rep: string | null;
  notes: string | null;
  outcome: LeadContactOutcome | null;
  created_at: string;
}

// =============================================================================
// Hebrew label maps
// =============================================================================

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "חדש",
  callback: "חזרה",
  in_progress: "בטיפול",
  closed: "סגור",
  disqualified: "לא רלוונטי",
};

export const LEAD_CONTACT_TYPE_LABELS: Record<LeadContactType, string> = {
  call: "שיחה",
  whatsapp: "וואטסאפ",
  meeting: "פגישה",
  message_sent: "הודעה נשלחה",
};

export const LEAD_OUTCOME_LABELS: Record<LeadContactOutcome, string> = {
  interested: "מעוניין",
  not_interested: "לא מעוניין",
  callback: "חזרה",
  no_answer: "לא ענה",
};

export const LEAD_MESSAGE_TYPE_LABELS: Record<LeadMessageType, string> = {
  template: "תבנית",
  flow: "פלואו",
  text: "טקסט",
};

// =============================================================================
// Status colors for badges
// =============================================================================

export const LEAD_STATUS_COLORS: Record<LeadStatus, string> = {
  new: "bg-blue-100 text-blue-800",
  callback: "bg-orange-100 text-orange-800",
  in_progress: "bg-yellow-100 text-yellow-800",
  closed: "bg-green-100 text-green-800",
  disqualified: "bg-red-100 text-red-800",
};
