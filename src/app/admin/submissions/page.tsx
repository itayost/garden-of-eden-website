import { createClient } from "@/lib/supabase/server";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, FileText, Salad } from "lucide-react";
import type { PreWorkoutForm, PostWorkoutForm, NutritionForm } from "@/types/database";
import {
  PreWorkoutContent,
  PostWorkoutContent,
  NutritionContent,
} from "@/components/admin/submissions/SubmissionsContent";

type PostWorkoutWithTrainer = PostWorkoutForm & { trainers: { name: string } | null };

export default async function AdminSubmissionsPage() {
  const supabase = await createClient();

  // Note: Type assertions needed due to Supabase client type inference limitations
  // with Promise.all patterns. The PostgrestVersion hint in Database type helps
  // but doesn't fully resolve builder-to-result type casting.
  const [
    { data: preWorkout },
    { data: postWorkout },
    { data: nutrition }
  ] = await Promise.all([
    supabase
      .from("pre_workout_forms")
      .select("*")
      .order("submitted_at", { ascending: false })
      .limit(1000) as unknown as { data: PreWorkoutForm[] | null },
    supabase
      .from("post_workout_forms")
      .select("*, trainers(name)")
      .order("submitted_at", { ascending: false })
      .limit(1000) as unknown as { data: PostWorkoutWithTrainer[] | null },
    supabase
      .from("nutrition_forms")
      .select("*")
      .order("submitted_at", { ascending: false })
      .limit(1000) as unknown as { data: NutritionForm[] | null },
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">שאלונים</h1>
        <p className="text-muted-foreground">
          צפייה בכל השאלונים שהוגשו
        </p>
      </div>

      <Tabs defaultValue="pre-workout">
        <TabsList className="mb-6">
          <TabsTrigger value="pre-workout" className="gap-2">
            <Activity className="h-4 w-4" />
            לפני אימון ({preWorkout?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="post-workout" className="gap-2">
            <FileText className="h-4 w-4" />
            אחרי אימון ({postWorkout?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="nutrition" className="gap-2">
            <Salad className="h-4 w-4" />
            תזונה ({nutrition?.length || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pre-workout">
          <PreWorkoutContent submissions={preWorkout || []} />
        </TabsContent>

        <TabsContent value="post-workout">
          <PostWorkoutContent submissions={postWorkout || []} />
        </TabsContent>

        <TabsContent value="nutrition">
          <NutritionContent submissions={nutrition || []} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
