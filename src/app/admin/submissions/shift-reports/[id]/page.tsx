import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
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
import {
  ArrowRight,
  ClipboardCheck,
  User,
  AlertTriangle,
  Trophy,
  Users,
  Building,
  Pencil,
} from "lucide-react";
import type { TrainerShiftReport } from "@/types/database";

interface ShiftReportDetailPageProps {
  params: Promise<{ id: string }>;
}

function YesNoBadge({ value, yesLabel, noLabel }: { value: boolean; yesLabel?: string; noLabel?: string }) {
  return value ? (
    <Badge variant="destructive">{yesLabel || "כן"}</Badge>
  ) : (
    <Badge variant="secondary">{noLabel || "לא"}</Badge>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between items-start py-2">
      <span className="text-muted-foreground text-sm">{label}</span>
      <div className="text-sm font-medium text-left">{children}</div>
    </div>
  );
}

function TraineeNames({ ids, traineeMap }: { ids: string[]; traineeMap: Map<string, string> }) {
  if (!ids || ids.length === 0) return <span className="text-muted-foreground">---</span>;
  return (
    <div className="flex flex-wrap gap-1 justify-end">
      {ids.map((id) => (
        <Badge key={id} variant="outline" className="text-xs">
          {traineeMap.get(id) || id.slice(0, 8)}
        </Badge>
      ))}
    </div>
  );
}

/** Renders a section for a yes/no question with trainee IDs and details */
function ReportSection({
  label,
  isYes,
  traineeIds,
  details,
  traineeMap,
}: {
  label: string;
  isYes: boolean;
  traineeIds?: string[];
  details: string | null;
  traineeMap: Map<string, string>;
}) {
  return (
    <>
      <FieldRow label={label}>
        <YesNoBadge value={isYes} />
      </FieldRow>
      {isYes && traineeIds && traineeIds.length > 0 && (
        <>
          <Separator />
          <FieldRow label="מתאמנים">
            <TraineeNames ids={traineeIds} traineeMap={traineeMap} />
          </FieldRow>
        </>
      )}
      {isYes && details && (
        <>
          <Separator />
          <div className="py-2">
            <span className="text-muted-foreground text-sm block mb-1">פרטים</span>
            <p className="text-sm whitespace-pre-wrap">{details}</p>
          </div>
        </>
      )}
    </>
  );
}

export default async function ShiftReportDetailPage({ params }: ShiftReportDetailPageProps) {
  const { id } = await params;

  if (!isValidUUID(id)) {
    notFound();
  }

  const supabase = await createClient();

  // Verify auth
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  if (!currentUser) {
    redirect("/auth/login");
  }

  const { data: currentProfile } = (await supabase
    .from("profiles")
    .select("role")
    .eq("id", currentUser.id)
    .single()) as { data: { role: string } | null };

  if (currentProfile?.role !== "admin" && currentProfile?.role !== "trainer") {
    redirect("/dashboard");
  }

  // Fetch report
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: report } = await (supabase as any)
    .from("trainer_shift_reports")
    .select("*")
    .eq("id", id)
    .single() as { data: TrainerShiftReport | null };

  if (!report) {
    notFound();
  }

  // Collect all trainee IDs from the report
  const allTraineeIds = new Set<string>();
  const traineeFields = [
    report.new_trainees_ids,
    report.discipline_trainee_ids,
    report.injuries_trainee_ids,
    report.limitations_trainee_ids,
    report.achievements_trainee_ids,
    report.mental_state_trainee_ids,
    report.complaints_trainee_ids,
    report.insufficient_attention_trainee_ids,
    report.pro_candidates_trainee_ids,
  ];
  for (const ids of traineeFields) {
    if (ids) {
      for (const tid of ids) {
        allTraineeIds.add(tid);
      }
    }
  }

  // Fetch trainee names
  const traineeMap = new Map<string, string>();
  if (allTraineeIds.size > 0) {
    const { data: trainees } = (await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", Array.from(allTraineeIds))) as unknown as {
      data: { id: string; full_name: string | null }[] | null;
    };
    if (trainees) {
      for (const t of trainees) {
        traineeMap.set(t.id, t.full_name || "ללא שם");
      }
    }
  }

  const isOwner = currentUser.id === report.trainer_id;
  const today = new Date().toISOString().split("T")[0];
  const canEdit = isOwner && report.report_date === today;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Link
              href="/admin/submissions?tab=shift-reports"
              className="hover:text-foreground transition-colors"
            >
              דוחות משמרת
            </Link>
            <ArrowRight className="h-4 w-4 rotate-180" />
            <span>דוח סוף משמרת</span>
          </div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <ClipboardCheck className="h-8 w-8" />
            דוח סוף משמרת
          </h1>
        </div>
        <div className="flex gap-2">
          {canEdit && (
            <Button variant="outline" asChild>
              <Link href="/admin/end-of-shift">
                <Pencil className="ml-2 h-4 w-4" />
                עריכה
              </Link>
            </Button>
          )}
          <Button variant="outline" asChild>
            <Link href="/admin/submissions?tab=shift-reports">
              <ArrowRight className="ml-2 h-4 w-4" />
              חזרה
            </Link>
          </Button>
        </div>
      </div>

      {/* Metadata */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-5 w-5" />
            מידע על הדוח
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <FieldRow label="מאמן">
            <span>{report.trainer_name}</span>
          </FieldRow>
          <Separator />
          <FieldRow label="תאריך דוח">
            <span>{new Date(report.report_date).toLocaleDateString("he-IL")}</span>
          </FieldRow>
          <Separator />
          <FieldRow label="הוגש">
            <span>
              {new Date(report.submitted_at).toLocaleDateString("he-IL", {
                day: "numeric",
                month: "long",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </FieldRow>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Step 1: Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-5 w-5" />
              מתאמנים חדשים
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <ReportSection
              label="אימון מתאמנים חדשים"
              isYes={report.trained_new_trainees}
              traineeIds={report.new_trainees_ids}
              details={report.new_trainees_details}
              traineeMap={traineeMap}
            />
          </CardContent>
        </Card>

        {/* Step 2: Issues */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-5 w-5" />
              בעיות מתאמנים
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <ReportSection
              label="בעיות משמעת"
              isYes={report.has_discipline_issues}
              traineeIds={report.discipline_trainee_ids}
              details={report.discipline_details}
              traineeMap={traineeMap}
            />
            <Separator />
            <ReportSection
              label="פציעות"
              isYes={report.has_injuries}
              traineeIds={report.injuries_trainee_ids}
              details={report.injuries_details}
              traineeMap={traineeMap}
            />
            <Separator />
            <ReportSection
              label="מגבלות פיזיות"
              isYes={report.has_physical_limitations}
              traineeIds={report.limitations_trainee_ids}
              details={report.limitations_details}
              traineeMap={traineeMap}
            />
          </CardContent>
        </Card>

        {/* Step 3: Positives & Wellbeing */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="h-5 w-5" />
              הישגים ורווחה
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <ReportSection
              label="הישגים יוצאי דופן"
              isYes={report.has_achievements}
              traineeIds={report.achievements_trainee_ids}
              details={report.achievements_details}
              traineeMap={traineeMap}
            />
            <Separator />
            <ReportSection
              label="מצב נפשי ירוד"
              isYes={report.has_poor_mental_state}
              traineeIds={report.mental_state_trainee_ids}
              details={report.mental_state_details}
              traineeMap={traineeMap}
            />
            <Separator />
            <ReportSection
              label="תלונות על אימון"
              isYes={report.has_complaints}
              traineeIds={report.complaints_trainee_ids}
              details={report.complaints_details}
              traineeMap={traineeMap}
            />
            <Separator />
            <ReportSection
              label="תשומת לב לא מספקת"
              isYes={report.has_insufficient_attention}
              traineeIds={report.insufficient_attention_trainee_ids}
              details={report.insufficient_attention_details}
              traineeMap={traineeMap}
            />
            <Separator />
            <ReportSection
              label="מועמד לתוכנית PRO"
              isYes={report.has_pro_candidates}
              traineeIds={report.pro_candidates_trainee_ids}
              details={report.pro_candidates_details}
              traineeMap={traineeMap}
            />
          </CardContent>
        </Card>

        {/* Step 4: Parents */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-5 w-5" />
              הורים ומבקרים
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <ReportSection
              label="הורה חיפש איש צוות"
              isYes={report.has_parent_seeking_staff}
              details={report.parent_seeking_details}
              traineeMap={traineeMap}
            />
            <Separator />
            <ReportSection
              label="אנשים חיצוניים באזור"
              isYes={report.has_external_visitors}
              details={report.external_visitors_details}
              traineeMap={traineeMap}
            />
            <Separator />
            <ReportSection
              label="תלונות הורים"
              isYes={report.has_parent_complaints}
              details={report.parent_complaints_details}
              traineeMap={traineeMap}
            />
          </CardContent>
        </Card>

        {/* Step 5: Facility */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building className="h-5 w-5" />
              מתקן
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <FieldRow label="מתקן נשאר מסודר ונקי">
              <YesNoBadge
                value={report.facility_left_clean}
                yesLabel="כן"
                noLabel="לא"
              />
            </FieldRow>
            {!report.facility_left_clean && report.facility_not_clean_reason && (
              <>
                <Separator />
                <div className="py-2">
                  <span className="text-muted-foreground text-sm block mb-1">סיבה</span>
                  <p className="text-sm whitespace-pre-wrap">{report.facility_not_clean_reason}</p>
                </div>
              </>
            )}
            <Separator />
            <FieldRow label="ניקיון כנדרש (ב׳/ד׳/ו׳)">
              <YesNoBadge
                value={report.facility_cleaned_scheduled}
                yesLabel="כן"
                noLabel="לא"
              />
            </FieldRow>
            {!report.facility_cleaned_scheduled && report.facility_not_cleaned_reason && (
              <>
                <Separator />
                <div className="py-2">
                  <span className="text-muted-foreground text-sm block mb-1">סיבה</span>
                  <p className="text-sm whitespace-pre-wrap">{report.facility_not_cleaned_reason}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
