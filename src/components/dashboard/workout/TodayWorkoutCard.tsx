import Link from "next/link";
import { ChevronLeft, Dumbbell, PartyPopper } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { typedFrom } from "@/lib/supabase/helpers";
import { israelToday } from "@/lib/utils/tasks";

/**
 * Dashboard-home teaser for today's session. Self-fetching server component;
 * renders nothing when no session was built for today — most days, for most
 * trainees, this card simply is not there.
 */
export async function TodayWorkoutCard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await typedFrom(supabase, "training_sessions")
    .select("id, completed_at, exercises:training_session_exercises(id, logs:exercise_logs(id))")
    .eq("trainee_id", user.id)
    .eq("session_date", israelToday())
    .maybeSingle();

  if (!data) return null;

  const session = data as {
    id: string;
    completed_at: string | null;
    exercises: { id: string; logs: { id: string }[] }[];
  };
  const total = session.exercises.length;
  const logged = session.exercises.filter((e) => e.logs.length > 0).length;
  const completed = Boolean(session.completed_at);

  return (
    <Link href="/dashboard/workout" className="block">
      <Card
        className={
          completed
            ? "border-green-500 transition-colors hover:bg-muted/40"
            : "border-primary transition-colors hover:bg-muted/40"
        }
      >
        <CardContent className="flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            {completed ? (
              <PartyPopper className="h-6 w-6 text-green-600" />
            ) : (
              <Dumbbell className="h-6 w-6 text-primary" />
            )}
            <div>
              <p className="font-semibold">
                {completed ? "האימון של היום הושלם!" : "יש לך אימון היום!"}
              </p>
              <p className="text-sm text-muted-foreground">
                {completed
                  ? `${total} תרגילים בוצעו`
                  : `${logged}/${total} תרגילים בוצעו — לחץ לצפייה`}
              </p>
            </div>
          </div>
          <ChevronLeft className="h-5 w-5 text-muted-foreground" />
        </CardContent>
      </Card>
    </Link>
  );
}
