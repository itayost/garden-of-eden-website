import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { isValidUUID } from "@/lib/utils/uuid";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { AssessmentForm } from "@/components/admin/AssessmentForm";
import type { Profile } from "@/types/database";
import { getAssessmentCompleteness } from "@/types/assessment";
import type { PlayerAssessment } from "@/types/assessment";

interface PageProps {
  params: Promise<{ userId: string; assessmentId: string }>;
}

export default async function EditAssessmentPage({ params }: PageProps) {
  const { userId, assessmentId } = await params;

  if (!isValidUUID(userId) || !isValidUUID(assessmentId)) {
    notFound();
  }

  const supabase = await createClient();

  // Fetch profile, current assessment, and all user assessments in parallel
  const [{ data: profile }, { data: assessment }, { data: allAssessments }] = await Promise.all([
    supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single() as unknown as { data: Profile | null },
    supabase
      .from("player_assessments")
      .select("*")
      .eq("id", assessmentId)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .single() as unknown as { data: PlayerAssessment | null },
    supabase
      .from("player_assessments")
      .select("*")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("assessment_date", { ascending: false }) as unknown as { data: PlayerAssessment[] | null },
  ]);

  if (!profile || !assessment) {
    notFound();
  }

  // Find the previous assessment from the pre-fetched list
  const previousAssessment = allAssessments?.find(
    (a) => new Date(a.assessment_date) < new Date(assessment.assessment_date)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/admin/assessments/${userId}`}>
            <ArrowRight className="h-4 w-4 ml-2" />
            חזרה לשחקן
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold">
          {getAssessmentCompleteness(assessment) < 100 ? "השלמת מבדק" : "עריכת מבדק"}
        </h1>
        <p className="text-muted-foreground">
          עבור {profile.full_name || "שחקן"} —{" "}
          {new Date(assessment.assessment_date).toLocaleDateString("he-IL")}
        </p>
      </div>

      {/* Form */}
      <div className="max-w-4xl">
        <AssessmentForm
          userId={userId}
          playerName={profile.full_name || "שחקן"}
          existingAssessment={assessment}
          previousAssessment={previousAssessment || null}
        />
      </div>
    </div>
  );
}
