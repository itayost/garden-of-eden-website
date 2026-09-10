import { planTokenSecret } from "@/lib/plans/token-secret";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/helpers";
import { verifyAgreementToken } from "@/lib/plans/agreement-token";
import { isValidUUID } from "@/lib/validations/common";
import { AgreementPrintable } from "@/features/enrollment/components/AgreementPrintable";
import type { EnrollmentAgreement } from "@/types/plans";

export const metadata: Metadata = { title: "הסכם הרשמה", robots: { index: false, follow: false } };

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string }>;
}

/** The parent's copy. Public URL, guarded by the HMAC in the WhatsApp link. */
export default async function AgreementPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { t } = await searchParams;
  const secret = planTokenSecret();
  if (!isValidUUID(id) || !t || !verifyAgreementToken(id, t, secret)) notFound();

  const { data } = (await typedFrom(createAdminClient(), "enrollment_agreements")
    .select("*")
    .eq("id", id)
    .maybeSingle()) as { data: EnrollmentAgreement | null };
  if (!data) notFound();

  return <AgreementPrintable agreement={data} />;
}
