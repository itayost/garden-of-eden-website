"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RepeatableRows } from "./RepeatableRows";
import type { ColumnDef } from "./RepeatableRows";
import { MuscleMultiSelect } from "./MuscleMultiSelect";
import { PositionGroupPicker } from "./PositionGroupPicker";
import type { PositionSelection } from "./PositionGroupPicker";
import {
  updateParameter,
  saveParameterDrills,
  saveParameterAgeRows,
} from "@/features/development-book/lib/actions/admin-book-parameters";
import type { AdminParameterForEdit } from "@/features/development-book/lib/actions/admin-book-parameters";
import type { BookDrill, BookAgeRow, BookMuscle } from "@/features/development-book/lib/types";

// ---------------------------------------------------------------------------
// Row shapes for RepeatableRows
// ---------------------------------------------------------------------------

type AgeGroup = "U10-12" | "U13-14" | "U15-16" | "U17+";

interface DrillRow extends Record<string, unknown> {
  id?: string;
  name_en: string;
  name_he: string;
  muscle_he: string; // kept for persistence — not shown in the editable grid
  sets_he: string;
  how_he: string;
  why_he: string;
  connect_he: string;
  muscle_ids: string[];
}

interface AgeRow extends Record<string, unknown> {
  id?: string;
  age_group: AgeGroup;
  what_he: string;
  metric_value_he: string;
  recovery_he: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function drillToRow(drill: BookDrill): DrillRow {
  return {
    id: drill.id,
    name_en: drill.nameEn ?? "",
    name_he: drill.nameHe ?? "",
    muscle_he: drill.muscleHe ?? "",
    sets_he: drill.setsHe ?? "",
    how_he: drill.howHe ?? "",
    why_he: drill.whyHe ?? "",
    connect_he: drill.connectHe ?? "",
    muscle_ids: drill.muscleIds ?? [],
  };
}

function ageRowToRow(row: BookAgeRow): AgeRow {
  return {
    id: row.id,
    age_group: row.ageGroup,
    what_he: row.whatHe ?? "",
    metric_value_he: row.metricValueHe ?? "",
    recovery_he: row.recoveryHe ?? "",
  };
}

function newDrillRow(): DrillRow {
  return {
    name_en: "",
    name_he: "",
    muscle_he: "",
    sets_he: "",
    how_he: "",
    why_he: "",
    connect_he: "",
    muscle_ids: [],
  };
}

function newAgeRow(): AgeRow {
  return {
    age_group: "U10-12" as AgeGroup,
    what_he: "",
    metric_value_he: "",
    recovery_he: "",
  };
}

function buildDrillColumns(allMuscles: BookMuscle[]): ColumnDef<DrillRow>[] {
  return [
    { key: "name_en", labelHe: "שם (אנגלית)" },
    { key: "name_he", labelHe: "שם (עברית)" },
    { key: "sets_he", labelHe: "סטים" },
    { key: "how_he", labelHe: "איך", type: "textarea" },
    { key: "why_he", labelHe: "למה", type: "textarea" },
    { key: "connect_he", labelHe: "חיבור", type: "textarea" },
    {
      key: "muscle_ids",
      labelHe: "שרירים",
      render: (row, onChange) => {
        const selected = Array.isArray(row.muscle_ids)
          ? (row.muscle_ids as string[])
          : [];
        return (
          <MuscleMultiSelect
            muscles={allMuscles}
            selected={selected}
            onChange={(ids) => onChange(ids)}
          />
        );
      },
    },
  ];
}

const AGE_ROW_COLUMNS = [
  { key: "age_group" as const, labelHe: "קבוצת גיל" },
  { key: "what_he" as const, labelHe: "מה", type: "textarea" as const },
  { key: "metric_value_he" as const, labelHe: "ערך מדד" },
  { key: "recovery_he" as const, labelHe: "התאוששות", type: "textarea" as const },
];

// ---------------------------------------------------------------------------
// Snapshot helpers for dirty tracking
// ---------------------------------------------------------------------------

interface SnapshotState {
  nameHe: string;
  number: string;
  subtitleHe: string;
  ageMetricLabel: string;
  reportTextHe: string;
  reportHighlightHe: string;
  verbalTextHe: string;
  verbalTipHe: string;
  positionSelection: PositionSelection;
  drillRows: DrillRow[];
  ageRows: AgeRow[];
}

function buildSnapshot(state: SnapshotState): string {
  return JSON.stringify(state);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ParameterFormProps {
  parameter: AdminParameterForEdit;
  allMuscles: BookMuscle[];
}

export function ParameterForm({ parameter, allMuscles }: ParameterFormProps) {
  const router = useRouter();

  // Base fields
  const [nameHe, setNameHe] = useState(parameter.nameHe);
  const [number, setNumber] = useState(
    parameter.number !== null ? String(parameter.number) : ""
  );
  const [subtitleHe, setSubtitleHe] = useState(parameter.subtitleHe ?? "");
  const [ageMetricLabel, setAgeMetricLabel] = useState(
    parameter.ageMetricLabel ?? ""
  );
  const [reportTextHe, setReportTextHe] = useState(
    parameter.reportTextHe ?? ""
  );
  const [reportHighlightHe, setReportHighlightHe] = useState(
    parameter.reportHighlightHe ?? ""
  );
  const [verbalTextHe, setVerbalTextHe] = useState(
    parameter.verbalTextHe ?? ""
  );
  const [verbalTipHe, setVerbalTipHe] = useState(parameter.verbalTipHe ?? "");

  // Positions
  const [positionSelection, setPositionSelection] = useState<PositionSelection>(
    {
      isAllPositions: parameter.isAllPositions,
      positions: parameter.positions,
    }
  );

  // Drills
  const [drillRows, setDrillRows] = useState<DrillRow[]>(
    parameter.drills.map(drillToRow)
  );

  // Age rows
  const [ageRows, setAgeRows] = useState<AgeRow[]>(
    parameter.ageRows.map(ageRowToRow)
  );

  // Single transition for the unified save
  const [isSaving, startSaveTransition] = useTransition();

  // ---------------------------------------------------------------------------
  // Dirty tracking
  // ---------------------------------------------------------------------------

  // Lazily compute the initial snapshot once at mount — avoids ref-during-render lint error.
  const [savedSnapshot, setSavedSnapshot] = useState<string>(() =>
    buildSnapshot({
      nameHe: parameter.nameHe,
      number: parameter.number !== null ? String(parameter.number) : "",
      subtitleHe: parameter.subtitleHe ?? "",
      ageMetricLabel: parameter.ageMetricLabel ?? "",
      reportTextHe: parameter.reportTextHe ?? "",
      reportHighlightHe: parameter.reportHighlightHe ?? "",
      verbalTextHe: parameter.verbalTextHe ?? "",
      verbalTipHe: parameter.verbalTipHe ?? "",
      positionSelection: {
        isAllPositions: parameter.isAllPositions,
        positions: parameter.positions,
      },
      drillRows: parameter.drills.map(drillToRow),
      ageRows: parameter.ageRows.map(ageRowToRow),
    })
  );

  const currentSnapshot = buildSnapshot({
    nameHe,
    number,
    subtitleHe,
    ageMetricLabel,
    reportTextHe,
    reportHighlightHe,
    verbalTextHe,
    verbalTipHe,
    positionSelection,
    drillRows,
    ageRows,
  });

  const isDirty = currentSnapshot !== savedSnapshot;

  // Leave guard — browser native beforeunload
  useEffect(() => {
    if (!isDirty) return;

    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isDirty]);

  // ---------------------------------------------------------------------------
  // Back navigation with dirty guard
  // ---------------------------------------------------------------------------

  const handleBack = useCallback(() => {
    if (isDirty) {
      const confirmed = window.confirm("יש שינויים שלא נשמרו. לעזוב בכל זאת?");
      if (!confirmed) return;
    }
    router.push("/admin/book");
  }, [isDirty, router]);

  // ---------------------------------------------------------------------------
  // Build base input
  // ---------------------------------------------------------------------------

  function buildBaseInput() {
    return {
      name_he: nameHe,
      number: number !== "" ? parseInt(number, 10) : null,
      subtitle_he: subtitleHe || null,
      age_metric_label: ageMetricLabel || null,
      report_text_he: reportTextHe || null,
      report_highlight_he: reportHighlightHe || null,
      verbal_text_he: verbalTextHe || null,
      verbal_tip_he: verbalTipHe || null,
      is_all_positions: positionSelection.isAllPositions,
      positions: positionSelection.positions,
    };
  }

  // ---------------------------------------------------------------------------
  // Unified save handler
  // ---------------------------------------------------------------------------

  function handleSaveAll() {
    startSaveTransition(async () => {
      // Step 1 — base fields
      const baseResult = await updateParameter(parameter.id, buildBaseInput());
      if (!("success" in baseResult)) {
        toast.error(baseResult.error ?? "שגיאה בשמירת פרטי הפרמטר");
        return;
      }

      // Step 2 — drills (with blank-row validation)
      const cleanedDrills = drillRows.filter((row) => {
        const textFields = [
          row.name_en,
          row.name_he,
          row.sets_he,
          row.how_he,
          row.why_he,
          row.connect_he,
        ];
        const hasText = textFields.some((f) => f.trim() !== "");
        const hasMuscles = row.muscle_ids.length > 0;
        return hasText || hasMuscles;
      });

      const invalidDrill = cleanedDrills.find(
        (row) => row.name_he.trim() === "" && row.name_en.trim() === ""
      );
      if (invalidDrill) {
        toast.error("יש למלא שם (עברית או אנגלית) לכל תרגיל");
        return;
      }

      const drillsResult = await saveParameterDrills(parameter.id, cleanedDrills);
      if (!("success" in drillsResult)) {
        toast.error(drillsResult.error ?? "שגיאה בשמירת התרגילים");
        return;
      }

      // Step 3 — age rows
      const ageResult = await saveParameterAgeRows(parameter.id, ageRows);
      if (!("success" in ageResult)) {
        toast.error(ageResult.error ?? "שגיאה בשמירת שורות הגיל");
        return;
      }

      // All succeeded — sync drill rows to cleaned set, update snapshot
      setDrillRows(cleanedDrills);
      setSavedSnapshot(
        buildSnapshot({
          nameHe,
          number,
          subtitleHe,
          ageMetricLabel,
          reportTextHe,
          reportHighlightHe,
          verbalTextHe,
          verbalTipHe,
          positionSelection,
          drillRows: cleanedDrills,
          ageRows,
        })
      );

      toast.success("הפרמטר נשמר בהצלחה");
    });
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-8" dir="rtl">
      {/* Back link */}
      <button
        type="button"
        onClick={handleBack}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowRight className="h-4 w-4" />
        חזרה לספר
      </button>

      {/* ------------------------------------------------------------------ */}
      {/* 1. זיהוי                                                             */}
      {/* ------------------------------------------------------------------ */}
      <Card>
        <CardHeader>
          <CardTitle>זיהוי</CardTitle>
          <CardDescription>שם, מספר, כותרת משנה ועמדות</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="name_he">שם הפרמטר (עברית)</Label>
                <Input
                  id="name_he"
                  value={nameHe}
                  onChange={(e) => setNameHe(e.target.value)}
                  placeholder="שם הפרמטר"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="number">מספר</Label>
                <Input
                  id="number"
                  type="number"
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  placeholder="מספר סידורי"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="subtitle_he">כותרת משנה</Label>
              <Input
                id="subtitle_he"
                value={subtitleHe}
                onChange={(e) => setSubtitleHe(e.target.value)}
                placeholder="כותרת משנה קצרה"
              />
            </div>

            <div className="space-y-2">
              <Label>עמדות</Label>
              <PositionGroupPicker
                value={positionSelection}
                onChange={setPositionSelection}
                disabled={isSaving}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* 2. תרגילים                                                           */}
      {/* ------------------------------------------------------------------ */}
      <Card>
        <CardHeader>
          <CardTitle>תרגילים</CardTitle>
          <CardDescription>
            תרגילים המשויכים לפרמטר זה. שורות עם מזהה קיים יעודכנו; שורות
            חדשות יתווספו; שורות שהוסרו יימחקו.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RepeatableRows<DrillRow>
            rows={drillRows}
            columns={buildDrillColumns(allMuscles)}
            onChange={setDrillRows}
            newRow={newDrillRow}
          />
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* 3. לפי גיל                                                           */}
      {/* ------------------------------------------------------------------ */}
      <Card>
        <CardHeader>
          <CardTitle>לפי גיל</CardTitle>
          <CardDescription>
            תווית מדד הגיל ונתונים לפי קבוצת גיל (U10-12, U13-14, U15-16, U17+)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="age_metric_label">תווית מדד גיל</Label>
              <Input
                id="age_metric_label"
                value={ageMetricLabel}
                onChange={(e) => setAgeMetricLabel(e.target.value)}
                placeholder='למשל: "שניות", "ס"מ"'
              />
            </div>

            <RepeatableRows<AgeRow>
              rows={ageRows}
              columns={AGE_ROW_COLUMNS}
              onChange={setAgeRows}
              newRow={newAgeRow}
            />
          </div>
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* 4. להורים                                                            */}
      {/* ------------------------------------------------------------------ */}
      <Card>
        <CardHeader>
          <CardTitle>להורים</CardTitle>
          <CardDescription>טקסטים המוצגים בדוח ההורים</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="report_text_he">טקסט דוח</Label>
              <Textarea
                id="report_text_he"
                value={reportTextHe}
                onChange={(e) => setReportTextHe(e.target.value)}
                rows={3}
                placeholder="טקסט הסבר להורים"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="report_highlight_he">הדגשת דוח</Label>
              <Input
                id="report_highlight_he"
                value={reportHighlightHe}
                onChange={(e) => setReportHighlightHe(e.target.value)}
                placeholder="משפט קצר להדגשה בדוח"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* 5. בעל פה                                                            */}
      {/* ------------------------------------------------------------------ */}
      <Card>
        <CardHeader>
          <CardTitle>בעל פה</CardTitle>
          <CardDescription>הסבר וטיפ ורבליים לשחקן</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="verbal_text_he">טקסט ורבלי</Label>
              <Textarea
                id="verbal_text_he"
                value={verbalTextHe}
                onChange={(e) => setVerbalTextHe(e.target.value)}
                rows={3}
                placeholder="הסבר ורבלי לשחקן"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="verbal_tip_he">טיפ ורבלי</Label>
              <Input
                id="verbal_tip_he"
                value={verbalTipHe}
                onChange={(e) => setVerbalTipHe(e.target.value)}
                placeholder="טיפ קצר לשחקן"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* Sticky bottom save bar                                               */}
      {/* ------------------------------------------------------------------ */}
      <div className="sticky bottom-0 z-10 flex items-center justify-between gap-4 border-t bg-background/95 px-4 py-3 backdrop-blur-sm">
        {isDirty ? (
          <span className="text-sm text-amber-600">שינויים לא נשמרו</span>
        ) : (
          <span />
        )}
        <Button
          type="button"
          onClick={handleSaveAll}
          disabled={isSaving}
        >
          {isSaving ? "שומר..." : "שמור הכל"}
        </Button>
      </div>
    </div>
  );
}
