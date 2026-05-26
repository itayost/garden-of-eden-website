import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { typedFrom } from "@/lib/supabase/helpers";
import { isValidUUID } from "@/lib/utils/uuid";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowRight, Activity, Brain, FileText, Salad, User, Calendar } from "lucide-react";
import type { PreWorkoutForm, PostWorkoutForm, NutritionForm } from "@/types/database";
import type { MentalQuestionnaire } from "@/lib/actions/admin-submissions-list";

// Form type configuration
const formTypeConfig = {
  "pre-workout": {
    table: "pre_workout_forms",
    title: "שאלון לפני אימון",
    icon: Activity,
  },
  "post-workout": {
    table: "post_workout_forms",
    title: "שאלון אחרי אימון",
    icon: FileText,
  },
  "nutrition": {
    table: "nutrition_forms",
    title: "שאלון תזונה",
    icon: Salad,
  },
  "mental": {
    table: "mental_questionnaires",
    title: "שאלון מנטלי",
    icon: Brain,
  },
} as const;

type FormType = keyof typeof formTypeConfig;

interface FormDetailPageProps {
  params: Promise<{ formType: string; formId: string }>;
}

// Hebrew translations for form values
const translations = {
  groupTraining: {
    before: "כן, לפני האימון",
    after: "כן, אחרי האימון",
    no: "לא",
  } as Record<string, string>,
  urineColor: {
    clear: "שקוף",
    light_yellow: "צהוב בהיר",
    dark_yellow: "צהוב כהה",
    unknown: "לא יודע",
  } as Record<string, string>,
  nutritionStatus: {
    full_energy: "מלא אנרגיה",
    insufficient: "לא מספיק, ישלים אחרי האימון",
    no_energy: "אין אנרגיה, מעדיף אימון קל",
  } as Record<string, string>,
  sleepHours: {
    "4-6": "4-6 שעות (איכות ירודה)",
    "6-8": "6-8 שעות (סביר)",
    "8-11": "8-11 שעות (טוב)",
  } as Record<string, string>,
  nextMatch: {
    this_weekend: "הסוף שבוע הזה",
    next_weekend: "הסוף שבוע הבא",
    midweek: "באמצע השבוע",
  } as Record<string, string>,
  yearsCompetitive: {
    first_year: "שנה ראשונה",
    up_to_3: "עד 3 שנים",
    up_to_6: "עד 6 שנים",
    "7_plus": "7+ שנים",
  } as Record<string, string>,
  medications: {
    no: "לא",
    yes: "כן",
    occasionally: "מדי פעם",
  } as Record<string, string>,
};

function translateValue(value: string | null | undefined, translationMap: Record<string, string>): string | null {
  if (!value) return null;
  return translationMap[value] || value;
}

// Helper component for consistent field display
function FieldRow({ label, value, children }: { label: string; value?: string | number | null; children?: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center py-2">
      <span className="text-muted-foreground text-sm">{label}</span>
      {children || <span className="text-sm font-medium">{value ?? "---"}</span>}
    </div>
  );
}

// Format date in Hebrew locale
function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("he-IL", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

// Shared badge components
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

// Pre-workout form fields renderer
function PreWorkoutFields({ form }: { form: PreWorkoutForm }) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* מידע אישי */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-5 w-5" />
            מידע אישי
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <FieldRow label="שם מלא" value={form.full_name} />
          <Separator />
          <FieldRow label="גיל" value={form.age != null ? `${form.age} שנים` : null} />
          <Separator />
          <FieldRow label="אימון קבוצתי" value={translateValue(form.group_training, translations.groupTraining)} />
        </CardContent>
      </Card>

      {/* מצב גופני */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-5 w-5" />
            מצב גופני
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <FieldRow label="צבע שתן" value={translateValue(form.urine_color, translations.urineColor)} />
          <Separator />
          <FieldRow label="מצב תזונתי" value={translateValue(form.nutrition_status, translations.nutritionStatus)} />
          <Separator />
          <FieldRow label="שעות שינה" value={translateValue(form.sleep_hours, translations.sleepHours)} />
          <Separator />
          <FieldRow label="פציעה אחרונה">
            {form.recent_injury && form.recent_injury !== "אין" ? (
              <Badge variant="destructive">{form.recent_injury}</Badge>
            ) : (
              <Badge variant="secondary">אין</Badge>
            )}
          </FieldRow>
        </CardContent>
      </Card>

      {/* משחקים ושיפורים */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-5 w-5" />
            משחקים ושיפורים
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <FieldRow label="משחק אחרון" value={form.last_game} />
          <Separator />
          <FieldRow label="משחק הבא" value={translateValue(form.next_match, translations.nextMatch)} />
          <Separator />
          <FieldRow label="שיפורים רצויים" value={form.improvements_desired} />
        </CardContent>
      </Card>
    </div>
  );
}

// Post-workout form fields renderer
type PostWorkoutWithTrainer = PostWorkoutForm & { trainer: { full_name: string } | null };

function PostWorkoutFields({ form }: { form: PostWorkoutWithTrainer }) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* מידע כללי */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-5 w-5" />
            מידע כללי
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <FieldRow label="שם מלא" value={form.full_name} />
          <Separator />
          <FieldRow label="תאריך אימון" value={form.training_date ? new Date(form.training_date).toLocaleDateString("he-IL") : null} />
          <Separator />
          <FieldRow label="מאמן" value={form.trainer?.full_name} />
          <Separator />
          <FieldRow label="פרטי קשר" value={form.contact_info} />
        </CardContent>
      </Card>

      {/* הערכת אימון */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-5 w-5" />
            הערכת אימון
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <FieldRow label="רמת קושי">
            <DifficultyBadge level={form.difficulty_level} />
          </FieldRow>
          <Separator />
          <FieldRow label="שביעות רצון">
            <SatisfactionBadge level={form.satisfaction_level} />
          </FieldRow>
        </CardContent>
      </Card>

      {/* הערות */}
      {form.comments && (
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">הערות</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{form.comments}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

type NutritionFormWithProfile = NutritionForm & {
  profile: { full_name: string; birthdate: string | null } | null;
};

function calcAge(birthdate: string | null): string | null {
  if (!birthdate) return null;
  const today = new Date();
  const birth = new Date(birthdate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return `${age} שנים`;
}

// Nutrition form fields renderer
function NutritionFields({ form }: { form: NutritionFormWithProfile }) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* מידע אישי */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">מידע אישי</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <FieldRow label="שם מלא" value={form.profile?.full_name} />
          <Separator />
          <FieldRow label="גיל" value={calcAge(form.profile?.birthdate ?? null)} />
          <Separator />
          <FieldRow label="שנים בספורט תחרותי" value={translateValue(form.years_competitive, translations.yearsCompetitive)} />
        </CardContent>
      </Card>

      {/* מדדים פיזיים */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">מדדים פיזיים</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <FieldRow label="משקל" value={form.weight ? `${form.weight} ק"ג` : null} />
          <Separator />
          <FieldRow label="גובה" value={form.height ? `${form.height} ס״מ` : null} />
        </CardContent>
      </Card>

      {/* רקע רפואי */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">רקע רפואי</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <FieldRow label="אלרגיות">
            <YesNoBadge value={form.allergies} />
          </FieldRow>
          {form.allergies_details && (
            <>
              <Separator />
              <FieldRow label="פירוט אלרגיות" value={form.allergies_details} />
            </>
          )}
          <Separator />
          <FieldRow label="מחלות כרוניות">
            <YesNoBadge value={form.chronic_conditions} />
          </FieldRow>
          {form.conditions_details && (
            <>
              <Separator />
              <FieldRow label="פירוט מחלות" value={form.conditions_details} />
            </>
          )}
        </CardContent>
      </Card>

      {/* תרופות */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">תרופות</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <FieldRow label="נוטל תרופות" value={translateValue(form.medications, translations.medications)} />
          {form.medications_list && (
            <>
              <Separator />
              <FieldRow label="רשימת תרופות" value={form.medications_list} />
            </>
          )}
        </CardContent>
      </Card>

      {/* ייעוץ קודם */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">ייעוץ קודם</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <FieldRow label="ייעוץ תזונתי קודם">
            {form.previous_counseling ? (
              <Badge>כן</Badge>
            ) : (
              <Badge variant="secondary">לא</Badge>
            )}
          </FieldRow>
          {form.counseling_details && (
            <>
              <Separator />
              <FieldRow label="פירוט ייעוץ" value={form.counseling_details} />
            </>
          )}
        </CardContent>
      </Card>

      {/* הערות נוספות */}
      {form.additional_comments && (
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">הערות נוספות</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{form.additional_comments}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Mental questionnaire fields renderer
function MentalFields({ form }: { form: MentalQuestionnaire }) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Brain className="h-5 w-5" />
            תובנות מהאימון המנטלי
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-muted-foreground text-sm mb-1">מסקנה מהאימון המנטלי האחרון</p>
            <p className="text-sm whitespace-pre-wrap">{form.last_session_conclusion || "—"}</p>
          </div>
          <Separator />
          <div>
            <p className="text-muted-foreground text-sm mb-1">חידוש בעניין המנטלי</p>
            <p className="text-sm whitespace-pre-wrap">{form.mental_insight || "—"}</p>
          </div>
          <Separator />
          <div>
            <p className="text-muted-foreground text-sm mb-1">כלי שייקח להמשך</p>
            <p className="text-sm whitespace-pre-wrap">{form.tool_to_take || "—"}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">מפגש הזום</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <FieldRow label="הרגשה במהלך הזום" value={form.zoom_feeling} />
          <Separator />
          <FieldRow label="רוצה יותר מפגשי זום">
            {form.wants_more_zoom == null ? (
              <span className="text-sm font-medium">—</span>
            ) : (
              <YesNoBadge value={form.wants_more_zoom} />
            )}
          </FieldRow>
          <Separator />
          <FieldRow label="רוצה ליווי 1-על-1 עם עומר">
            {form.wants_one_on_one == null ? (
              <span className="text-sm font-medium">—</span>
            ) : (
              <YesNoBadge value={form.wants_one_on_one} />
            )}
          </FieldRow>
        </CardContent>
      </Card>
    </div>
  );
}

export default async function FormDetailPage({ params }: FormDetailPageProps) {
  const { formType, formId } = await params;

  // Validate formType
  if (!Object.keys(formTypeConfig).includes(formType)) {
    notFound();
  }

  const validFormType = formType as FormType;
  const config = formTypeConfig[validFormType];

  // Validate formId is a proper UUID
  if (!isValidUUID(formId)) {
    notFound();
  }

  const supabase = await createClient();

  // Get current user and verify admin role
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

  if (currentProfile?.role !== "admin" && currentProfile?.role !== "trainer") {
    redirect("/dashboard");
  }

  // Fetch form data based on type
  let formData:
    | PreWorkoutForm
    | PostWorkoutWithTrainer
    | NutritionFormWithProfile
    | MentalQuestionnaire
    | null = null;

  if (validFormType === "post-workout") {
    const { data } = await supabase
      .from("post_workout_forms")
      .select("*, trainer:profiles!post_workout_forms_trainer_id_fkey(full_name)")
      .eq("id", formId)
      .single();
    formData = data as PostWorkoutWithTrainer | null;
  } else if (validFormType === "nutrition") {
    const { data } = await supabase
      .from("nutrition_forms")
      .select("*, profile:profiles!nutrition_forms_user_id_fkey(full_name, birthdate)")
      .eq("id", formId)
      .single();
    formData = data as NutritionFormWithProfile | null;
  } else if (validFormType === "mental") {
    const { data } = await typedFrom(supabase, "mental_questionnaires")
      .select("*")
      .eq("id", formId)
      .single();
    formData = data as MentalQuestionnaire | null;
  } else {
    const { data } = await supabase
      .from("pre_workout_forms")
      .select("*")
      .eq("id", formId)
      .single();
    formData = data as PreWorkoutForm | null;
  }

  if (!formData) {
    notFound();
  }

  const Icon = config.icon;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Link
              href="/admin/submissions"
              className="hover:text-foreground transition-colors"
            >
              שאלונים
            </Link>
            <ArrowRight className="h-4 w-4 rotate-180" />
            <span>{config.title}</span>
          </div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Icon className="h-8 w-8" />
            {config.title}
          </h1>
        </div>
        <Button variant="outline" asChild>
          <Link href="/admin/submissions">
            <ArrowRight className="ml-2 h-4 w-4" />
            חזרה לרשימה
          </Link>
        </Button>
      </div>

      {/* Metadata Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">מידע על הגשה</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground text-sm">תאריך הגשה</span>
            <span className="text-sm font-medium">{formatDate(formData.submitted_at)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground text-sm">מזהה משתמש</span>
            <Badge variant="outline" className="font-mono text-xs">
              {formData.user_id.slice(0, 8)}...
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Form Fields */}
      {validFormType === "pre-workout" && (
        <PreWorkoutFields form={formData as PreWorkoutForm} />
      )}
      {validFormType === "post-workout" && (
        <PostWorkoutFields form={formData as PostWorkoutWithTrainer} />
      )}
      {validFormType === "nutrition" && (
        <NutritionFields form={formData as NutritionFormWithProfile} />
      )}
      {validFormType === "mental" && (
        <MentalFields form={formData as MentalQuestionnaire} />
      )}
    </div>
  );
}
