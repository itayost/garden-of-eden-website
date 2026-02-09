import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { typedFrom } from "@/lib/supabase/helpers";
import { ShiftReportForm } from "@/components/admin/shift-report/ShiftReportForm";
import type { TrainerShiftReport } from "@/types/database";

export default async function EndOfShiftPage() {
  const supabase = await createClient();

  // Verify authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?redirect=/admin/end-of-shift");
  }

  // Verify trainer/admin role
  const { data: profile } = (await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single()) as { data: { role: string; full_name: string | null } | null };

  if (profile?.role !== "trainer" && profile?.role !== "admin") {
    redirect("/dashboard");
  }

  const today = new Date().toISOString().split("T")[0];

  // Check for existing report today
  const { data: existingReport } = await typedFrom(supabase, "trainer_shift_reports")
    .select("*")
    .eq("trainer_id", user.id)
    .eq("report_date", today)
    .maybeSingle() as { data: TrainerShiftReport | null };

  // Fetch active trainees for multi-select
  const { data: trainees } = (await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("role", "trainee")
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("full_name")) as unknown as {
    data: { id: string; full_name: string | null }[] | null;
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">דוח סוף משמרת</h1>
        <p className="text-muted-foreground">
          {existingReport
            ? "עריכת הדוח שהוגש היום"
            : "מלא את הדוח בסוף המשמרת שלך"}
        </p>
      </div>

      <ShiftReportForm
        trainerId={user.id}
        trainerName={profile?.full_name || "מאמן"}
        trainees={trainees || []}
        existingReport={existingReport}
      />
    </div>
  );
}
