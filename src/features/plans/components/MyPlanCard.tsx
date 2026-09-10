import Link from "next/link";
import { CalendarClock, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { shortDate } from "@/lib/utils/iso-date";
import type { PlanWithUsage } from "../lib/queries";
import { PlanStatusBadge } from "./PlanStatusBadge";

interface MyPlanCardProps {
  planWithUsage: PlanWithUsage;
  renewUrl: string;
}

/**
 * The trainee's plan at a glance. An expired plan turns the card into the
 * banner; nothing is blocked, the renewal button is the only change.
 */
export function MyPlanCard({ planWithUsage, renewUrl }: MyPlanCardProps) {
  const { plan, product, sessionsUsed, status } = planWithUsage;
  const expired = status === "expired";
  const sessionsLeft =
    plan.sessions_total === null ? null : Math.max(plan.sessions_total - sessionsUsed, 0);

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
                {sessionsUsed} מתוך {plan.sessions_total} אימונים נוצלו
              </span>
            )}
            <span className="flex items-center gap-1">
              <CalendarClock className="h-4 w-4" />
              {expired ? "הסתיים ב-" : "בתוקף עד "}
              {shortDate(plan.ends_on)}
            </span>
          </div>
          {expired && (
            <p className="text-sm text-destructive">המסלול הסתיים. אפשר לחדש אותו בלחיצה.</p>
          )}
        </div>
        {status !== "cancelled" && (
          <Button asChild variant={expired || status === "ending_soon" ? "default" : "outline"}>
            <Link href={renewUrl}>{expired ? "חידוש המסלול" : "חידוש מוקדם"}</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
