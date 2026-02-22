import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { typedFrom } from "@/lib/supabase/helpers";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FileText, Video, Activity, Salad } from "lucide-react";
import { ShiftStatusCard } from "@/components/admin/shifts/ShiftStatusCard";
import type { Profile } from "@/types/database";

export const metadata: Metadata = {
  title: "ניהול | Garden of Eden",
};

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  // Get current user for shift status
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? ((await supabase
        .from("profiles")
        .select("role, full_name")
        .eq("id", user.id)
        .single()) as { data: Profile | null })
    : { data: null };

  // Check for active shift (for trainers/admins)
  const { data: activeShift } = user
    ? await typedFrom(supabase, "trainer_shifts")
        .select("id, start_time")
        .eq("trainer_id", user.id)
        .is("end_time", null)
        .maybeSingle()
    : { data: null };

  // Fetch stats
  const [
    { count: totalUsers },
    { count: preWorkoutCount },
    { count: postWorkoutCount },
    { count: nutritionCount },
    { count: videosCount },
    { data: recentPreWorkout },
    { data: recentPostWorkout }
  ] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("pre_workout_forms").select("id", { count: "exact", head: true }),
    supabase.from("post_workout_forms").select("id", { count: "exact", head: true }),
    supabase.from("nutrition_forms").select("id", { count: "exact", head: true }),
    supabase.from("workout_videos").select("id", { count: "exact", head: true }),
    supabase
      .from("pre_workout_forms")
      .select("*, profiles(full_name)")
      .order("submitted_at", { ascending: false })
      .limit(5),
    supabase
      .from("post_workout_forms")
      .select("*, profiles(full_name), trainer:profiles!post_workout_forms_trainer_id_fkey(full_name)")
      .order("submitted_at", { ascending: false })
      .limit(5),
  ]);

  const stats = [
    {
      title: "משתמשים רשומים",
      value: totalUsers || 0,
      icon: Users,
      color: "bg-blue-500",
    },
    {
      title: "שאלונים לפני אימון",
      value: preWorkoutCount || 0,
      icon: Activity,
      color: "bg-green-500",
    },
    {
      title: "שאלונים אחרי אימון",
      value: postWorkoutCount || 0,
      icon: FileText,
      color: "bg-purple-500",
    },
    {
      title: "שאלוני תזונה",
      value: nutritionCount || 0,
      icon: Salad,
      color: "bg-orange-500",
    },
    {
      title: "סרטוני תרגילים",
      value: videosCount || 0,
      icon: Video,
      color: "bg-pink-500",
    },
  ];

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("he-IL", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">דשבורד ניהול</h1>
        <p className="text-muted-foreground">
          סקירה כללית של הנתונים במערכת
        </p>
      </div>

      {/* Shift Status Card - shown to trainers and admins */}
      {(profile?.role === "trainer" || profile?.role === "admin") && (
        <ShiftStatusCard initialShift={activeShift || null} />
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className={`${stat.color} rounded-xl p-3`}>
                  <stat.icon className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <p className="text-3xl font-bold">{stat.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Pre-Workout Forms */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              שאלונים אחרונים לפני אימון
            </CardTitle>
            <CardDescription>5 השאלונים האחרונים שהוגשו</CardDescription>
          </CardHeader>
          <CardContent>
            {recentPreWorkout && recentPreWorkout.length > 0 ? (
              <div className="space-y-3">
                {recentPreWorkout.map((form: Record<string, unknown>) => (
                  <div
                    key={form.id as string}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{form.full_name as string}</p>
                      <p className="text-sm text-muted-foreground">
                        שינה: {form.sleep_hours as string || "לא צוין"}
                      </p>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {formatDate(form.submitted_at as string)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">
                אין שאלונים עדיין
              </p>
            )}
          </CardContent>
        </Card>

        {/* Recent Post-Workout Forms */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              שאלונים אחרונים אחרי אימון
            </CardTitle>
            <CardDescription>5 השאלונים האחרונים שהוגשו</CardDescription>
          </CardHeader>
          <CardContent>
            {recentPostWorkout && recentPostWorkout.length > 0 ? (
              <div className="space-y-3">
                {recentPostWorkout.map((form: Record<string, unknown>) => (
                  <div
                    key={form.id as string}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{form.full_name as string}</p>
                      <p className="text-sm text-muted-foreground">
                        שביעות רצון: {form.satisfaction_level as number}/10 •
                        קושי: {form.difficulty_level as number}/10
                      </p>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {formatDate(form.submitted_at as string)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">
                אין שאלונים עדיין
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
