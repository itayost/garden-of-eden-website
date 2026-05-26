"use server";

import { createClient } from "@/lib/supabase/server";
import { typedFrom } from "@/lib/supabase/helpers";
import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { isValidUUID } from "@/lib/validations/common";
import {
  LEAD_SELECT_WITH_RELATIONS,
  LEAD_STATUSES,
  type Lead,
  type LeadContactLog,
  type LeadFlowResponse,
  type LeadSentMessage,
  type LeadStatus,
} from "@/types/leads";

type ActionResult<T> =
  | { success: true; data: T }
  | { error: string };

interface LeadsFilters {
  search?: string;
  status?: string;
  isFromHaifa?: boolean;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
  tabId?: string;
  assignedTrainerId?: string | null;
}

interface LeadDetail {
  lead: Lead;
  contactLog: LeadContactLog[];
  sentMessages: LeadSentMessage[];
  flowResponses: LeadFlowResponse[];
}

interface LeadsStats {
  total: number;
  byStatus: Record<LeadStatus, number>;
  newThisWeek: number;
  conversionRate: number;
}

/**
 * Fetch paginated leads with optional filters
 */
export async function getLeadsAction(
  filters: LeadsFilters = {}
): Promise<ActionResult<{ items: Lead[]; total: number }>> {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  const supabase = await createClient();
  const {
    search,
    status,
    isFromHaifa,
    startDate,
    endDate,
    page = 1,
    pageSize = 20,
    tabId,
    assignedTrainerId,
  } = filters;
  const from = (page - 1) * pageSize;

  let query = typedFrom(supabase, "leads").select(LEAD_SELECT_WITH_RELATIONS, { count: "exact" });

  if (search) {
    // Sanitize search input: escape PostgREST special chars to prevent filter injection
    const sanitized = search.replace(/[%_\\()"',.*]/g, "");
    if (sanitized) {
      query = query.or(`name.ilike.%${sanitized}%,phone.ilike.%${sanitized}%`);
    }
  }
  if (status) query = query.eq("status", status);
  if (isFromHaifa) query = query.eq("is_from_haifa", true);
  if (tabId) query = query.eq("tab_id", tabId);
  if (assignedTrainerId === null) {
    query = query.is("assigned_trainer_id", null);
  } else if (assignedTrainerId) {
    query = query.eq("assigned_trainer_id", assignedTrainerId);
  }
  if (startDate) query = query.gte("created_at", startDate);
  if (endDate) query = query.lte("created_at", endDate + "T23:59:59");

  query = query.order("created_at", { ascending: false }).range(from, from + pageSize - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error("Get leads error:", error);
    return { error: "שגיאה בטעינת לידים" };
  }

  return { success: true, data: { items: (data as Lead[]) || [], total: count ?? 0 } };
}

/**
 * Fetch a single lead with all related data
 */
export async function getLeadByIdAction(id: string): Promise<ActionResult<LeadDetail>> {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  if (!isValidUUID(id)) return { error: "מזהה לא תקין" };

  const supabase = await createClient();

  const [leadRes, contactRes, messagesRes, flowRes] = await Promise.all([
    typedFrom(supabase, "leads").select(LEAD_SELECT_WITH_RELATIONS).eq("id", id).single(),
    typedFrom(supabase, "lead_contact_log")
      .select("*")
      .eq("lead_id", id)
      .order("created_at", { ascending: false }),
    typedFrom(supabase, "lead_sent_messages")
      .select("*")
      .eq("lead_id", id)
      .order("sent_at", { ascending: false }),
    typedFrom(supabase, "lead_flow_responses")
      .select("*")
      .eq("lead_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (leadRes.error) {
    console.error("Get lead error:", leadRes.error);
    return { error: "ליד לא נמצא" };
  }

  return {
    success: true,
    data: {
      lead: leadRes.data as Lead,
      contactLog: (contactRes.data as LeadContactLog[]) || [],
      sentMessages: (messagesRes.data as LeadSentMessage[]) || [],
      flowResponses: (flowRes.data as LeadFlowResponse[]) || [],
    },
  };
}

/**
 * Get aggregated leads statistics, optionally scoped by tab.
 */
export async function getLeadsStatsAction(
  filters: { tabId?: string } = {}
): Promise<ActionResult<LeadsStats>> {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  const supabase = await createClient();
  const { tabId } = filters;

  // Calculate start of current week (Sunday)
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - dayOfWeek);
  weekStart.setHours(0, 0, 0, 0);

  const baseQuery = () => {
    const q = typedFrom(supabase, "leads").select("*", { count: "exact", head: true });
    return tabId ? q.eq("tab_id", tabId) : q;
  };

  const [totalRes, weekRes, ...statusResults] = await Promise.all([
    baseQuery(),
    baseQuery().gte("created_at", weekStart.toISOString()),
    ...LEAD_STATUSES.map((s) => baseQuery().eq("status", s)),
  ]);

  const total = totalRes.count ?? 0;
  const newThisWeek = weekRes.count ?? 0;

  const byStatus = Object.fromEntries(
    LEAD_STATUSES.map((s, i) => [s, statusResults[i].count ?? 0])
  ) as Record<LeadStatus, number>;

  const conversionRate = total > 0 ? Math.round((byStatus.closed / total) * 10000) / 100 : 0;

  return {
    success: true,
    data: { total, byStatus, newThisWeek, conversionRate },
  };
}
