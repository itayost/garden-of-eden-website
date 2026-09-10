import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import dynamic from "next/dynamic";
import { getRankingsData } from "@/features/rankings";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadBranchIdsByProfile, loadBranchOptions } from "@/features/branches/lib/memberships";
import { ALL_BRANCHES } from "@/features/rankings/lib/config/branches";
import { getAgeGroup } from "@/types/assessment";

const RankingsView = dynamic(
  () => import("@/features/rankings").then(m => ({ default: m.RankingsView }))
);

export const metadata: Metadata = {
  title: "דירוגים | Garden of Eden",
};

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

  // Own memberships through the service role: the page is behind login and
  // reads only the viewer's rows plus the branch list.
  const adminClient = createAdminClient();
  const [allOptions, membershipMap] = await Promise.all([
    loadBranchOptions(adminClient),
    loadBranchIdsByProfile(adminClient, [user.id]),
  ]);
  const ownBranchIds = membershipMap.get(user.id) ?? [];
  const ownOptions = allOptions.filter((o) => ownBranchIds.includes(o.id));
  const isAdmin = userRole === "admin";

  // Trainee: own branch, or the whole academy when unassigned.
  // Trainer: first own branch. Admin: first branch in display order.
  const branchOptions = isTrainee ? ownOptions : allOptions;
  const initialBranch = isTrainee
    ? (ownOptions[0]?.id ?? ALL_BRANCHES)
    : isAdmin
      ? (allOptions[0]?.id ?? ALL_BRANCHES)
      : (ownOptions[0]?.id ?? allOptions[0]?.id ?? ALL_BRANCHES);

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
  const initialData = await getRankingsData(initialAgeGroup, "sprint", initialBranch);

  return (
    <RankingsView
      initialData={initialData}
      currentUserId={user.id}
      isTrainee={isTrainee}
      userAgeGroupId={userAgeGroupId}
      userAgeGroupLabel={userAgeGroupLabel}
      branchOptions={branchOptions}
      showAllBranchesOption={!isTrainee}
    />
  );
}
