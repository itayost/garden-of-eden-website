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
import { ClickableTableRow } from "@/components/admin/ClickableTableRow";
import { Activity, FileText, Salad, type LucideIcon } from "lucide-react";
import type { PreWorkoutForm, PostWorkoutForm, NutritionForm } from "@/types/database";

type PostWorkoutWithTrainer = PostWorkoutForm & { trainers: { name: string } | null };

// Hebrew translations for form values
const nutritionStatusTranslations: Record<string, string> = {
  full_energy: "מלא אנרגיה",
  insufficient: "לא מספיק",
  no_energy: "אין אנרגיה",
};

// Shared utilities
function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("he-IL", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function translateValue(value: string | null | undefined, translations: Record<string, string>): string {
  if (!value) return "-";
  return translations[value] || value;
}

function EmptyState({ icon: Icon, message }: { icon: LucideIcon; message: string }) {
  return (
    <div className="text-center py-8 text-muted-foreground">
      <Icon className="h-12 w-12 mx-auto mb-4 opacity-50" />
      <p>{message}</p>
    </div>
  );
}

function YesNoBadge({ value }: { value: boolean }) {
  return value ? (
    <Badge variant="destructive">יש</Badge>
  ) : (
    <Badge variant="secondary">אין</Badge>
  );
}

function DifficultyBadge({ level }: { level: number }) {
  const variant = level >= 8 ? "destructive" : level >= 5 ? "default" : "secondary";
  return <Badge variant={variant}>{level}/10</Badge>;
}

function SatisfactionBadge({ level }: { level: number }) {
  const variant = level >= 8 ? "default" : level >= 5 ? "secondary" : "destructive";
  const className = level >= 8 ? "bg-green-500" : "";
  return <Badge variant={variant} className={className}>{level}/10</Badge>;
}


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
      .limit(50) as { data: PreWorkoutForm[] | null },
    supabase
      .from("post_workout_forms")
      .select("*, trainers(name)")
      .order("submitted_at", { ascending: false })
      .limit(50) as { data: PostWorkoutWithTrainer[] | null },
    supabase
      .from("nutrition_forms")
      .select("*")
      .order("submitted_at", { ascending: false })
      .limit(50) as { data: NutritionForm[] | null },
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
          <Card>
            <CardHeader>
              <CardTitle>שאלונים לפני אימון</CardTitle>
              <CardDescription>כל השאלונים שהוגשו לפני אימונים</CardDescription>
            </CardHeader>
            <CardContent>
              {preWorkout && preWorkout.length > 0 ? (
                <div className="overflow-x-auto" dir="rtl">
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
                        <ClickableTableRow key={form.id} href={`/admin/submissions/pre-workout/${form.id}`}>
                          <TableCell className="font-medium">{form.full_name}</TableCell>
                          <TableCell>{form.age || "-"}</TableCell>
                          <TableCell>{form.sleep_hours || "-"}</TableCell>
                          <TableCell>{translateValue(form.nutrition_status, nutritionStatusTranslations)}</TableCell>
                          <TableCell>
                            <YesNoBadge value={!!(form.recent_injury && form.recent_injury !== "אין")} />
                          </TableCell>
                          <TableCell>{formatDate(form.submitted_at)}</TableCell>
                        </ClickableTableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <EmptyState icon={Activity} message="אין שאלונים עדיין" />
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
                <div className="overflow-x-auto" dir="rtl">
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
                        <ClickableTableRow key={form.id} href={`/admin/submissions/post-workout/${form.id}`}>
                          <TableCell className="font-medium">{form.full_name}</TableCell>
                          <TableCell>{form.trainers?.name || "-"}</TableCell>
                          <TableCell><DifficultyBadge level={form.difficulty_level} /></TableCell>
                          <TableCell><SatisfactionBadge level={form.satisfaction_level} /></TableCell>
                          <TableCell className="max-w-[200px] truncate">{form.comments || "-"}</TableCell>
                          <TableCell>{formatDate(form.submitted_at)}</TableCell>
                        </ClickableTableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <EmptyState icon={FileText} message="אין שאלונים עדיין" />
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
                <div className="overflow-x-auto" dir="rtl">
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
                        <ClickableTableRow key={form.id} href={`/admin/submissions/nutrition/${form.id}`}>
                          <TableCell className="font-medium">{form.full_name}</TableCell>
                          <TableCell>{form.age}</TableCell>
                          <TableCell>{form.weight ? `${form.weight} ק"ג` : "-"}</TableCell>
                          <TableCell>{form.height ? `${form.height} מ'` : "-"}</TableCell>
                          <TableCell><YesNoBadge value={form.allergies} /></TableCell>
                          <TableCell>{formatDate(form.submitted_at)}</TableCell>
                        </ClickableTableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <EmptyState icon={Salad} message="אין שאלונים עדיין" />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
