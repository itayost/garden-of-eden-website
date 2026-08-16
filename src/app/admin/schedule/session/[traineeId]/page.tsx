import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { SessionBuilder } from "@/components/admin/schedule/SessionBuilder";
import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { listTemplatesAction } from "@/lib/actions/session-templates";
import { getSessionAction } from "@/lib/actions/training-sessions";
import { createAdminClient } from "@/lib/supabase/admin";
import { listPrograms } from "@/features/workouts/lib/actions";
import { israelToday } from "@/lib/utils/tasks";
import { isValidDateString, isValidUUID } from "@/lib/validations/common";

export const metadata: Metadata = {
  title: "בניית אימון | Garden of Eden",
};

interface PageProps {
  params: Promise<{ traineeId: string }>;
  searchParams: Promise<{ date?: string; slot?: string }>;
}

export default async function SessionBuilderPage({
  params,
  searchParams,
}: PageProps) {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) redirect("/dashboard");

  const { traineeId } = await params;
  if (!isValidUUID(traineeId)) notFound();

  const query = await searchParams;
  const date =
    query.date && isValidDateString(query.date) ? query.date : israelToday();
  const slotId = query.slot && isValidUUID(query.slot) ? query.slot : null;

  // Admin client for the trainee lookup: no profiles RLS policy lets a
  // trainer read a trainee row, and trainers are this page's primary users.
  // Safe because verifyAdminOrTrainer() gated above. is_active matches the
  // save action's filter so a deactivated trainee 404s here instead of
  // failing after the trainer composed the whole session.
  const adminClient = createAdminClient();
  const [{ data: trainee }, sessionResult, programs, templatesResult] =
    await Promise.all([
      adminClient
        .from("profiles")
        .select("id, full_name")
        .eq("id", traineeId)
        .eq("role", "trainee")
        .eq("is_active", true)
        .is("deleted_at", null)
        .maybeSingle(),
      getSessionAction(traineeId, date),
      listPrograms(),
      listTemplatesAction(),
    ]);

  if (!trainee) notFound();

  const session = "success" in sessionResult ? sessionResult.data : null;
  const loadError = "error" in sessionResult ? sessionResult.error : null;
  // A failed template list only costs the import option, so it degrades to an
  // empty menu item rather than blocking the whole builder.
  const templates = "success" in templatesResult ? templatesResult.data : [];

  return (
    <SessionBuilder
      // Remount on trainee/date change: the builder seeds its rows from props
      // on mount, and a param-only navigation would otherwise carry trainee
      // A's exercises into trainee B's builder.
      key={`${traineeId}-${date}`}
      traineeId={traineeId}
      traineeName={trainee.full_name ?? "מתאמן"}
      date={date}
      slotId={slotId}
      session={session}
      loadError={loadError}
      programs={programs}
      templates={templates}
    />
  );
}
