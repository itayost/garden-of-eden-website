"use client";

import { Badge } from "@/components/ui/badge";
import { LEAD_STATUS_LABELS, LEAD_STATUS_COLORS, type LeadStatus } from "@/types/leads";

interface LeadStatusBadgeProps {
  status: LeadStatus;
}

export function LeadStatusBadge({ status }: LeadStatusBadgeProps) {
  return (
    <Badge variant="secondary" className={LEAD_STATUS_COLORS[status]}>
      {LEAD_STATUS_LABELS[status]}
    </Badge>
  );
}
