import { planTokenSecret } from "@/lib/plans/token-secret";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckCircle2, FileText } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/helpers";
import { verifyAgreementToken } from "@/lib/plans/agreement-token";
import { isValidUUID } from "@/lib/validations/common";
import { AgreementPrintable } from "@/features/enrollment/components/AgreementPrintable";
import { AgreementSignForm } from "@/features/enrollment/components/AgreementSignForm";
import type { EnrollmentAgreement, Order } from "@/types/plans";

export const metadata: Metadata = { title: "הסכם הרשמה", robots: { index: false, follow: false } };

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string }>;
}

/**
 * The parent's page. Public URL, guarded by the HMAC in the WhatsApp link.
 * Until the parent signs (a staff-opened agreement) it is the signing form;
 * afterwards it is the printable copy, with the receipt when one exists.
 */
export default async function AgreementPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { t } = await searchParams;
  const secret = planTokenSecret();
  if (!isValidUUID(id) || !t || !verifyAgreementToken(id, t, secret)) notFound();

  const db = createAdminClient();
  const { data } = (await typedFrom(db, "enrollment_agreements")
    .select("*")
    .eq("id", id)
    .maybeSingle()) as { data: EnrollmentAgreement | null };
  if (!data) notFound();

  if (!data.signed_at) {
    return <AgreementSignForm agreement={data} token={t} />;
  }

  const { data: order } = data.order_id
    ? ((await typedFrom(db, "orders")
        .select("morning_document_url")
        .eq("id", data.order_id)
        .maybeSingle()) as { data: Pick<Order, "morning_document_url"> | null })
    : { data: null };

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 rounded-2xl border border-green-600/40 bg-green-50 p-4 text-sm">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
        <div>
          <p className="font-medium">ההסכם חתום ושמור</p>
          <p className="text-black/60">זה העותק שלכם. אפשר להדפיס או לשמור את הדף.</p>
          {order?.morning_document_url && (
            <a
              href={order.morning_document_url}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1 underline"
            >
              <FileText className="h-4 w-4" />
              החשבונית שלכם
            </a>
          )}
        </div>
      </div>
      <AgreementPrintable agreement={data} />
    </div>
  );
}
