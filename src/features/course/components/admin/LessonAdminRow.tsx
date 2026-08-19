"use client";

import { useTransition } from "react";
import { ChevronDown, ChevronUp, VideoOff } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { InlineTitleEdit } from "./InlineTitleEdit";
import { formatDuration } from "@/features/course/lib/progress-utils";
import {
  renameLesson,
  setLessonPublished,
} from "@/features/course/lib/actions/admin-course";
import type { AdminCourseLesson } from "@/features/course/lib/actions/admin-course";

interface LessonAdminRowProps {
  lesson: AdminCourseLesson;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  onMove: (index: number, direction: -1 | 1) => void;
  moveDisabled: boolean;
}

export function LessonAdminRow({
  lesson,
  index,
  isFirst,
  isLast,
  onMove,
  moveDisabled,
}: LessonAdminRowProps) {
  const [pending, startTransition] = useTransition();

  const canPublish = !lesson.needsTitle && lesson.videoPath !== null;

  const togglePublished = (next: boolean) => {
    startTransition(async () => {
      const result = await setLessonPublished(lesson.id, next);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(next ? "השיעור פורסם" : "השיעור הוסר מהפרסום");
    });
  };

  return (
    <li
      className={cn(
        "flex items-center gap-2 rounded-lg border border-border px-2.5 py-2",
        lesson.needsTitle && "border-dashed"
      )}
    >
      <span className="flex shrink-0 flex-col">
        <button
          type="button"
          onClick={() => onMove(index, -1)}
          disabled={isFirst || moveDisabled}
          aria-label="הזז למעלה"
          className="grid h-4 w-5 place-items-center text-muted-foreground hover:text-foreground disabled:opacity-30"
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onMove(index, 1)}
          disabled={isLast || moveDisabled}
          aria-label="הזז למטה"
          className="grid h-4 w-5 place-items-center text-muted-foreground hover:text-foreground disabled:opacity-30"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </span>

      <span className="w-6 shrink-0 text-xs text-muted-foreground tabular-nums">
        {index + 1}
      </span>

      <InlineTitleEdit
        value={lesson.titleHe}
        isPlaceholder={lesson.needsTitle}
        label={`שם השיעור ${index + 1}`}
        className="min-w-0 flex-1 text-sm"
        onSave={async (next) => {
          const result = await renameLesson(lesson.id, next);
          return "error" in result ? result.error : null;
        }}
      />

      {lesson.videoPath === null && (
        <span
          className="flex shrink-0 items-center gap-1 text-xs text-destructive"
          title="אין וידאו"
        >
          <VideoOff className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="sr-only">אין וידאו</span>
        </span>
      )}

      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
        {formatDuration(lesson.durationSec)}
      </span>

      <Switch
        checked={lesson.isPublished}
        onCheckedChange={togglePublished}
        disabled={pending || (!canPublish && !lesson.isPublished)}
        aria-label={`פרסום השיעור ${lesson.titleHe}`}
        className="shrink-0"
      />
    </li>
  );
}
