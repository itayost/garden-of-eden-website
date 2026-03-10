"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ASSESSMENT_LABELS_HE } from "@/types/assessment";
import type { PlayerAssessment } from "@/types/assessment";

interface ReportAssessmentsTableProps {
  assessments: readonly PlayerAssessment[];
}

const METRIC_ROWS: { key: keyof PlayerAssessment; label: string }[] = [
  { key: "sprint_5m", label: ASSESSMENT_LABELS_HE.sprint_5m },
  { key: "sprint_10m", label: ASSESSMENT_LABELS_HE.sprint_10m },
  { key: "sprint_20m", label: ASSESSMENT_LABELS_HE.sprint_20m },
  { key: "jump_2leg_height", label: ASSESSMENT_LABELS_HE.jump_2leg_height },
  { key: "jump_2leg_distance", label: ASSESSMENT_LABELS_HE.jump_2leg_distance },
  { key: "jump_right_leg", label: ASSESSMENT_LABELS_HE.jump_right_leg },
  { key: "jump_left_leg", label: ASSESSMENT_LABELS_HE.jump_left_leg },
  { key: "blaze_spot_time", label: ASSESSMENT_LABELS_HE.blaze_spot_time },
  { key: "kick_power_kaiser", label: ASSESSMENT_LABELS_HE.kick_power_kaiser },
  { key: "flexibility_ankle", label: ASSESSMENT_LABELS_HE.flexibility_ankle },
  { key: "flexibility_knee", label: ASSESSMENT_LABELS_HE.flexibility_knee },
  { key: "flexibility_hip", label: ASSESSMENT_LABELS_HE.flexibility_hip },
  { key: "coordination", label: ASSESSMENT_LABELS_HE.coordination },
  { key: "body_structure", label: ASSESSMENT_LABELS_HE.body_structure },
  { key: "leg_power_technique", label: ASSESSMENT_LABELS_HE.leg_power_technique },
];

export function ReportAssessmentsTable({
  assessments,
}: ReportAssessmentsTableProps) {
  // Show two most recent
  const recent = assessments.slice(0, 2);

  if (recent.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>מבדקים גופניים</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">אין מבדקים עדיין</p>
        </CardContent>
      </Card>
    );
  }

  const formatDate = (d: string) => new Date(d).toLocaleDateString("he-IL");

  return (
    <Card data-testid="report-assessments">
      <CardHeader>
        <CardTitle>מבדקים גופניים</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">מדד</TableHead>
              {recent.map((a) => (
                <TableHead key={a.id} className="text-right">
                  {formatDate(a.assessment_date)}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {METRIC_ROWS.map(({ key, label }) => (
              <TableRow key={key}>
                <TableCell className="font-medium">{label}</TableCell>
                {recent.map((a) => (
                  <TableCell key={a.id}>
                    {(a[key] as string | number | null) ?? "---"}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
