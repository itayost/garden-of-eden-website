import { createClient } from "@/lib/supabase/server";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Activity, FileText, Salad } from "lucide-react";
import type { PreWorkoutForm, PostWorkoutForm, NutritionForm } from "@/types/database";

type PostWorkoutWithTrainer = PostWorkoutForm & { trainers: { name: string } | null };

export default async function AdminSubmissionsPage() {
  const supabase = await createClient();

  const [
    { data: preWorkout },
    { data: postWorkout },
    { data: nutrition }
  ] = await Promise.all([
    supabase
      .from("pre_workout_forms")
      .select("*")
      .order("submitted_at", { ascending: false })
      .limit(50) as unknown as { data: PreWorkoutForm[] | null },
    supabase
      .from("post_workout_forms")
      .select("*, trainers(name)")
      .order("submitted_at", { ascending: false })
      .limit(50) as unknown as { data: PostWorkoutWithTrainer[] | null },
    supabase
      .from("nutrition_forms")
      .select("*")
      .order("submitted_at", { ascending: false })
      .limit(50) as unknown as { data: NutritionForm[] | null },
  ]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("he-IL", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

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
          <Card>
            <CardHeader>
              <CardTitle>שאלונים לפני אימון</CardTitle>
              <CardDescription>כל השאלונים שהוגשו לפני אימונים</CardDescription>
            </CardHeader>
            <CardContent>
              {preWorkout && preWorkout.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>שם</TableHead>
                        <TableHead>גיל</TableHead>
                        <TableHead>שינה</TableHead>
                        <TableHead>תזונה</TableHead>
                        <TableHead>פציעה</TableHead>
                        <TableHead>תאריך</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preWorkout.map((form) => (
                        <TableRow key={form.id}>
                          <TableCell className="font-medium">{form.full_name}</TableCell>
                          <TableCell>{form.age || "-"}</TableCell>
                          <TableCell>{form.sleep_hours || "-"}</TableCell>
                          <TableCell>{form.nutrition_status || "-"}</TableCell>
                          <TableCell>
                            {form.recent_injury && form.recent_injury !== "אין" ? (
                              <Badge variant="destructive">יש</Badge>
                            ) : (
                              <Badge variant="secondary">אין</Badge>
                            )}
                          </TableCell>
                          <TableCell>{formatDate(form.submitted_at)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>אין שאלונים עדיין</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="post-workout">
          <Card>
            <CardHeader>
              <CardTitle>שאלונים אחרי אימון</CardTitle>
              <CardDescription>כל השאלונים שהוגשו אחרי אימונים</CardDescription>
            </CardHeader>
            <CardContent>
              {postWorkout && postWorkout.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>שם</TableHead>
                        <TableHead>מאמן</TableHead>
                        <TableHead>קושי</TableHead>
                        <TableHead>שביעות רצון</TableHead>
                        <TableHead>הערות</TableHead>
                        <TableHead>תאריך</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {postWorkout.map((form) => (
                        <TableRow key={form.id}>
                          <TableCell className="font-medium">{form.full_name}</TableCell>
                          <TableCell>
                            {form.trainers?.name || "-"}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                form.difficulty_level >= 8
                                  ? "destructive"
                                  : form.difficulty_level >= 5
                                  ? "default"
                                  : "secondary"
                              }
                            >
                              {form.difficulty_level}/10
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                form.satisfaction_level >= 8
                                  ? "default"
                                  : form.satisfaction_level >= 5
                                  ? "secondary"
                                  : "destructive"
                              }
                              className={
                                form.satisfaction_level >= 8 ? "bg-green-500" : ""
                              }
                            >
                              {form.satisfaction_level}/10
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {form.comments || "-"}
                          </TableCell>
                          <TableCell>{formatDate(form.submitted_at)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>אין שאלונים עדיין</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="nutrition">
          <Card>
            <CardHeader>
              <CardTitle>שאלוני תזונה</CardTitle>
              <CardDescription>כל שאלוני התזונה שהוגשו</CardDescription>
            </CardHeader>
            <CardContent>
              {nutrition && nutrition.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>שם</TableHead>
                        <TableHead>גיל</TableHead>
                        <TableHead>משקל</TableHead>
                        <TableHead>גובה</TableHead>
                        <TableHead>אלרגיות</TableHead>
                        <TableHead>תאריך</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {nutrition.map((form) => (
                        <TableRow key={form.id}>
                          <TableCell className="font-medium">{form.full_name}</TableCell>
                          <TableCell>{form.age}</TableCell>
                          <TableCell>{form.weight ? `${form.weight} ק"ג` : "-"}</TableCell>
                          <TableCell>{form.height ? `${form.height} מ'` : "-"}</TableCell>
                          <TableCell>
                            {form.allergies ? (
                              <Badge variant="destructive">יש</Badge>
                            ) : (
                              <Badge variant="secondary">אין</Badge>
                            )}
                          </TableCell>
                          <TableCell>{formatDate(form.submitted_at)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Salad className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>אין שאלונים עדיין</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
