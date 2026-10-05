import { CalendarClock, Ticket } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { shortDate } from "@/lib/utils/iso-date";
import type { PlanQueueView } from "../lib/queries";
import { PlanStatusBadge } from "./PlanStatusBadge";
import { PurchaseRequestButton, REQUEST_LABELS } from "./PurchaseRequestButton";

interface MyPlanCardProps {
  planQueue: PlanQueueView;
  /** The parent can be sent the purchase link (canAskParentToBuy). */
  canAskParent: boolean;
}

/**
 * The trainee's plan at a glance. An expired plan turns the card into the
 * banner; nothing is blocked. Renewing sends the parent the purchase link.
 */
export function MyPlanCard({ planQueue, canAskParent }: MyPlanCardProps) {
  const { queue, product, sessionsLeft, status, endsOn } = planQueue;
  const expired = status === "expired";
  const next = queue.current ? queue.queued[0] : undefined;
  // Ended, cancelled or about to end: renewing is the next step.
  const over = expired || status === "cancelled";
  const urgent = over || status === "ending_soon";

  return (
    <Card className={cn(expired && "border-destructive/50 bg-destructive/5")}>
      <CardContent className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-bold">המסלול שלי</h3>
            <PlanStatusBadge status={status} />
          </div>
          <p className="font-medium">{product.name_he}</p>
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            {sessionsLeft !== null && (
              <span className="flex items-center gap-1">
                <Ticket className="h-4 w-4" />
                נותרו {sessionsLeft} אימונים
              </span>
            )}
            <span className="flex items-center gap-1">
              <CalendarClock className="h-4 w-4" />
              {expired ? "הסתיים ב-" : "בתוקף עד "}
              {shortDate(endsOn)}
            </span>
          </div>
          {next && (
            <p className="text-sm text-muted-foreground">
              {next.plan.product?.name_he ?? "המסלול הבא"} ממתין ויתחיל ב-{shortDate(next.startsOn)}
            </p>
          )}
          {expired && (
            <p className="text-sm text-destructive">
              {canAskParent ? "המסלול הסתיים. ההורה יקבל קישור לחידוש בלחיצה." : "המסלול הסתיים."}
            </p>
          )}
        </div>
        {canAskParent && (
          <PurchaseRequestButton label={over ? REQUEST_LABELS.renew : REQUEST_LABELS.renewEarly} primary={urgent} />
        )}
      </CardContent>
    </Card>
  );
}
