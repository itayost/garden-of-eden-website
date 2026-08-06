import Link from "next/link";
import { ChevronLeft, Dumbbell } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { typedFrom } from "@/lib/supabase/helpers";
import { cn } from "@/lib/utils";
import { israelToday } from "@/lib/utils/tasks";

/**
 * Dashboard-home teaser for today's session — part of the player-card family:
 * forest ground, gold accent chip, mini progress. Self-fetching server
 * component; renders nothing when no session was built for today.
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
  const pct = total ? (logged / total) * 100 : 0;

  return (
    <Link
      href="/dashboard/workout"
      className="block transition-transform hover:scale-[1.01] active:scale-[0.99]"
    >
      <Card
        className={cn(
          "overflow-hidden border-0 py-0 text-cream",
          completed
            ? "bg-gradient-to-l from-forest to-green-900"
            : "bg-gradient-to-l from-forest to-forest-light",
        )}
      >
        <CardContent className="flex items-center justify-between px-4 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className={cn(
                "grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-xl",
                completed ? "bg-grass/20" : "bg-gold/20",
              )}
              aria-hidden="true"
            >
              {completed ? "🏆" : <Dumbbell className="h-5 w-5 text-gold" />}
            </span>
            <div className="min-w-0">
              <p className="font-display text-lg leading-tight">
                {completed ? "האימון של היום הושלם!" : "יש לך אימון היום!"}
              </p>
              <div className="mt-1.5 flex items-center gap-2">
                <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/15">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      completed
                        ? "bg-grass"
                        : "bg-gradient-to-l from-yellow-400 to-yellow-600",
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs text-cream/70 tabular-nums">
                  {logged}/{total} תרגילים
                </span>
              </div>
            </div>
          </div>
          <ChevronLeft className="h-5 w-5 shrink-0 text-cream/60" />
        </CardContent>
      </Card>
    </Link>
  );
}
