import { Card, CardContent } from "@/components/ui/card";
import { PurchaseRequestButton } from "./PurchaseRequestButton";

/** For a trainee of a selling branch with no Plan: ask the parent to buy one. */
export function BuyPlanCard() {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h3 className="text-lg font-bold">המסלול שלי</h3>
          <p className="text-sm text-muted-foreground">אין לך מסלול פעיל. ההורה יקבל קישור לבחור מסלול ולשלם.</p>
        </div>
        <PurchaseRequestButton label="בקשה מההורה לקנות מסלול" primary />
      </CardContent>
    </Card>
  );
}
