import { Badge } from "@/components/ui/badge";
import type { AssessmentMonthStatus } from "@/types/assessment";

interface AssessmentStatusBadgeProps {
  status: AssessmentMonthStatus;
}

const STATUS_CONFIG = {
  full: {
    label: "מלא",
    variant: "default" as const,
    className: "",
  },
  partial: {
    label: "חלקי",
    variant: "secondary" as const,
    className: "bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-100",
  },
  none: {
    label: "חסר",
    variant: "secondary" as const,
    className: "",
  },
};

export function AssessmentStatusBadge({ status }: AssessmentStatusBadgeProps) {
  const { label, variant, className } = STATUS_CONFIG[status];
  return (
    <Badge variant={variant} className={className}>
      {label}
    </Badge>
  );
}
