import { AlignRight, Check, CircleDot, SquareCheckBig, Star, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import type { QuestionKind, SurveyQuestion } from "../../lib/types";
import { FAINT_TEXT, RAISED } from "./sheet-styles";

const KIND_ICONS: Record<QuestionKind, LucideIcon> = {
  rating: Star,
  single_choice: CircleDot,
  multi_choice: SquareCheckBig,
  text: AlignRight,
};

/**
 * Most Questions that still get an icon tile. Past this the tiles would be too
 * small to hold an icon on a phone, so the path becomes a row of segments.
 */
const ICON_TILES_MAX = 7;

type TileState = "done" | "now" | "ahead";

function tileState(index: number, current: number): TileState {
  if (index < current) return "done";
  return index === current ? "now" : "ahead";
}

const TILE_STATE: Record<TileState, string> = {
  done: "border border-brand-lime bg-brand-lime text-forest",
  now: "border-2 border-brand-lime bg-[#1B341B] text-brand-lime",
  ahead: `${RAISED} ${FAINT_TEXT}`,
};

const SEGMENT_STATE: Record<TileState, string> = {
  done: "bg-brand-lime",
  now: "border-2 border-brand-lime bg-forest-light",
  ahead: "bg-brand-lime/15",
};

interface LevelPathProps {
  questions: readonly SurveyQuestion[];
  /** Index of the Question on screen; the Question count means all are done. */
  current: number;
  size?: "small" | "large";
  className?: string;
}

function IconTile({
  question,
  state,
  size,
}: {
  question: SurveyQuestion;
  state: TileState;
  size: "small" | "large";
}) {
  const Icon = state === "done" ? Check : KIND_ICONS[question.kind];
  return (
    <span
      className={cn(
        "grid aspect-square min-w-0 flex-1 place-items-center",
        size === "large" ? "max-w-[46px] rounded-[14px]" : "max-w-[34px] rounded-[10px]",
        TILE_STATE[state],
      )}
    >
      <Icon className={size === "large" ? "size-[19px]" : "size-[15px]"} />
    </span>
  );
}

/**
 * One small tile per Question, joined by short lines. On the first screen it
 * shows what is ahead; on a Question it is the progress indicator (passed tiles
 * lime with a check, the current one outlined); on the thank-you every tile is
 * filled. Decorative: the Question screens say "שאלה i מתוך n" in words.
 */
export function LevelPath({ questions, current, size = "small", className }: LevelPathProps) {
  const dense = questions.length > ICON_TILES_MAX;
  return (
    <div
      aria-hidden="true"
      className={cn("flex min-w-0 flex-1 items-center justify-center", dense && "gap-1", className)}
    >
      {questions.map((question, index) => {
        const state = tileState(index, current);
        if (dense) {
          return <span key={question.id} className={cn("box-border h-3 min-w-0 flex-1 rounded-full", SEGMENT_STATE[state])} />;
        }
        return (
          <span key={question.id} className="contents">
            {index > 0 && (
              <i
                className={cn(
                  "h-0.5 flex-none",
                  size === "large" ? "w-[18px]" : "w-3",
                  index <= current ? "bg-brand-lime" : "bg-brand-lime/15",
                )}
              />
            )}
            <IconTile question={question} state={state} size={size} />
          </span>
        );
      })}
    </div>
  );
}
