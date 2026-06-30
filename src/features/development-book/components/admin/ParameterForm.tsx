"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
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
        const selected = Array.isArray(row.muscle_ids) ? (row.muscle_ids as string[]) : [];
        return (
          <div className="flex flex-col gap-1 min-w-[120px]">
            {allMuscles.map((muscle) => {
              const checked = selected.includes(muscle.id);
              return (
                <label
                  key={muscle.id}
                  className="flex items-center gap-1.5 text-sm cursor-pointer select-none"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      const next = checked
                        ? selected.filter((id) => id !== muscle.id)
                        : [...selected, muscle.id];
                      onChange(next);
                    }}
                    className="size-3.5 accent-primary cursor-pointer"
                  />
                  <span>{muscle.nameHe}</span>
                  {muscle.emoji && (
                    <span aria-hidden="true">{muscle.emoji}</span>
                  )}
                </label>
              );
            })}
          </div>
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
// Component
// ---------------------------------------------------------------------------

interface ParameterFormProps {
  parameter: AdminParameterForEdit;
  allMuscles: BookMuscle[];
}

export function ParameterForm({ parameter, allMuscles }: ParameterFormProps) {
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

  const [isPendingBase, startBaseTransition] = useTransition();
  const [isPendingDrills, startDrillsTransition] = useTransition();
  const [isPendingAgeRows, startAgeRowsTransition] = useTransition();

  // ---------------------------------------------------------------------------
  // Save handlers
  // ---------------------------------------------------------------------------

  // Builds the full base input from current state — used by all three base sections.
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

  function handleSaveIdentity() {
    startBaseTransition(async () => {
      const result = await updateParameter(parameter.id, buildBaseInput());
      if ("success" in result) {
        toast.success("זיהוי עודכן בהצלחה");
      } else {
        toast.error(result.error ?? "שגיאה בעדכון זיהוי");
      }
    });
  }

  function handleSaveParents() {
    startBaseTransition(async () => {
      const result = await updateParameter(parameter.id, buildBaseInput());
      if ("success" in result) {
        toast.success("תוכן להורים עודכן בהצלחה");
      } else {
        toast.error(result.error ?? "שגיאה בעדכון תוכן להורים");
      }
    });
  }

  function handleSaveVerbal() {
    startBaseTransition(async () => {
      const result = await updateParameter(parameter.id, buildBaseInput());
      if ("success" in result) {
        toast.success("תוכן בעל פה עודכן בהצלחה");
      } else {
        toast.error(result.error ?? "שגיאה בעדכון תוכן בעל פה");
      }
    });
  }

  function handleSaveDrills() {
    startDrillsTransition(async () => {
      const result = await saveParameterDrills(parameter.id, drillRows);
      if ("success" in result) {
        toast.success("התרגילים נשמרו בהצלחה");
      } else {
        toast.error(result.error ?? "שגיאה בשמירת תרגילים");
      }
    });
  }

  function handleSaveAgeRows() {
    startAgeRowsTransition(async () => {
      const result = await saveParameterAgeRows(parameter.id, ageRows);
      if ("success" in result) {
        toast.success("שורות הגיל נשמרו בהצלחה");
      } else {
        toast.error(result.error ?? "שגיאה בשמירת שורות גיל");
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-8" dir="rtl">
      {/* ------------------------------------------------------------------ */}
      {/* 1. זיהוי                                                             */}
      {/* ------------------------------------------------------------------ */}
      <Card>
        <CardHeader>
          <CardTitle>זיהוי</CardTitle>
          <CardDescription>שם, מספר, כותרת משנה, תווית מדד גיל ועמדות</CardDescription>
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

            <div className="space-y-1.5">
              <Label htmlFor="age_metric_label">תווית מדד גיל</Label>
              <Input
                id="age_metric_label"
                value={ageMetricLabel}
                onChange={(e) => setAgeMetricLabel(e.target.value)}
                placeholder='למשל: "שניות", "ס"מ"'
              />
            </div>

            <div className="space-y-2">
              <Label>עמדות</Label>
              <PositionGroupPicker
                value={positionSelection}
                onChange={setPositionSelection}
                disabled={isPendingBase}
              />
            </div>

            <div className="flex justify-start pt-2">
              <Button
                type="button"
                onClick={handleSaveIdentity}
                disabled={isPendingBase}
              >
                {isPendingBase ? "שומר..." : "שמור זיהוי"}
              </Button>
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
          <div className="space-y-4">
            <RepeatableRows<DrillRow>
              rows={drillRows}
              columns={buildDrillColumns(allMuscles)}
              onChange={setDrillRows}
              newRow={newDrillRow}
            />

            <div className="flex justify-start pt-2">
              <Button
                type="button"
                onClick={handleSaveDrills}
                disabled={isPendingDrills}
              >
                {isPendingDrills ? "שומר..." : "שמור תרגילים"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* 3. לפי גיל                                                           */}
      {/* ------------------------------------------------------------------ */}
      <Card>
        <CardHeader>
          <CardTitle>לפי גיל</CardTitle>
          <CardDescription>
            נתונים לפי קבוצת גיל (U10-12, U13-14, U15-16, U17+)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <RepeatableRows<AgeRow>
              rows={ageRows}
              columns={AGE_ROW_COLUMNS}
              onChange={setAgeRows}
              newRow={newAgeRow}
            />

            <div className="flex justify-start pt-2">
              <Button
                type="button"
                onClick={handleSaveAgeRows}
                disabled={isPendingAgeRows}
              >
                {isPendingAgeRows ? "שומר..." : "שמור לפי גיל"}
              </Button>
            </div>
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

            <div className="flex justify-start pt-2">
              <Button
                type="button"
                onClick={handleSaveParents}
                disabled={isPendingBase}
              >
                {isPendingBase ? "שומר..." : "שמור להורים"}
              </Button>
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

            <div className="flex justify-start pt-2">
              <Button
                type="button"
                onClick={handleSaveVerbal}
                disabled={isPendingBase}
              >
                {isPendingBase ? "שומר..." : "שמור בעל פה"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
