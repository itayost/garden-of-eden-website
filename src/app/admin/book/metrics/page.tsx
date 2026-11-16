import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MetricMapClient } from "@/features/development-book/components/admin/MetricMapClient";
import { loadMetricMapView } from "@/features/development-book/lib/queries/metric-map";
import { verifyAdmin } from "@/lib/actions/shared";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: "מיפוי מדדים | Garden of Eden",
};

export default async function AdminBookMetricsPage() {
  const { error } = await verifyAdmin();
  if (error) redirect("/admin/book");

  const { rows, parameters } = await loadMetricMapView(createAdminClient());

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Button asChild variant="ghost" size="sm" className="-ms-2">
          <Link href="/admin/book">
            <ArrowRight className="me-1 h-4 w-4" aria-hidden="true" />
            ספר פיתוח שחקן
          </Link>
        </Button>
        <div>
          <h1 className="mb-2 text-2xl font-bold sm:text-3xl">מיפוי מדדים לספר הפיתוח</h1>
          <p className="text-muted-foreground">
            לכל מדד במבדק: הפרמטרים בספר שמאמנים אותו. מכאן נבחרים התרגילים לדוח השבועי ולהצעות היעד.
          </p>
        </div>
      </div>

      <MetricMapClient rows={rows} parameters={parameters} />
    </div>
  );
}
