import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { verifyAdmin } from "@/lib/actions/shared";
import {
  listOrdersAction,
  listUnassignedWebhookEventsAction,
} from "@/features/plans/lib/actions/admin-orders";
import { OrdersTable } from "@/features/plans/components/admin/OrdersTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils/date";

export const metadata: Metadata = { title: "הזמנות | Garden of Eden" };

export default async function AdminOrdersPage() {
  const { error } = await verifyAdmin();
  if (error) redirect("/admin");
  const [orders, unassigned] = await Promise.all([
    listOrdersAction(),
    listUnassignedWebhookEventsAction(),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">הזמנות</h1>
        <p className="text-muted-foreground">
          כל ניסיונות הרכישה בעמוד ההרשמה, כולל כאלה שלא הושלמו
        </p>
      </div>
      {unassigned.length > 0 && (
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-base">
              התראות מ-Morning שלא שויכו ({unassigned.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {unassigned.map((event) => (
              <div key={event.delivery_id} className="flex justify-between gap-4">
                <span>
                  {event.topic} · {event.error}
                </span>
                <span className="text-muted-foreground">{formatDateTime(event.received_at)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      <OrdersTable rows={orders} />
    </div>
  );
}
