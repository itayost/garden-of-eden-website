import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { statusLabel } from "../../lib/queue-view";

/**
 * Held is the loud one (it needs a person), pending reads as information,
 * approved and sent are success, and a week that closed unsent is muted.
 */
const STATUS_STYLE: Readonly<Record<string, string>> = {
  held: "border-transparent bg-warning/20 text-warning-emphasis",
  pending: "border-transparent bg-info/15 text-info",
  approved: "border-transparent bg-success/15 text-success",
  sent: "border-transparent bg-success text-success-foreground",
  not_sent: "border-transparent bg-muted text-muted-foreground",
  listed: "border-transparent bg-muted text-muted-foreground",
};

export function StatusChip({ status, className }: { status: string; className?: string }) {
  return (
    <Badge variant="outline" className={cn(STATUS_STYLE[status], className)}>
      {statusLabel(status)}
    </Badge>
  );
}
