import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getBranchScopeAction, verifyAdminOrTrainer } from "@/lib/actions/shared";
import {
  listOrdersAction,
  listUnassignedWebhookEventsAction,
  type AdminOrderRow,
} from "@/features/plans/lib/actions/admin-orders";
import { OrdersTable } from "@/features/plans/components/admin/OrdersTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils/date";

export const metadata: Metadata = { title: "הזמנות | Garden of Eden" };

export default async function AdminOrdersPage() {
  // Admins and Branch managers; a Branch manager sees their branches' orders.
  const { error, profile } = await verifyAdminOrTrainer();
  if (error) redirect("/admin");
  const isAdmin = profile!.role === "admin";
  if (!isAdmin) {
    const scope = await getBranchScopeAction();
    if ("error" in scope || scope.data.managedBranchIds.length === 0) redirect("/admin");
  }
  // Unassigned Morning deliveries carry no branch: Admins only.
  const [orders, unassigned] = await Promise.all([
    listOrdersAction(),
    isAdmin ? listUnassignedWebhookEventsAction() : Promise.resolve([]),
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
      {isAdmin && <DiscountsCard rows={orders.filter((o) => o.list_price_ils !== null)} />}
      <OrdersTable rows={orders} />
    </div>
  );
}

/** Sales below list price: list price, amount paid, why, and who gave it. */
function DiscountsCard({ rows }: { rows: AdminOrderRow[] }) {
  if (rows.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">הנחות ({rows.length})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {rows.map((order) => (
          <div key={order.id} className="flex flex-wrap justify-between gap-x-4 gap-y-1 border-b pb-2 last:border-0">
            <span>
              {order.child_name} · {order.productName}
            </span>
            <span className="tabular-nums">
              <s className="text-muted-foreground">₪{order.list_price_ils!.toLocaleString("he-IL")}</s> ₪
              {order.amount_ils.toLocaleString("he-IL")}
            </span>
            <span className="w-full text-xs text-muted-foreground">
              {order.discount_reason}
              {order.discountedByName ? ` · ${order.discountedByName}` : ""} · {formatDateTime(order.created_at)}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
