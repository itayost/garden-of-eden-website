"use client";

import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle } from "lucide-react";
import type { SectionCompleteness } from "@/types/assessment";
import type { PlayerAssessment } from "@/types/assessment";
import type { Profile } from "@/types/database";
import { isSectionDone } from "./assessment-section-utils";

interface AssessmentDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: Profile;
  // Non-nullable: this dialog is only opened for partial rows (assessment always exists)
  assessment: PlayerAssessment;
  sections: SectionCompleteness[];
}

export function AssessmentDetailDialog({
  open,
  onOpenChange,
  profile,
  assessment,
  sections,
}: AssessmentDetailDialogProps) {
  const router = useRouter();

  const assessmentDate = new Date(assessment.assessment_date).toLocaleDateString(
    "he-IL"
  );

  const handleComplete = () => {
    onOpenChange(false);
    router.push(`/admin/assessments/${profile.id}/${assessment.id}/edit`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {profile.full_name || "ללא שם"} — {assessmentDate}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {sections.map((section) => {
            const done = isSectionDone(section);
            return (
              <div
                key={section.key}
                className="flex items-center justify-between text-sm"
              >
                <div className="flex items-center gap-2">
                  {done ? (
                    <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                  )}
                  <span className={done ? "" : "text-muted-foreground"}>
                    {section.title}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {section.completed}/{section.total}
                </span>
              </div>
            );
          })}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            סגור
          </Button>
          <Button onClick={handleComplete}>השלם מבדק</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
