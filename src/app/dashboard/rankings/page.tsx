import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { RankingsView, getRankingsData } from "@/features/rankings";
import { getAgeGroup } from "@/types/assessment";

export default async function RankingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?redirect=/dashboard/rankings");
  }

  // Fetch user profile to get role and birthdate
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, birthdate")
    .eq("id", user.id)
    .single();

  const userRole = profile?.role || "trainee";
  const isTrainee = userRole === "trainee";

  // Calculate user's age group if trainee
  let userAgeGroupId: string | null = null;
  let userAgeGroupLabel: string | null = null;

  if (isTrainee && profile?.birthdate) {
    const ageGroup = getAgeGroup(profile.birthdate);
    if (ageGroup) {
      userAgeGroupId = ageGroup.id;
      userAgeGroupLabel = ageGroup.labelHe;
    }
  }

  // For trainees, fetch data filtered by their age group
  // For admin/trainers, show all by default
  const initialAgeGroup = isTrainee && userAgeGroupId ? userAgeGroupId : "all";
  const initialData = await getRankingsData(initialAgeGroup, "sprint");

  return (
    <RankingsView
      initialData={initialData}
      currentUserId={user.id}
      isTrainee={isTrainee}
      userAgeGroupId={userAgeGroupId}
      userAgeGroupLabel={userAgeGroupLabel}
    />
  );
}
