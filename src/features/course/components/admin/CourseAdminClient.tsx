"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { InlineTitleEdit } from "./InlineTitleEdit";
import { LessonAdminRow } from "./LessonAdminRow";
import { formatDuration } from "@/features/course/lib/progress-utils";
import {
  renameChapter,
  renameCourse,
  reorderLessons,
  setCoursePublished,
} from "@/features/course/lib/actions/admin-course";
import type { AdminCourse } from "@/features/course/lib/actions/admin-course";

interface CourseAdminClientProps {
  course: AdminCourse;
}

/** Move one item within a list, returning a new array. */
function moved<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function CourseAdminClient({ course }: CourseAdminClientProps) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(course.chapters[0]?.id ?? null);
  const [publishPending, startPublish] = useTransition();
  const [orderPending, startOrder] = useTransition();

  const selected = useMemo(
    () => course.chapters.find((c) => c.id === selectedId) ?? null,
    [course.chapters, selectedId]
  );

  const missingTitles = useMemo(
    () =>
      course.chapters.reduce(
        (n, chapter) =>
          n +
          (chapter.needsTitle ? 1 : 0) +
          chapter.lessons.filter((l) => l.needsTitle).length,
        0
      ),
    [course.chapters]
  );

  const togglePublished = (next: boolean) => {
    startPublish(async () => {
      const result = await setCoursePublished(course.id, next);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(next ? "הקורס פורסם" : "הקורס הוסר מהפרסום");
    });
  };

  const handleMove = (index: number, direction: -1 | 1) => {
    if (!selected) return;
    const target = index + direction;
    if (target < 0 || target >= selected.lessons.length) return;

    const ids = moved(selected.lessons, index, target).map((l) => l.id);
    startOrder(async () => {
      const result = await reorderLessons(selected.id, ids);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      {/* Course header */}
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-border p-4">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            שם הקורס
          </p>
          <InlineTitleEdit
            value={course.titleHe}
            isPlaceholder={course.needsTitle}
            label="שם הקורס"
            className="mt-1 text-lg font-bold"
            inputClassName="h-9 text-base"
            onSave={async (next) => {
              const result = await renameCourse(course.id, next);
              return "error" in result ? result.error : null;
            }}
          />
        </div>

        <label className="flex shrink-0 items-center gap-2">
          <span className="text-sm font-medium">
            {course.isPublished ? "פורסם" : "לא פורסם"}
          </span>
          <Switch
            checked={course.isPublished}
            onCheckedChange={togglePublished}
            disabled={publishPending || course.needsTitle}
            aria-label="פרסום הקורס"
          />
        </label>
      </div>

      {missingTitles > 0 && (
        <div className="flex items-start gap-2.5 rounded-lg border border-gold/40 bg-gold/5 p-3 text-sm">
          <AlertTriangle
            className="mt-0.5 h-4 w-4 shrink-0 text-gold"
            aria-hidden="true"
          />
          <p>
            {missingTitles} פרקים ושיעורים עדיין בלי שם. שיעור בלי שם לא יכול
            להתפרסם — לחץ על השם כדי לערוך אותו.
          </p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-[220px_1fr]">
        {/* Chapter picker */}
        <nav aria-label="פרקים" className="space-y-1">
          {course.chapters.map((chapter, index) => {
            const active = chapter.id === selectedId;
            const drafts = chapter.lessons.filter((l) => !l.isPublished).length;
            return (
              <button
                key={chapter.id}
                type="button"
                onClick={() => setSelectedId(chapter.id)}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-start text-sm transition-colors",
                  active
                    ? "bg-card font-bold shadow-sm ring-1 ring-border"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                <span className="min-w-0 truncate">
                  {chapter.needsTitle ? `פרק ${index + 1}` : chapter.titleHe}
                </span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {drafts > 0
                    ? `${chapter.lessons.length - drafts}/${chapter.lessons.length}`
                    : chapter.lessons.length}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Selected chapter */}
        {selected ? (
          <section aria-label={selected.titleHe} className="space-y-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                שם הפרק
              </p>
              <InlineTitleEdit
                value={selected.titleHe}
                isPlaceholder={selected.needsTitle}
                label="שם הפרק"
                className="mt-1 font-bold"
                onSave={async (next) => {
                  const result = await renameChapter(selected.id, next);
                  return "error" in result ? result.error : null;
                }}
              />
              <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                {selected.lessons.length} שיעורים ·{" "}
                {formatDuration(
                  selected.lessons.reduce((n, l) => n + l.durationSec, 0)
                )}
              </p>
            </div>

            {selected.lessons.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
                אין שיעורים בפרק הזה.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {selected.lessons.map((lesson, index) => (
                  <LessonAdminRow
                    key={lesson.id}
                    lesson={lesson}
                    index={index}
                    isFirst={index === 0}
                    isLast={index === selected.lessons.length - 1}
                    onMove={handleMove}
                    moveDisabled={orderPending}
                  />
                ))}
              </ul>
            )}
          </section>
        ) : (
          <p className="text-sm text-muted-foreground">אין פרקים בקורס.</p>
        )}
      </div>
    </div>
  );
}
