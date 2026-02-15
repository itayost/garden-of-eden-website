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
  onStatusFilter?: (status: LeadStatus | null) => void;
  activeStatus?: string | null;
}

const STATUS_ORDER: LeadStatus[] = [
  "new",
  "callback",
  "in_progress",
  "closed",
  "disqualified",
];

export function LeadStatsPanel({
  leads,
  onStatusFilter,
  activeStatus,
}: LeadStatsPanelProps) {
  const total = leads.length;

  const byStatus: Record<LeadStatus, number> = {
    new: 0,
    callback: 0,
    in_progress: 0,
    closed: 0,
    disqualified: 0,
  };

  let totalRevenue = 0;

  for (const lead of leads) {
    byStatus[lead.status]++;
    if (lead.total_payment) {
      totalRevenue += lead.total_payment;
    }
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

  const handleStatusClick = (status: LeadStatus) => {
    if (!onStatusFilter) return;
    onStatusFilter(activeStatus === status ? null : status);
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      {/* Summary stats */}
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">סה״כ לידים</p>
          <p className="text-2xl font-bold mt-1">{total}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">חדשים השבוע</p>
          <p className="text-2xl font-bold mt-1">{newThisWeek}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">אחוז המרה</p>
          <p className="text-2xl font-bold mt-1">{conversionRate}%</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">הכנסות</p>
          <p className="text-2xl font-bold mt-1 text-green-700">
            {totalRevenue.toLocaleString()}₪
          </p>
        </CardContent>
      </Card>

      {/* Status cards — clickable */}
      {STATUS_ORDER.map((status) => {
        const isActive = activeStatus === status;
        return (
          <Card
            key={status}
            className={`cursor-pointer transition-all ${isActive ? "ring-2 ring-primary" : "hover:shadow-md"}`}
            onClick={() => handleStatusClick(status)}
          >
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">
                {LEAD_STATUS_LABELS[status]}
              </p>
              <p className="text-2xl font-bold mt-1">{byStatus[status]}</p>
              <div
                className={`h-1 w-8 rounded-full mt-2 ${LEAD_STATUS_COLORS[status].split(" ")[0]}`}
              />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
