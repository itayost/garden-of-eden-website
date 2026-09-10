import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/helpers";
import { isValidUUID } from "@/lib/validations/common";
import { PaymentForm } from "@/features/enrollment/components/PaymentForm";
import type { Order, PlanProduct } from "@/types/plans";

export const metadata: Metadata = {
  title: "תשלום מאובטח | Garden of Eden",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ orderId: string }>;
}

/**
 * The site's own card page for one order. The order id is the only thing in
 * the URL; the amount and the plan come from the row, never from the client.
 * A paid order goes straight to the confirmation, a failed one to a retry.
 */
export default async function PayPage({ params }: PageProps) {
  const { orderId } = await params;
  if (!isValidUUID(orderId)) notFound();

  const db = createAdminClient();
  const { data: order } = (await typedFrom(db, "orders")
    .select("id, status, amount_ils, child_name, parent_name, product_id")
    .eq("id", orderId)
    .maybeSingle()) as {
    data: Pick<Order, "id" | "status" | "amount_ils" | "child_name" | "parent_name" | "product_id"> | null;
  };
  if (!order) notFound();
  if (order.status === "paid") redirect(`/join/success?order=${order.id}`);
  if (order.status === "failed") redirect(`/join/failed?order=${order.id}`);

  const { data: product } = (await typedFrom(db, "plan_products")
    .select("name_he, sessions_total, duration_days")
    .eq("id", order.product_id)
    .maybeSingle()) as { data: Pick<PlanProduct, "name_he" | "sessions_total" | "duration_days"> | null };

  const amount = Number(order.amount_ils);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium text-black/50">שלב 2 מתוך 2</p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold sm:text-3xl">
          <ShieldCheck className="h-6 w-6 text-green-600" />
          תשלום מאובטח
        </h1>
      </header>

      <section className="rounded-2xl border bg-white p-4">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-black/50">מסלול</dt>
          <dd className="font-medium">{product?.name_he ?? "מסלול"}</dd>
          <dt className="text-black/50">חניך/ה</dt>
          <dd className="font-medium">{order.child_name}</dd>
          <dt className="text-black/50">משלם/ת</dt>
          <dd className="font-medium">{order.parent_name}</dd>
          <dt className="text-black/50">לתשלום</dt>
          <dd className="text-xl font-bold">₪{amount.toLocaleString("he-IL")}</dd>
        </dl>
        <p className="mt-3 text-xs text-black/50">
          המחיר כולל מע&quot;מ. ההסכם נחתם;{" "}
          <Link href="/join" className="underline">חזרה לבחירת מסלול</Link> מתחילה הרשמה חדשה.
        </p>
      </section>

      <section className="rounded-2xl border bg-white p-4 sm:p-6">
        <PaymentForm orderId={order.id} amountIls={amount} />
      </section>
    </div>
  );
}
