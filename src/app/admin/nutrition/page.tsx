import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Edit, Users, Utensils, Lightbulb } from "lucide-react";
export default async function AdminNutritionPage() {
  const supabase = await createClient();

  const [{ data: trainees }, { data: mealPlans }, { data: recommendations }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, role")
        .eq("role", "trainee")
        .is("deleted_at", null)
        .order("full_name") as unknown as {
        data: { id: string; full_name: string | null; role: string }[] | null;
      },
      supabase
        .from("trainee_meal_plans")
        .select("id, user_id")
        .is("deleted_at", null) as unknown as {
        data: { id: string; user_id: string }[] | null;
      },
      supabase
        .from("nutrition_recommendations")
        .select("id, user_id")
        .is("deleted_at", null) as unknown as {
        data: { id: string; user_id: string }[] | null;
      },
    ]);

  const mealPlanUserIds = new Set(
    (mealPlans || []).map((mp) => mp.user_id)
  );
  const recommendationUserIds = new Set(
    (recommendations || []).map((rec) => rec.user_id)
  );

  const totalTrainees = trainees?.length || 0;
  const traineesWithMealPlans =
    trainees?.filter((t) => mealPlanUserIds.has(t.id)).length || 0;
  const traineesWithRecommendations =
    trainees?.filter((t) => recommendationUserIds.has(t.id)).length || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">ניהול תזונה</h1>
        <p className="text-muted-foreground">
          תוכניות תזונה והמלצות אישיות לחניכים
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">סה&quot;כ חניכים</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTrainees}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              עם תוכנית תזונה
            </CardTitle>
            <Utensils className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{traineesWithMealPlans}</div>
            <p className="text-xs text-muted-foreground">
              {totalTrainees > 0
                ? `${Math.round((traineesWithMealPlans / totalTrainees) * 100)}%`
                : "0%"}{" "}
              מהחניכים
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">עם המלצות</CardTitle>
            <Lightbulb className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {traineesWithRecommendations}
            </div>
            <p className="text-xs text-muted-foreground">
              {totalTrainees > 0
                ? `${Math.round((traineesWithRecommendations / totalTrainees) * 100)}%`
                : "0%"}{" "}
              מהחניכים
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Trainees Table */}
      <Card>
        <CardHeader>
          <CardTitle>חניכים</CardTitle>
        </CardHeader>
        <CardContent>
          {trainees && trainees.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-start">שם</TableHead>
                  <TableHead className="text-start">תוכנית תזונה</TableHead>
                  <TableHead className="text-start">המלצות</TableHead>
                  <TableHead className="text-start">פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trainees.map((trainee) => {
                  const hasMealPlan = mealPlanUserIds.has(trainee.id);
                  const hasRecommendation = recommendationUserIds.has(
                    trainee.id
                  );

                  return (
                    <TableRow key={trainee.id}>
                      <TableCell className="font-medium">
                        {trainee.full_name || "ללא שם"}
                      </TableCell>
                      <TableCell>
                        {hasMealPlan ? (
                          <Badge
                            variant="default"
                            className="bg-green-600"
                          >
                            קיימת
                          </Badge>
                        ) : (
                          <Badge variant="outline">אין</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {hasRecommendation ? (
                          <Badge
                            variant="default"
                            className="bg-blue-600"
                          >
                            קיימות
                          </Badge>
                        ) : (
                          <Badge variant="outline">אין</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button asChild size="sm">
                          <Link href={`/admin/nutrition/${trainee.id}`}>
                            <Edit className="h-4 w-4 ml-1" />
                            ניהול
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              אין חניכים רשומים
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
