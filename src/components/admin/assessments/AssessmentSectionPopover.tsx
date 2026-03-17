"use client";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CheckCircle, XCircle } from "lucide-react";
import type { SectionCompleteness } from "@/types/assessment";
import { isSectionDone } from "./assessment-section-utils";

interface AssessmentSectionPopoverProps {
  sections: SectionCompleteness[];
  children: React.ReactNode;
}

export function AssessmentSectionPopover({
  sections,
  children,
}: AssessmentSectionPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-64" align="start" side="top">
        <p className="text-sm font-medium mb-3">פירוט מבדק</p>
        <div className="space-y-2">
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
                  <span>{section.title}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {section.completed}/{section.total}
                </span>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
