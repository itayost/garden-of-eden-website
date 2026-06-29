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
import { DrillPhasesEditor } from "./DrillPhasesEditor";
import type { PhaseRow, PhasePointRow } from "./DrillPhasesEditor";
import {
  updateDrill,
  upsertDrillCard,
  saveFailureSteps,
  savePhases,
  saveMetrics,
} from "@/features/development-book/lib/actions/admin-book-drills";
import type { BookDrill, BookDrillCard, FailureStep, CardPhase, CardMetric } from "@/features/development-book/lib/types";

// ---------------------------------------------------------------------------
// Row shapes for RepeatableRows
// ---------------------------------------------------------------------------

interface FailureStepRow extends Record<string, unknown> {
  text_he: string;
  is_final: boolean;
}

interface MetricRow extends Record<string, unknown> {
  label_he: string;
  before_he: string;
  target_he: string;
}

// ---------------------------------------------------------------------------
// Column defs
// ---------------------------------------------------------------------------

const FAILURE_STEP_COLUMNS = [
  { key: "text_he" as const, labelHe: "טקסט", type: "textarea" as const },
  { key: "is_final" as const, labelHe: "סופי", type: "checkbox" as const },
];

const METRIC_COLUMNS = [
  { key: "label_he" as const, labelHe: "תווית" },
  { key: "before_he" as const, labelHe: "לפני" },
  { key: "target_he" as const, labelHe: "יעד" },
];

// ---------------------------------------------------------------------------
// Converters: domain types → form row types
// ---------------------------------------------------------------------------

function failureStepToRow(step: FailureStep): FailureStepRow {
  return {
    text_he: step.textHe,
    is_final: step.isFinal,
  };
}

function metricToRow(metric: CardMetric): MetricRow {
  return {
    label_he: metric.labelHe,
    before_he: metric.beforeHe ?? "",
    target_he: metric.targetHe ?? "",
  };
}

function phaseToFormRow(phase: CardPhase): PhaseRow {
  return {
    number: phase.number !== null ? String(phase.number) : "",
    name_he: phase.nameHe,
    subtitle_he: phase.subtitleHe ?? "",
    drill_note_he: phase.drillNoteHe ?? "",
    points: phase.points.map((pt) => ({ text_he: pt.textHe }) as PhasePointRow),
  };
}

// ---------------------------------------------------------------------------
// New row factories
// ---------------------------------------------------------------------------

function newFailureStepRow(): FailureStepRow {
  return { text_he: "", is_final: false };
}

function newMetricRow(): MetricRow {
  return { label_he: "", before_he: "", target_he: "" };
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DrillCardFormProps {
  drill: BookDrill;
  card: BookDrillCard | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DrillCardForm({ drill, card }: DrillCardFormProps) {
  // Drill base fields
  const [nameEn, setNameEn] = useState(drill.nameEn ?? "");
  const [nameHe, setNameHe] = useState(drill.nameHe ?? "");
  const [muscleHe, setMuscleHe] = useState(drill.muscleHe ?? "");
  const [setsHe, setSetsHe] = useState(drill.setsHe ?? "");
  const [howHe, setHowHe] = useState(drill.howHe ?? "");
  const [whyHe, setWhyHe] = useState(drill.whyHe ?? "");
  const [connectHe, setConnectHe] = useState(drill.connectHe ?? "");

  // Card base fields
  const [situationLabelHe, setSituationLabelHe] = useState(card?.situationLabelHe ?? "");
  const [subtitleHe, setSubtitleHe] = useState(card?.subtitleHe ?? "");
  const [ageMinLabel, setAgeMinLabel] = useState(card?.ageMinLabel ?? "");
  const [levelLabel, setLevelLabel] = useState(card?.levelLabel ?? "");
  const [goldenRuleHe, setGoldenRuleHe] = useState(card?.goldenRuleHe ?? "");

  // Card sub-collections
  const [failureStepRows, setFailureStepRows] = useState<FailureStepRow[]>(
    card ? card.failureSteps.map(failureStepToRow) : []
  );
  const [phases, setPhases] = useState<PhaseRow[]>(
    card ? card.phases.map(phaseToFormRow) : []
  );
  const [metricRows, setMetricRows] = useState<MetricRow[]>(
    card ? card.metrics.map(metricToRow) : []
  );

  const [isPendingDrill, startDrillTransition] = useTransition();
  const [isPendingCard, startCardTransition] = useTransition();

  // ---------------------------------------------------------------------------
  // Save drill base
  // ---------------------------------------------------------------------------

  function handleSaveDrill() {
    startDrillTransition(async () => {
      const result = await updateDrill(drill.id, {
        name_en: nameEn || null,
        name_he: nameHe || null,
        muscle_he: muscleHe || null,
        sets_he: setsHe || null,
        how_he: howHe || null,
        why_he: whyHe || null,
        connect_he: connectHe || null,
      });

      if ("success" in result) {
        toast.success("פרטי התרגיל עודכנו בהצלחה");
      } else {
        toast.error(result.error ?? "שגיאה בעדכון התרגיל");
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Save card (base + all sub-collections sequentially)
  // ---------------------------------------------------------------------------

  function handleSaveCard() {
    startCardTransition(async () => {
      // Step 1: upsert card base, get cardId
      const cardResult = await upsertDrillCard(drill.id, {
        situation_label_he: situationLabelHe || null,
        subtitle_he: subtitleHe || null,
        age_min_label: ageMinLabel || null,
        level_label: levelLabel || null,
        golden_rule_he: goldenRuleHe || null,
      });

      if ("error" in cardResult) {
        toast.error(cardResult.error ?? "שגיאה בשמירת כרטיס");
        return;
      }

      const cardId = cardResult.cardId;

      // Step 2: save sub-collections in parallel (each is fully independent)
      const [stepsResult, phasesResult, metricsResult] = await Promise.all([
        saveFailureSteps(
          cardId,
          failureStepRows.map((r) => ({
            text_he: r.text_he,
            is_final: Boolean(r.is_final),
          }))
        ),
        savePhases(
          cardId,
          phases.map((ph) => ({
            number: ph.number !== "" ? parseInt(ph.number, 10) : null,
            name_he: ph.name_he,
            subtitle_he: ph.subtitle_he || null,
            drill_note_he: ph.drill_note_he || null,
            points: (ph.points as PhasePointRow[]).map((pt) => ({
              text_he: pt.text_he,
            })),
          }))
        ),
        saveMetrics(
          cardId,
          metricRows.map((r) => ({
            label_he: r.label_he,
            before_he: r.before_he || null,
            target_he: r.target_he || null,
          }))
        ),
      ]);

      const firstError =
        ("error" in stepsResult && stepsResult.error) ||
        ("error" in phasesResult && phasesResult.error) ||
        ("error" in metricsResult && metricsResult.error);

      if (firstError) {
        toast.error(firstError);
      } else {
        toast.success("הכרטיס נשמר בהצלחה");
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-8" dir="rtl">
      {/* ------------------------------------------------------------------ */}
      {/* Drill base fields                                                    */}
      {/* ------------------------------------------------------------------ */}
      <Card>
        <CardHeader>
          <CardTitle>פרטי תרגיל</CardTitle>
          <CardDescription>שם, שריר, סטים, הסברים</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="name_en">שם (אנגלית)</Label>
                <Input
                  id="name_en"
                  value={nameEn}
                  onChange={(e) => setNameEn(e.target.value)}
                  placeholder="Drill name"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="name_he">שם (עברית)</Label>
                <Input
                  id="name_he"
                  value={nameHe}
                  onChange={(e) => setNameHe(e.target.value)}
                  placeholder="שם התרגיל"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="muscle_he">שריר</Label>
                <Input
                  id="muscle_he"
                  value={muscleHe}
                  onChange={(e) => setMuscleHe(e.target.value)}
                  placeholder="קבוצת שרירים"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sets_he">סטים</Label>
                <Input
                  id="sets_he"
                  value={setsHe}
                  onChange={(e) => setSetsHe(e.target.value)}
                  placeholder='למשל: "3 x 10"'
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="how_he">איך מבצעים</Label>
              <Textarea
                id="how_he"
                value={howHe}
                onChange={(e) => setHowHe(e.target.value)}
                rows={3}
                placeholder="הסבר ביצוע התרגיל"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="why_he">למה</Label>
              <Textarea
                id="why_he"
                value={whyHe}
                onChange={(e) => setWhyHe(e.target.value)}
                rows={2}
                placeholder="הסבר חשיבות התרגיל"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="connect_he">חיבור</Label>
              <Textarea
                id="connect_he"
                value={connectHe}
                onChange={(e) => setConnectHe(e.target.value)}
                rows={2}
                placeholder="חיבור למשחק"
              />
            </div>

            <div className="flex justify-start pt-2">
              <Button
                type="button"
                onClick={handleSaveDrill}
                disabled={isPendingDrill}
              >
                {isPendingDrill ? "שומר..." : "שמור פרטי תרגיל"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* Card base + sub-collections                                          */}
      {/* ------------------------------------------------------------------ */}
      <Card>
        <CardHeader>
          <CardTitle>כרטיס פרימיום</CardTitle>
          <CardDescription>
            כותרות, שלבי כישלון, שלבי אימון, ומדדים. כל השדות נשמרים יחד.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-8">
            {/* Card base fields */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">פרטי כרטיס</h3>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="situation_label_he">תווית מצב</Label>
                  <Input
                    id="situation_label_he"
                    value={situationLabelHe}
                    onChange={(e) => setSituationLabelHe(e.target.value)}
                    placeholder="למשל: מצב שגיאה"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="subtitle_he">כותרת משנה</Label>
                  <Input
                    id="subtitle_he"
                    value={subtitleHe}
                    onChange={(e) => setSubtitleHe(e.target.value)}
                    placeholder="כותרת משנה לכרטיס"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="age_min_label">תווית גיל מינימלי</Label>
                  <Input
                    id="age_min_label"
                    value={ageMinLabel}
                    onChange={(e) => setAgeMinLabel(e.target.value)}
                    placeholder='למשל: "גיל 12+"'
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="level_label">תווית רמה</Label>
                  <Input
                    id="level_label"
                    value={levelLabel}
                    onChange={(e) => setLevelLabel(e.target.value)}
                    placeholder='למשל: "מתקדם"'
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="golden_rule_he">כלל הזהב</Label>
                <Textarea
                  id="golden_rule_he"
                  value={goldenRuleHe}
                  onChange={(e) => setGoldenRuleHe(e.target.value)}
                  rows={2}
                  placeholder="כלל הזהב לתרגיל"
                />
              </div>
            </div>

            {/* Failure steps */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">שלבי כישלון</h3>
              <RepeatableRows<FailureStepRow>
                rows={failureStepRows}
                columns={FAILURE_STEP_COLUMNS}
                onChange={setFailureStepRows}
                newRow={newFailureStepRow}
              />
            </div>

            {/* Phases */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">שלבי אימון</h3>
              <DrillPhasesEditor phases={phases} onChange={setPhases} />
            </div>

            {/* Metrics */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">מדדים</h3>
              <RepeatableRows<MetricRow>
                rows={metricRows}
                columns={METRIC_COLUMNS}
                onChange={setMetricRows}
                newRow={newMetricRow}
              />
            </div>

            <div className="flex justify-start pt-2">
              <Button
                type="button"
                onClick={handleSaveCard}
                disabled={isPendingCard}
              >
                {isPendingCard ? "שומר..." : "שמור כרטיס פרימיום"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
