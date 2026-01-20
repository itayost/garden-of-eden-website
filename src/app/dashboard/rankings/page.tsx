import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { RankingsView, getRankingsData } from "@/features/rankings";

export default async function RankingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?redirect=/dashboard/rankings");
  }

  // Fetch initial rankings data
  const initialData = await getRankingsData("all", "sprint");

  return (
    <RankingsView
      initialData={initialData}
      currentUserId={user.id}
    />
  );
}
