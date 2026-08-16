import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SessionTemplateList } from "@/features/workouts/components/SessionTemplateList";
import { listTemplatesAction } from "@/lib/actions/session-templates";
import { verifyAdminOrTrainer } from "@/lib/actions/shared";

export const metadata: Metadata = {
  title: "תבניות אימון | Garden of Eden",
};

export default async function SessionTemplatesPage() {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) redirect("/dashboard");

  const result = await listTemplatesAction();

  if ("error" in result) {
    return <p className="py-12 text-center text-destructive">{result.error}</p>;
  }

  return <SessionTemplateList templates={result.data} />;
}
