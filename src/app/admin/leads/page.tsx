import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { typedFrom } from "@/lib/supabase/helpers";
import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { UserPlus } from "lucide-react";
import { LeadDataTable } from "@/components/admin/leads/LeadDataTable";
import { LeadExportButton } from "@/components/admin/exports/LeadExportButton";
import { LeadsTabs } from "@/components/admin/leads/LeadsTabs";
import { listTrainersForAssignmentAction } from "@/lib/actions/admin-trainers-list";
import {
  LEAD_SELECT_WITH_TRAINER,
  LEAD_SOURCE_LABELS,
  type Lead,
  type LeadSource,
} from "@/types/leads";

/**
 * Cap on rows loaded for the active tab. Today's volume (~500) fits easily;
 * keep an explicit ceiling so Supabase's default cap can't silently truncate
 * as the table grows. Switch to server-paginated getLeadsAction if exceeded.
 */
const LEADS_PAGE_LIMIT = 2000;

export const metadata: Metadata = {
  title: "ניהול לידים | Garden of Eden",
};

interface PageProps {
  searchParams: Promise<{
    q?: string;
    status?: string;
    haifa?: string;
    source?: string;
    at?: string;
  }>;
}

function parseSource(value: string | undefined): LeadSource {
  return value === "organic" ? "organic" : "paid";
}

export default async function AdminLeadsPage({ searchParams }: PageProps) {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) redirect("/login");

  const supabase = await createClient();

  const params = await searchParams;
  const source: LeadSource = parseSource(params.source);
  const otherSource: LeadSource = source === "paid" ? "organic" : "paid";

  // Fetch leads for the active tab (+ count for the inactive tab)
  // and the trainers list for the assignment dropdown.
  const [activeRes, otherCountRes, trainersRes] = await Promise.all([
    typedFrom(supabase, "leads")
      .select(LEAD_SELECT_WITH_TRAINER)
      .eq("source", source)
      .order("created_at", { ascending: false })
      .limit(LEADS_PAGE_LIMIT),
    typedFrom(supabase, "leads")
      .select("id", { count: "exact", head: true })
      .eq("source", otherSource),
    listTrainersForAssignmentAction(),
  ]);

  const typedLeads: Lead[] = (activeRes.data as Lead[] | null) || [];
  const counts: Partial<Record<LeadSource, number>> = {
    [source]: typedLeads.length,
    [otherSource]: otherCountRes.count ?? 0,
  };
  const trainers =
    "data" in trainersRes && trainersRes.data ? trainersRes.data : [];

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">ניהול לידים</h1>
          <p className="text-muted-foreground">ניהול לידים ומעקב אחר פניות</p>
        </div>
        <LeadExportButton leads={typedLeads} />
      </div>

      <LeadsTabs current={source} counts={counts} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            {LEAD_SOURCE_LABELS[source]} ({typedLeads.length})
          </CardTitle>
          <CardDescription>
            {source === "paid"
              ? "לידים שהגיעו מקמפיינים ממומנים ודפי נחיתה"
              : "לידים אורגניים — הוספה ידנית והפניות"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LeadDataTable
            data={typedLeads}
            source={source}
            trainers={trainers}
            initialSearch={params.q || ""}
            initialStatus={params.status || null}
            initialHaifa={params.haifa === "true"}
            initialAssignedTrainerId={params.at || null}
          />
        </CardContent>
      </Card>
    </div>
  );
}
