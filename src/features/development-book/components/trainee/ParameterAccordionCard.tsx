"use client";

import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { DrillsPanel } from "./DrillsPanel";
import { AgePanel } from "./AgePanel";
import { ParentsPanel } from "./ParentsPanel";
import { VerbalPanel } from "./VerbalPanel";
import { countDoneInParameter } from "@/features/development-book/lib/progress-utils";
import type {
  BookParameterWithChildren,
  AgeGroup,
  DrillProgressMap,
} from "@/features/development-book/lib/types";

interface ParameterAccordionCardProps {
  parameter: BookParameterWithChildren;
  traineeAgeGroup: AgeGroup | null;
  doneMap: DrillProgressMap;
}

export function ParameterAccordionCard({
  parameter,
  traineeAgeGroup,
  doneMap,
}: ParameterAccordionCardProps) {
  const { done: paramDone, total: paramTotal } = countDoneInParameter(parameter, doneMap);

  return (
    <AccordionItem
      value={parameter.id}
      className={cn(
        "rounded-xl border border-border bg-card overflow-hidden",
        "hover:border-primary/30 transition-colors",
        "data-[state=open]:border-primary/40"
      )}
    >
      {/* --- Header --- */}
      <AccordionTrigger className="px-5 py-4 hover:no-underline [&[data-state=open]]:text-foreground group">
        <div className="flex items-center gap-3 text-start flex-1 min-w-0">
          {/* Parameter number badge */}
          {parameter.number !== null && (
            <span
              className={cn(
                "shrink-0 inline-flex items-center justify-center",
                "rounded-md border border-primary/20 bg-primary/8 px-2 py-1",
                "text-[10px] font-extrabold text-primary tracking-wider min-w-[36px]"
              )}
            >
              {parameter.number}
            </span>
          )}

          {/* Name + meta */}
          <div className="min-w-0 flex-1">
            <p className="font-bold text-base leading-tight text-foreground line-clamp-2">
              {parameter.nameHe}
            </p>
            {(parameter.subtitleHe || parameter.positions.length > 0) && (
              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                {parameter.subtitleHe && (
                  <span className="text-[10px] text-muted-foreground tracking-wide uppercase">
                    {parameter.subtitleHe}
                  </span>
                )}
                {/* Position tags */}
                {!parameter.isAllPositions &&
                  parameter.positions.map((pos) => (
                    <Badge
                      key={pos}
                      variant="outline"
                      className="text-[9px] px-1.5 py-0 border-yellow-400/30 bg-yellow-400/8 text-yellow-600 dark:text-yellow-400 font-bold"
                    >
                      {pos}
                    </Badge>
                  ))}
                {parameter.isAllPositions && (
                  <Badge
                    variant="outline"
                    className="text-[9px] px-1.5 py-0 border-muted bg-muted/50 text-muted-foreground font-medium"
                  >
                    כל העמדות
                  </Badge>
                )}
              </div>
            )}
          </div>

          {/* Per-parameter drill progress badge */}
          {paramTotal > 0 && (
            <span
              className={cn(
                "shrink-0 inline-flex items-center gap-1",
                "rounded-md border px-2 py-1 text-[10px] font-bold tracking-wide",
                paramDone === paramTotal
                  ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-600 dark:text-emerald-400"
                  : "border-border bg-muted/50 text-muted-foreground"
              )}
            >
              <Check className="h-3 w-3 shrink-0" />
              {paramDone}/{paramTotal}
            </span>
          )}
        </div>
      </AccordionTrigger>

      {/* --- Body --- */}
      <AccordionContent className="px-0 pb-0">
        <div className="border-t border-border">
          <Tabs defaultValue="drills" className="gap-0">
            <TabsList className="w-full rounded-none bg-muted/60 h-auto p-0 justify-start gap-0 overflow-x-auto scrollbar-hide border-b border-border">
              <TabsTrigger
                value="drills"
                className="rounded-none border-b-2 border-b-transparent data-[state=active]:border-b-primary data-[state=active]:bg-transparent data-[state=active]:text-primary px-4 py-2.5 text-xs font-bold tracking-wide"
              >
                תרגילים
              </TabsTrigger>
              <TabsTrigger
                value="age"
                className="rounded-none border-b-2 border-b-transparent data-[state=active]:border-b-yellow-400 data-[state=active]:bg-transparent data-[state=active]:text-yellow-600 dark:data-[state=active]:text-yellow-400 px-4 py-2.5 text-xs font-bold tracking-wide"
              >
                לפי גיל
              </TabsTrigger>
              <TabsTrigger
                value="parents"
                className="rounded-none border-b-2 border-b-transparent data-[state=active]:border-b-sky-400 data-[state=active]:bg-transparent data-[state=active]:text-sky-600 dark:data-[state=active]:text-sky-400 px-4 py-2.5 text-xs font-bold tracking-wide"
              >
                להורים
              </TabsTrigger>
              <TabsTrigger
                value="verbal"
                className="rounded-none border-b-2 border-b-transparent data-[state=active]:border-b-purple-400 data-[state=active]:bg-transparent data-[state=active]:text-purple-600 dark:data-[state=active]:text-purple-400 px-4 py-2.5 text-xs font-bold tracking-wide"
              >
                בעל פה
              </TabsTrigger>
            </TabsList>

            <TabsContent value="drills" className="p-5">
              <DrillsPanel drills={parameter.drills} doneMap={doneMap} />
            </TabsContent>

            <TabsContent value="age" className="p-5">
              <AgePanel
                ageRows={parameter.ageRows}
                traineeAgeGroup={traineeAgeGroup}
                ageMetricLabel={parameter.ageMetricLabel}
              />
            </TabsContent>

            <TabsContent value="parents" className="p-5">
              <ParentsPanel
                reportTextHe={parameter.reportTextHe}
                reportHighlightHe={parameter.reportHighlightHe}
              />
            </TabsContent>

            <TabsContent value="verbal" className="p-5">
              <VerbalPanel
                verbalTextHe={parameter.verbalTextHe}
                verbalTipHe={parameter.verbalTipHe}
              />
            </TabsContent>
          </Tabs>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
