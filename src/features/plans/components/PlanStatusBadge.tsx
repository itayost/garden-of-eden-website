import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PLAN_STATUS_BADGE_CLASS } from "@/lib/plans/status-styles";
import { PLAN_STATUS_LABELS_HE, type PlanStatus } from "@/types/plans";

export function PlanStatusBadge({ status, className }: { status: PlanStatus; className?: string }) {
  return <Badge className={cn(PLAN_STATUS_BADGE_CLASS[status], className)}>{PLAN_STATUS_LABELS_HE[status]}</Badge>;
}
