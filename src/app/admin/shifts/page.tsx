import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { typedFrom } from "@/lib/supabase/helpers";
import type { TrainerShift } from "@/types/database";
import type { FailedShiftSync } from "@/lib/actions/trainer-shifts";
import {
  getMyShiftChangeRequestsAction,
  getShiftChangeRequestsAction,
  type MyShiftChangeRequest,
  type ShiftChangeRequestWithPreview,
} from "@/lib/actions/shift-change-requests";
import { TrainerShiftsView } from "@/components/admin/shifts/TrainerShiftsView";
import { FailedSyncsBanner } from "@/components/admin/shifts/FailedSyncsBanner";
import { MyShiftRequestsList } from "@/components/admin/shifts/MyShiftRequestsList";
import { ShiftRequestsAdminPanel } from "@/components/admin/shifts/ShiftRequestsAdminPanel";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

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

  const now = new Date();
  const month = monthParam ? parseInt(monthParam) : now.getMonth() + 1;
  const year = yearParam ? parseInt(yearParam) : now.getFullYear();

  const startDate = new Date(year, month - 1, 1).toISOString();
  const endDate = new Date(year, month, 0, 23, 59, 59, 999).toISOString();

  let shiftsQuery = typedFrom(supabase, "trainer_shifts")
    .select("*")
    .gte("start_time", startDate)
    .lte("start_time", endDate)
    .order("start_time", { ascending: false });
  if (!isAdmin) {
    shiftsQuery = shiftsQuery.eq("trainer_id", user.id);
  }

  // Run independent fetches in parallel
  const [
    shiftsResult,
    trainerProfilesResult,
    syncsResult,
    adminRequestsActionResult,
    myRequestsActionResult,
  ] = await Promise.all([
    shiftsQuery as Promise<{ data: TrainerShift[] | null }>,
    isAdmin
      ? supabase
          .from("profiles")
          .select("id, full_name")
          .in("role", ["trainer", "admin"])
          .eq("is_active", true)
          .order("full_name")
      : Promise.resolve({ data: null }),
    isAdmin
      ? (typedFrom(supabase, "failed_shift_syncs")
          .select("*")
          .eq("resolved", false)
          .order("created_at", { ascending: false }) as Promise<{
          data: FailedShiftSync[] | null;
        }>)
      : Promise.resolve({ data: null as FailedShiftSync[] | null }),
    isAdmin
      ? getShiftChangeRequestsAction({ status: "all" })
      : Promise.resolve(null),
    isAdmin ? Promise.resolve(null) : getMyShiftChangeRequestsAction(),
  ]);

  const shifts = shiftsResult.data;

  const trainers: { id: string; name: string }[] = isAdmin
    ? (trainerProfilesResult.data ?? []).map(
        (p: { id: string; full_name: string | null }) => ({
          id: p.id,
          name: p.full_name || "ללא שם",
        })
      )
    : [];

  const failedSyncs: FailedShiftSync[] = syncsResult.data ?? [];

  let myRequests: MyShiftChangeRequest[] = [];
  let adminRequests: ShiftChangeRequestWithPreview[] = [];
  let pendingCount = 0;

  if (isAdmin && adminRequestsActionResult?.success && adminRequestsActionResult.data) {
    adminRequests = adminRequestsActionResult.data;
    pendingCount = adminRequests.filter((r) => r.status === "pending").length;
  }
  if (!isAdmin && myRequestsActionResult?.success && myRequestsActionResult.data) {
    myRequests = myRequestsActionResult.data;
  }

  const shiftsView = (
    <TrainerShiftsView
      shifts={shifts || []}
      month={month}
      year={year}
      isAdmin={isAdmin}
      trainers={isAdmin ? trainers : undefined}
    />
  );

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

      {!isAdmin && <MyShiftRequestsList requests={myRequests} />}

      {isAdmin ? (
        <Tabs defaultValue="shifts" className="space-y-6">
          <TabsList>
            <TabsTrigger value="shifts">משמרות</TabsTrigger>
            <TabsTrigger value="requests" className="gap-2">
              בקשות
              {pendingCount > 0 && (
                <Badge variant="destructive" className="h-5 px-1.5 text-xs">
                  {pendingCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="shifts">{shiftsView}</TabsContent>
          <TabsContent value="requests">
            <ShiftRequestsAdminPanel requests={adminRequests} />
          </TabsContent>
        </Tabs>
      ) : (
        shiftsView
      )}
    </div>
  );
}
