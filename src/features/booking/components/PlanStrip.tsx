import { CalendarClock, Ticket } from "lucide-react";
import { shortDate } from "@/lib/utils/iso-date";
import { BOOKING_BLOCK_LABELS_HE } from "@/lib/schedule/booking-rules";
import { PlanStatusBadge } from "@/features/plans/components/PlanStatusBadge";
import { PurchaseRequestButton } from "@/features/plans/components/PurchaseRequestButton";
import type { TraineeScheduleView } from "../lib/actions/schedule";

/** The plan at the top of the schedule: what is left, and the way out when it blocks. */
export function PlanStrip({ plan, block, canAskParent }: Pick<TraineeScheduleView, "plan" | "block" | "canAskParent">) {
  if (!plan) {
    return (
      <div className="rounded-2xl border border-dashed p-4 text-sm">
        <p className="font-medium">{BOOKING_BLOCK_LABELS_HE.no_plan}</p>
        {canAskParent && (
          <div className="mt-3">
            <PurchaseRequestButton label="בקשה מההורה לקנות מסלול" primary />
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="space-y-2 rounded-2xl border bg-white p-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-bold">{plan.name}</span>
        <PlanStatusBadge status={plan.status} />
      </div>
      <div className="flex flex-wrap gap-4 text-muted-foreground">
        {plan.sessionsLeft !== null && (
          <span className="flex items-center gap-1">
            <Ticket className="h-4 w-4" />
            נותרו {plan.sessionsLeft} אימונים
          </span>
        )}
        {plan.weeklyCap !== null && (
          <span className="flex items-center gap-1">
            <CalendarClock className="h-4 w-4" />
            {plan.weekCount} מתוך {plan.weeklyCap} השבוע
          </span>
        )}
        <span>בתוקף עד {shortDate(plan.endsOn)}</span>
      </div>
      {block && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-destructive/5 p-3 text-destructive">
          <span>{BOOKING_BLOCK_LABELS_HE[block]}</span>
          {plan.canRenew && canAskParent && <PurchaseRequestButton label="בקשה מההורה לחדש" primary />}
        </div>
      )}
    </div>
  );
}
