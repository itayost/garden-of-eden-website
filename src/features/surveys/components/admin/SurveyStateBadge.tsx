import { Badge } from "@/components/ui/badge";
import { SURVEY_STATE_HE } from "../../lib/state";
import type { SurveyState } from "../../lib/types";

/**
 * Open is the loud one (solid success), scheduled reads as information,
 * a draft is muted, and an ended Survey is only an outline.
 */
const STATE_STYLE: Record<SurveyState, { variant: "default" | "outline"; className?: string }> = {
  open: { variant: "default", className: "border-transparent bg-success text-success-foreground" },
  scheduled: { variant: "default", className: "border-transparent bg-info/15 text-info" },
  draft: { variant: "default", className: "border-transparent bg-muted text-muted-foreground" },
  ended: { variant: "outline" },
};

export function SurveyStateBadge({ state }: { state: SurveyState }) {
  const { variant, className } = STATE_STYLE[state];
  return (
    <Badge variant={variant} className={className}>
      {SURVEY_STATE_HE[state]}
    </Badge>
  );
}
