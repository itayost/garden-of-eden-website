import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/helpers";
import { isValidUUID } from "@/lib/validations/common";
import { PaymentsClosedNotice } from "@/features/enrollment/components/PaymentsClosedNotice";
import { FullLoadGuard } from "@/features/enrollment/components/FullLoadGuard";
import { PelecardFrame } from "@/features/enrollment/components/PelecardFrame";
import { openPaymentPage } from "@/features/enrollment/lib/open-payment-page";
import { canPayOnline } from "@/lib/payments/online-payments";
import { declineMessage } from "@/lib/payments/pelecard-page-mapping";
import { orderPlanName } from "@/lib/plans/manual-card";
import type { Order, PlanProduct } from "@/types/plans";

export const metadata: Metadata = {
  title: "תשלום מאובטח | Garden of Eden",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ declined?: string }>;
}

/**
 * The card page for one order. The parent pays on Pelecard's payment page,
 * framed here; the order id is the only thing in the URL, and the amount and
 * the plan come from the row, never from the client. A paid order goes
 * straight to the confirmation, a failed one to a retry. A decline returns
 * here with its code and a fresh Pelecard page.
 */
export default async function PayPage({ params, searchParams }: PageProps) {
  const { orderId } = await params;
  const { declined } = await searchParams;
  if (!isValidUUID(orderId)) notFound();

  const db = createAdminClient();
  const { data: order } = (await typedFrom(db, "orders")
    .select("id, status, amount_ils, child_name, parent_name, product_id, terms_sessions_total, terms_duration_days, agreements:enrollment_agreements(signed_at)")
    .eq("id", orderId)
    .maybeSingle()) as {
    data:
      | (Pick<
          Order,
          "id" | "status" | "amount_ils" | "child_name" | "parent_name" | "product_id" | "terms_sessions_total" | "terms_duration_days"
        > & {
          agreements: { signed_at: string | null }[] | null;
        })
      | null;
  };
  if (!order) notFound();
  if (order.status === "paid" || order.status === "charging") redirect(`/join/success?order=${order.id}`);
  if (order.status === "failed") redirect(`/join/failed?order=${order.id}`);

  // A Payment link is signed before the card; the charge refuses an unsigned one too.
  // The signing link is never derived here: the order id must not unlock the agreement.
  const agreement = order.agreements?.[0];
  if (agreement && !agreement.signed_at) {
    return (
      <section className="space-y-2 rounded-2xl border bg-white p-4 text-sm">
        <h1 className="text-xl font-bold">קודם חותמים על ההסכם</h1>
        <p className="text-black/60">
          פתחו את הקישור שקיבלתם בוואטסאפ, חתמו על ההסכם, ומשם תעברו לתשלום.
        </p>
      </section>
    );
  }

  const { data: product } = (await typedFrom(db, "plan_products")
    .select("name_he")
    .eq("id", order.product_id)
    .maybeSingle()) as { data: Pick<PlanProduct, "name_he"> | null };

  const amount = Number(order.amount_ils);
  const isOpen = await canPayOnline();
  const declinedCode = declined && /^\d{3}$/.test(declined) ? declined : null;
  // After a decline Pelecard's page has ended, so a fresh one opens.
  const page = isOpen ? await openPaymentPage(order.id, { fresh: declinedCode !== null }) : null;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium text-black/60">שלב 2 מתוך 2</p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold sm:text-3xl">
          <ShieldCheck className="h-6 w-6 text-success" />
          תשלום מאובטח
        </h1>
      </header>

      <section className="rounded-2xl border bg-white p-4">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-black/60">מסלול</dt>
          <dd className="font-medium">{orderPlanName(product?.name_he ?? "מסלול", order)}</dd>
          <dt className="text-black/60">חניך/ה</dt>
          <dd className="font-medium">{order.child_name}</dd>
          <dt className="text-black/60">משלם/ת</dt>
          <dd className="font-medium">{order.parent_name}</dd>
          <dt className="text-black/60">לתשלום</dt>
          <dd className="text-xl font-bold">₪{amount.toLocaleString("he-IL")}</dd>
        </dl>
        <p className="mt-3 text-xs text-black/60">
          המחיר כולל מע&quot;מ. ההסכם נחתם;{" "}
          {/* A plain link: a client-side navigation would carry this page's strict CSP to /join. */}
          <a href="/join" className="underline">חזרה לבחירת מסלול</a> מתחילה הרשמה חדשה.
        </p>
      </section>

      <section className="rounded-2xl border bg-white p-4 sm:p-6">
        {page ? (
          <FullLoadGuard>
            {declinedCode && (
              <p role="alert" className="mb-4 rounded-xl bg-destructive/10 p-3 text-sm font-medium text-destructive">
                {declineMessage(declinedCode)}
              </p>
            )}
            {page.kind === "frame" ? (
              <PelecardFrame url={page.url} />
            ) : (
              <p className="py-6 text-center text-sm text-black/70">{page.text}</p>
            )}
          </FullLoadGuard>
        ) : (
          <PaymentsClosedNotice />
        )}
      </section>
    </div>
  );
}
