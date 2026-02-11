import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { typedFrom } from "@/lib/supabase/helpers";
import type { TrainerShift } from "@/types/database";
import type { FailedShiftSync } from "@/lib/actions/trainer-shifts";
import { TrainerShiftsView } from "@/components/admin/shifts/TrainerShiftsView";
import { FailedSyncsBanner } from "@/components/admin/shifts/FailedSyncsBanner";

export const metadata: Metadata = {
  title: "שעות מאמנים | Garden of Eden",
};

interface AdminShiftsPageProps {
  searchParams: Promise<{ month?: string; year?: string }>;
}

export default async function AdminShiftsPage({
  searchParams,
}: AdminShiftsPageProps) {
  const { month: monthParam, year: yearParam } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?redirect=/admin/shifts");
  }

  const { data: profile } = (await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single()) as { data: { role: string; full_name: string | null } | null };

  if (profile?.role !== "admin" && profile?.role !== "trainer") {
    redirect("/dashboard");
  }

  const isAdmin = profile.role === "admin";

  // Default to current month
  const now = new Date();
  const month = monthParam ? parseInt(monthParam) : now.getMonth() + 1;
  const year = yearParam ? parseInt(yearParam) : now.getFullYear();

  // Build date range for the selected month
  const startDate = new Date(year, month - 1, 1).toISOString();
  const endDate = new Date(year, month, 0, 23, 59, 59, 999).toISOString();

  // Fetch shifts for the month
  let query = typedFrom(supabase, "trainer_shifts")
    .select("*")
    .gte("start_time", startDate)
    .lte("start_time", endDate)
    .order("start_time", { ascending: false });

  // Trainers can only see their own shifts
  if (!isAdmin) {
    query = query.eq("trainer_id", user.id);
  }

  const { data: shifts } = (await query) as { data: TrainerShift[] | null };

  // Fetch unresolved failed syncs (admin only)
  let failedSyncs: FailedShiftSync[] = [];
  if (isAdmin) {
    const { data: syncs } = (await typedFrom(supabase, "failed_shift_syncs")
      .select("*")
      .eq("resolved", false)
      .order("created_at", { ascending: false })) as {
      data: FailedShiftSync[] | null;
    };
    failedSyncs = syncs || [];
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">
          {isAdmin ? "שעות מאמנים" : "השעות שלי"}
        </h1>
        <p className="text-muted-foreground">
          {isAdmin
            ? "סיכום שעות עבודה חודשי לכל המאמנים"
            : "סיכום שעות העבודה שלך"}
        </p>
      </div>

      {isAdmin && failedSyncs.length > 0 && (
        <FailedSyncsBanner failedSyncs={failedSyncs} />
      )}

      <TrainerShiftsView
        shifts={shifts || []}
        month={month}
        year={year}
        isAdmin={isAdmin}
      />
    </div>
  );
}
