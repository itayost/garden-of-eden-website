/**
 * Leads CRM types
 *
 * Leads are potential customers — NOT auth users.
 * Phone stored as 972xxxxxxxxx (no + prefix) to match WhatsApp API format.
 */

// =============================================================================
// Enum union types
// =============================================================================

export type LeadStatus = "new" | "callback" | "in_progress" | "closed" | "disqualified";
export type LeadContactType = "call" | "whatsapp" | "meeting" | "message_sent";
export type LeadContactOutcome = "interested" | "not_interested" | "callback" | "no_answer";
export type LeadMessageType = "template" | "flow" | "text";

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
