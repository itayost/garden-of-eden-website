import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Video, Plus } from "lucide-react";
import { VideoListClient } from "@/components/admin/videos/VideoListClient";
import type { WorkoutVideo } from "@/types/database";

export const metadata: Metadata = {
  title: "ניהול סרטונים | Garden of Eden",
};

export default async function AdminVideosPage() {
  const supabase = await createClient();

  // Verify admin role before showing video list
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  if (!currentUser) {
    redirect("/login");
  }

  const { data: currentProfile } = (await supabase
    .from("profiles")
    .select("role")
    .eq("id", currentUser.id)
    .single()) as { data: { role: string } | null };

  if (currentProfile?.role !== "admin") {
    redirect("/admin");
  }

  // Fetch all workout videos ordered by day_number and order_index
  const { data: videos, error } = await supabase
    .from("workout_videos")
    .select("*")
    .order("day_number")
    .order("order_index");

  if (error) {
    console.error("Failed to fetch videos:", error);
  }

  const typedVideos = (videos || []) as WorkoutVideo[];

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">ניהול סרטונים</h1>
          <p className="text-muted-foreground">
            צפייה, הוספה ועריכה של סרטוני התרגילים
          </p>
        </div>
        <Button asChild className="self-start sm:self-auto">
          <Link href="/admin/videos/create">
            <Plus className="h-4 w-4 ml-2" />
            הוסף סרטון
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            רשימת סרטונים ({typedVideos.length})
          </CardTitle>
          <CardDescription>
            כל סרטוני התרגילים לבית - 5 ימים, כל יום נושא אחר
          </CardDescription>
        </CardHeader>
        <CardContent>
          <VideoListClient videos={typedVideos} />
        </CardContent>
      </Card>
    </div>
  );
}
