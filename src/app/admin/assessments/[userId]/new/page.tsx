import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { isValidUUID } from "@/lib/utils/uuid";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { AssessmentForm } from "@/components/admin/AssessmentForm";
import type { Profile } from "@/types/database";
import type { PlayerAssessment } from "@/types/assessment";

interface PageProps {
  params: Promise<{ userId: string }>;
}

export default async function NewAssessmentPage({ params }: PageProps) {
  const { userId } = await params;

  // Validate userId is a proper UUID
  if (!isValidUUID(userId)) {
    notFound();
  }

  const supabase = await createClient();

  // Fetch player profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single() as unknown as { data: Profile | null };

  if (!profile) {
    notFound();
  }

  // Fetch the most recent assessment for comparison
  const { data: previousAssessments } = await supabase
    .from("player_assessments")
    .select("*")
    .eq("user_id", userId)
    .order("assessment_date", { ascending: false })
    .limit(1);

  const previousAssessment = previousAssessments?.[0] as PlayerAssessment | undefined;

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
        <h1 className="text-2xl font-bold">מבדק חדש</h1>
        <p className="text-muted-foreground">
          עבור {profile.full_name || "שחקן"}
        </p>
      </div>

      {/* Form */}
      <div className="max-w-4xl">
        <AssessmentForm
          userId={userId}
          playerName={profile.full_name || "שחקן"}
          previousAssessment={previousAssessment || null}
        />
      </div>
    </div>
  );
}
