import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { typedFrom } from "@/lib/supabase/helpers";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { UserPlus } from "lucide-react";
import { LeadDataTable } from "@/components/admin/leads/LeadDataTable";
import { LeadStatsPanel } from "@/components/admin/leads/LeadStatsPanel";
import { LeadExportButton } from "@/components/admin/exports/LeadExportButton";
import type { Lead } from "@/types/leads";

export const metadata: Metadata = {
  title: "ניהול לידים | Garden of Eden",
};

interface PageProps {
  searchParams: Promise<{
    q?: string;
    status?: string;
    haifa?: string;
  }>;
}

export default async function AdminLeadsPage({ searchParams }: PageProps) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = (await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()) as { data: { role: string } | null };

  if (profile?.role !== "admin" && profile?.role !== "trainer") {
    redirect("/dashboard");
  }

  // Fetch all leads
  const { data: leads } = (await typedFrom(supabase, "leads")
    .select("*")
    .order("created_at", { ascending: false })) as { data: Lead[] | null };

  const typedLeads = (leads || []) as Lead[];
  const params = await searchParams;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">ניהול לידים</h1>
          <p className="text-muted-foreground">ניהול לידים ומעקב אחר פניות</p>
        </div>
        <LeadExportButton leads={typedLeads} />
      </div>

      <LeadStatsPanel leads={typedLeads} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            רשימת לידים ({typedLeads.length})
          </CardTitle>
          <CardDescription>כל הלידים במערכת</CardDescription>
        </CardHeader>
        <CardContent>
          <LeadDataTable
            data={typedLeads}
            initialSearch={params.q || ""}
            initialStatus={params.status || null}
            initialHaifa={params.haifa === "true"}
          />
        </CardContent>
      </Card>
    </div>
  );
}
