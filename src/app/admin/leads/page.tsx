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
import { listLeadTabsAction } from "@/lib/actions/admin-lead-tabs";
import {
  LEAD_SELECT_WITH_RELATIONS,
  type Lead,
} from "@/types/leads";
import type { LeadTab } from "@/types/lead-tabs";

export const metadata: Metadata = {
  title: "ניהול לידים | Garden of Eden",
};

interface PageProps {
  searchParams: Promise<{
    q?: string;
    status?: string;
    haifa?: string;
    tab?: string;
    source?: string;
    at?: string;
  }>;
}

const LEADS_PAGE_LIMIT = 2000;

function resolveActiveTab(
  tabs: LeadTab[],
  tabParam: string | undefined,
  sourceParam: string | undefined,
): LeadTab {
  const requested =
    tabParam?.toLowerCase().trim() ?? sourceParam?.toLowerCase().trim() ?? null;
  if (requested) {
    const match = tabs.find((t) => t.slug === requested);
    if (match) return match;
  }
  return tabs.find((t) => t.is_default) ?? tabs[0];
}

export default async function AdminLeadsPage({ searchParams }: PageProps) {
  const { error: authError, profile } = await verifyAdminOrTrainer();
  if (authError || !profile) redirect("/login");

  const supabase = await createClient();
  const params = await searchParams;

  const [tabsRes, trainersRes] = await Promise.all([
    listLeadTabsAction(),
    listTrainersForAssignmentAction(),
  ]);

  if ("error" in tabsRes) redirect("/dashboard");
  const tabs = tabsRes.data;
  if (tabs.length === 0) redirect("/dashboard");

  const activeTab = resolveActiveTab(tabs, params.tab, params.source);

  const [activeRes, countRows] = await Promise.all([
    typedFrom(supabase, "leads")
      .select(LEAD_SELECT_WITH_RELATIONS)
      .eq("tab_id", activeTab.id)
      .order("created_at", { ascending: false })
      .limit(LEADS_PAGE_LIMIT),
    typedFrom(supabase, "leads")
      .select("tab_id")
      .in(
        "tab_id",
        tabs.map((t) => t.id),
      ),
  ]);

  const typedLeads: Lead[] = (activeRes.data as Lead[] | null) || [];

  const counts: Record<string, number> = {};
  for (const t of tabs) counts[t.slug] = 0;
  for (const row of (countRows.data as { tab_id: string }[] | null) ?? []) {
    const tab = tabs.find((t) => t.id === row.tab_id);
    if (tab) counts[tab.slug] = (counts[tab.slug] ?? 0) + 1;
  }

  const trainers =
    "data" in trainersRes && trainersRes.data ? trainersRes.data : [];
  const canManage = profile.role === "admin";

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">ניהול לידים</h1>
          <p className="text-muted-foreground">ניהול לידים ומעקב אחר פניות</p>
        </div>
        <LeadExportButton leads={typedLeads} />
      </div>

      <LeadsTabs
        tabs={tabs}
        activeSlug={activeTab.slug}
        counts={counts}
        canManage={canManage}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            {activeTab.name} ({typedLeads.length})
          </CardTitle>
          <CardDescription>
            {activeTab.is_default
              ? "טאב ברירת המחדל — לידים חדשים מגיעים לכאן"
              : "טאב מותאם של לידים"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LeadDataTable
            data={typedLeads}
            activeTab={activeTab}
            tabs={tabs}
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
