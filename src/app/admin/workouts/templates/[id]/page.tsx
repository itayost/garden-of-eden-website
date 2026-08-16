import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { SessionTemplateEditor } from "@/features/workouts/components/SessionTemplateEditor";
import { getTemplateAction } from "@/lib/actions/session-templates";
import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { isValidUUID } from "@/lib/validations/common";

export const metadata: Metadata = {
  title: "עריכת תבנית | Garden of Eden",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SessionTemplatePage({ params }: PageProps) {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) redirect("/dashboard");

  const { id } = await params;
  if (!isValidUUID(id)) notFound();

  const result = await getTemplateAction(id);

  if ("error" in result) {
    return <p className="py-12 text-center text-destructive">{result.error}</p>;
  }
  if (!result.data) notFound();

  return <SessionTemplateEditor template={result.data} />;
}
