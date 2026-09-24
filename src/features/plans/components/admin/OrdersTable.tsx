"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/utils/date";
import { formatPhoneToLocal } from "@/lib/validations/common";
import { issueInvoiceAction, retryFulfillmentAction, type AdminOrderRow } from "../../lib/actions/admin-orders";
import { PAYMENT_METHOD_LABELS_HE, type OrderStatus } from "@/types/plans";

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "ממתין לתשלום",
  charging: "בחיוב",
  paid: "שולם",
  failed: "נכשל",
  expired: "פג",
};

export function OrdersTable({ rows }: { rows: AdminOrderRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const retry = (orderId: string) =>
    startTransition(async () => {
      const result = await retryFulfillmentAction(orderId);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("ההזמנה הושלמה");
      router.refresh();
    });

  const issueInvoice = (orderId: string) =>
    startTransition(async () => {
      const result = await issueInvoiceAction(orderId);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("החשבונית הופקה");
      router.refresh();
    });

  if (rows.length === 0) {
    return <p className="py-12 text-center text-muted-foreground">אין הזמנות עדיין</p>;
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-right">תאריך</TableHead>
            <TableHead className="text-right">הורה / חניך</TableHead>
            <TableHead className="text-right">מסלול</TableHead>
            <TableHead className="text-right">סכום</TableHead>
            <TableHead className="text-right">סטטוס</TableHead>
            <TableHead className="text-right">מסמכים</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((order) => (
            <TableRow key={order.id}>
              <TableCell className="text-sm text-muted-foreground">
                {formatDateTime(order.created_at)}
              </TableCell>
              <TableCell>
                <div className="font-medium">{order.parent_name}</div>
                <div className="text-xs text-muted-foreground">
                  {order.child_name} · {formatPhoneToLocal(order.login_phone)}
                </div>
              </TableCell>
              <TableCell>{order.productName}</TableCell>
              <TableCell>
                ₪{order.amount_ils.toLocaleString("he-IL")}
                {order.payment_method && (
                  <div className="text-xs text-muted-foreground">
                    {PAYMENT_METHOD_LABELS_HE[order.payment_method]}
                    {order.reference ? ` · ${order.reference}` : ""}
                    {order.receivedByName ? ` · נרשם ע"י ${order.receivedByName}` : ""}
                  </div>
                )}
              </TableCell>
              <TableCell>
                <Badge variant={order.status === "paid" ? "default" : "outline"}>
                  {STATUS_LABEL[order.status]}
                </Badge>
                {order.status === "paid" && !order.fulfilled_at && order.payment_method !== "arbox" && (
                  <div className="mt-1 space-y-1">
                    <p className="text-xs text-destructive">
                      {order.fulfillment_error ?? "לא הושלם"}
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => retry(order.id)}
                      disabled={pending}
                    >
                      <RefreshCw className="h-3 w-3 me-1" />
                      ניסיון חוזר
                    </Button>
                  </div>
                )}
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap items-center gap-2">
                  {order.status === "paid" && order.fulfilled_at && !order.morning_document_url && order.payment_method !== "arbox" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => issueInvoice(order.id)}
                      disabled={pending}
                    >
                      <FileText className="h-3 w-3 me-1" />
                      הפק חשבונית
                    </Button>
                  )}
                  {order.morning_document_url && (
                    <a
                      href={order.morning_document_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-sm underline"
                    >
                      <FileText className="h-3 w-3" />
                      חשבונית
                    </a>
                  )}
                  {order.agreementId && (
                    <span className="text-xs text-muted-foreground">הסכם חתום</span>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
