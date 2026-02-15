"use client";

import { Card, CardContent } from "@/components/ui/card";
import {
  LEAD_STATUS_LABELS,
  LEAD_STATUS_COLORS,
  type Lead,
  type LeadStatus,
} from "@/types/leads";

interface LeadStatsPanelProps {
  leads: Lead[];
}

export function LeadStatsPanel({ leads }: LeadStatsPanelProps) {
  const total = leads.length;

  const byStatus: Record<LeadStatus, number> = {
    new: 0,
    callback: 0,
    in_progress: 0,
    closed: 0,
    disqualified: 0,
  };

  for (const lead of leads) {
    byStatus[lead.status]++;
  }

  // New this week (week starts Sunday, Israeli locale)
  const now = new Date();
  const dayOfWeek = now.getDay();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - dayOfWeek);
  weekStart.setHours(0, 0, 0, 0);

  const newThisWeek = leads.filter(
    (l) => new Date(l.created_at) >= weekStart
  ).length;

  const conversionRate =
    total > 0 ? Math.round((byStatus.closed / total) * 10000) / 100 : 0;

  const stats: { label: string; value: number | string; colorClass?: string }[] = [
    { label: "סה״כ לידים", value: total },
    { label: "חדשים השבוע", value: newThisWeek },
    { label: "אחוז המרה", value: `${conversionRate}%` },
    ...([
      "new",
      "callback",
      "in_progress",
      "closed",
      "disqualified",
    ] as LeadStatus[]).map((status) => ({
      label: LEAD_STATUS_LABELS[status],
      value: byStatus[status],
      colorClass: LEAD_STATUS_COLORS[status],
    })),
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <Card key={stat.label}>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{stat.label}</p>
            <p className="text-2xl font-bold mt-1">{stat.value}</p>
            {stat.colorClass && (
              <div
                className={`h-1 w-8 rounded-full mt-2 ${stat.colorClass.split(" ")[0]}`}
              />
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
