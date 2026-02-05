"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export interface Step {
  key: string;
  title: string;
  icon?: React.ReactNode;
}

interface ProgressStepperProps {
  steps: Step[];
  currentStep: number;
  onStepClick?: (stepIndex: number) => void;
  completedSteps?: Set<number>;
  className?: string;
}

// Step state styles - centralized for consistency
const stepStyles = {
  circle: {
    current: "border-primary bg-primary text-primary-foreground",
    completed: "border-green-500 bg-green-500 text-white",
    past: "border-muted-foreground/50 bg-muted",
    future: "border-muted-foreground/30 bg-background text-muted-foreground",
  },
  label: {
    current: "text-primary",
    completed: "text-green-600",
    default: "text-muted-foreground",
  },
  dot: {
    current: "bg-primary scale-125",
    completed: "bg-green-500",
    default: "bg-muted-foreground/30",
  },
} as const;

type StepState = "current" | "completed" | "past" | "future";

function getStepState(index: number, currentStep: number, completedSteps: Set<number>): StepState {
  if (index === currentStep) return "current";
  if (completedSteps.has(index)) return "completed";
  if (index < currentStep) return "past";
  return "future";
}

export function ProgressStepper({
  steps,
  currentStep,
  onStepClick,
  completedSteps = new Set(),
  className,
}: ProgressStepperProps) {
  return (
    <div className={cn("w-full", className)}>
      {/* Desktop view */}
      <div className="hidden sm:flex items-center justify-between">
        {steps.map((step, index) => {
          const state = getStepState(index, currentStep, completedSteps);
          const isClickable = onStepClick && state !== "future";

          return (
            <div key={step.key} className="flex items-center flex-1">
              {/* Step circle */}
              <button
                type="button"
                onClick={() => isClickable && onStepClick?.(index)}
                disabled={!isClickable}
                className={cn(
                  "flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all",
                  "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                  stepStyles.circle[state],
                  isClickable ? "cursor-pointer hover:scale-105" : "cursor-default"
                )}
              >
                {state === "completed" ? (
                  <Check className="w-5 h-5" />
                ) : (
                  <span className="text-sm font-medium">{index + 1}</span>
                )}
              </button>

              {/* Step label */}
              <span
                className={cn(
                  "me-3 text-sm font-medium whitespace-nowrap",
                  state === "current" ? stepStyles.label.current :
                  state === "completed" ? stepStyles.label.completed :
                  stepStyles.label.default
                )}
              >
                {step.title}
              </span>

              {/* Connector line */}
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "flex-1 h-0.5 mx-4",
                    (state === "completed" || state === "past") ? "bg-green-500" : "bg-muted"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile view - simplified */}
      <div className="sm:hidden">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-primary">
            שלב {currentStep + 1} מתוך {steps.length}
          </span>
          <span className="text-sm text-muted-foreground">
            {steps[currentStep]?.title}
          </span>
        </div>
        {/* Progress bar */}
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          />
        </div>
        {/* Step dots */}
        <div className="flex justify-between mt-2">
          {steps.map((step, index) => {
            const state = getStepState(index, currentStep, completedSteps);
            const isClickable = onStepClick && state !== "future";

            return (
              <button
                key={step.key}
                type="button"
                onClick={() => isClickable && onStepClick?.(index)}
                disabled={!isClickable}
                aria-label={`${step.title}, שלב ${index + 1}`}
                className={cn(
                  "flex items-center justify-center w-7 h-7 -m-2",
                  !isClickable && "cursor-not-allowed opacity-50"
                )}
              >
                <span
                  className={cn(
                    "w-3 h-3 rounded-full transition-all",
                    state === "current" ? stepStyles.dot.current :
                    state === "completed" ? stepStyles.dot.completed :
                    stepStyles.dot.default,
                  )}
                />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
