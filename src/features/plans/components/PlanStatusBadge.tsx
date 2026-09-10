import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PLAN_STATUS_LABELS_HE, type PlanStatus } from "@/types/plans";

const STYLES: Record<PlanStatus, string> = {
  active: "bg-green-600 text-white hover:bg-green-600",
  ending_soon: "bg-amber-500 text-black hover:bg-amber-500",
  expired: "bg-destructive text-white hover:bg-destructive",
  cancelled: "bg-muted text-muted-foreground hover:bg-muted",
};

export function PlanStatusBadge({ status, className }: { status: PlanStatus; className?: string }) {
  return <Badge className={cn(STYLES[status], className)}>{PLAN_STATUS_LABELS_HE[status]}</Badge>;
}
