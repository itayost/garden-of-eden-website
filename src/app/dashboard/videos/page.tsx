import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BrandProgress } from "@/components/ui/brand-progress";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "סרטונים | Garden of Eden",
};
import { VideoCard } from "@/components/dashboard/VideoCard";
import { Clock, Calendar, Dumbbell } from "lucide-react";
import type { WorkoutVideo, VideoProgress } from "@/types/database";

const dayTopics = [
  { day: 1, topic: "גמישות תנועתיות", icon: "🤸" },
  { day: 2, topic: "יציבות", icon: "🧘" },
  { day: 3, topic: "תרגילי בטן ליבה", icon: "💪" },
  { day: 4, topic: "גמישות פלג גוף עליון", icon: "🙆" },
  { day: 5, topic: "קוארדינציה", icon: "⚡" },
];

export default async function VideosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Explicit auth check - redirect if not authenticated
  if (!user) {
    redirect("/auth/login?redirect=/dashboard/videos");
  }

  // Fetch videos and progress
  const [{ data: videos }, { data: progress }] = await Promise.all([
    supabase
      .from("workout_videos")
      .select("*")
      .order("day_number")
      .order("order_index") as unknown as { data: WorkoutVideo[] | null },
    supabase
      .from("video_progress")
      .select("*")
      .eq("user_id", user?.id || "") as unknown as { data: VideoProgress[] | null },
  ]);

  const videosByDay = (videos || []).reduce((acc, video) => {
    if (!acc[video.day_number]) {
      acc[video.day_number] = [];
    }
    acc[video.day_number].push(video);
    return acc;
  }, {} as Record<number, WorkoutVideo[]>);

  const progressMap = (progress || []).reduce((acc, p) => {
    acc[p.video_id] = p;
    return acc;
  }, {} as Record<string, VideoProgress>);

  const totalVideos = videos?.length || 0;
  const watchedVideos = progress?.filter((p) => p.watched).length || 0;

  return (
    <div className="space-y-6 md:space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">סרטוני תרגילים לבית</h1>
        <p className="text-muted-foreground">
          5 ימי אימון שונים - כל יום נושא אחר, 30-40 דקות אימון
        </p>
      </div>

      {/* Progress Overview */}
      <Card>
        <CardContent className="py-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="bg-primary/10 rounded-xl p-3">
                <Dumbbell className="h-8 w-8 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">התקדמות כללית</p>
                <p className="text-2xl font-bold">
                  {watchedVideos} / {totalVideos} סרטונים
                </p>
              </div>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>30-40 דקות ליום</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>2 סטים × דקה לכל רגל</span>
              </div>
            </div>
          </div>
          {/* Progress bar */}
          <BrandProgress
            value={watchedVideos}
            max={totalVideos}
            className="mt-4"
            label="התקדמות צפייה בסרטונים"
          />
        </CardContent>
      </Card>

      {/* Day Tabs */}
      <Tabs defaultValue="1" className="space-y-6">
        <TabsList className="flex flex-wrap h-auto gap-2 bg-transparent p-0">
          {dayTopics.map(({ day, icon }) => {
            const dayVideos = videosByDay[day] || [];
            const dayWatched = dayVideos.filter((v) => progressMap[v.id]?.watched).length;
            const isComplete = dayVideos.length > 0 && dayWatched === dayVideos.length;

            return (
              <TabsTrigger
                key={day}
                value={String(day)}
                className="flex-1 min-w-[120px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-3 px-4 rounded-lg border"
              >
                <div className="flex flex-col items-center gap-1">
                  <span className="text-xl">{icon}</span>
                  <span className="font-medium">יום {day}</span>
                  {isComplete && (
                    <Badge variant="secondary" className="text-xs">
                      הושלם
                    </Badge>
                  )}
                </div>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {dayTopics.map(({ day, topic }) => {
          const dayVideos = videosByDay[day] || [];

          return (
            <TabsContent key={day} value={String(day)} className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>יום {day}: {topic}</CardTitle>
                  <CardDescription>
                    {dayVideos.length} תרגילים • כל תרגיל 2 סטים של דקה לכל רגל
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {dayVideos.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>סרטונים יתווספו בקרוב...</p>
                    </div>
                  ) : (
                    <div className="grid md:grid-cols-2 gap-4">
                      {dayVideos.map((video) => (
                        <VideoCard
                          key={video.id}
                          video={video}
                          watched={progressMap[video.id]?.watched || false}
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
