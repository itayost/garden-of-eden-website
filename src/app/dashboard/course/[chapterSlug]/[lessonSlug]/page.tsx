import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import {
  getPublishedCourse,
  getMyLessonProgress,
} from "@/features/course/lib/actions";
import {
  countChapterProgress,
  isLessonDone,
} from "@/features/course/lib/progress-utils";
import { LessonView } from "@/features/course/components/trainee/LessonView";
import { LessonPlaylist } from "@/features/course/components/trainee/LessonPlaylist";
import { ChapterCompleteCard } from "@/features/course/components/trainee/ChapterCompleteCard";

export const metadata: Metadata = {
  title: "שיעור | Garden of Eden",
};

export const dynamic = "force-dynamic";

interface LessonPageProps {
  params: Promise<{ chapterSlug: string; lessonSlug: string }>;
}

export default async function LessonPage({ params }: LessonPageProps) {
  const { chapterSlug, lessonSlug } = await params;

  const [course, progress] = await Promise.all([
    getPublishedCourse(),
    getMyLessonProgress(),
  ]);
  if (!course) notFound();

  const chapters = course.chapters.filter((c) => c.lessons.length > 0);
  const chapterIndex = chapters.findIndex((c) => c.slug === chapterSlug);
  if (chapterIndex === -1) notFound();

  const chapter = chapters[chapterIndex];
  const lessonIndex = chapter.lessons.findIndex((l) => l.slug === lessonSlug);
  if (lessonIndex === -1) notFound();

  const lesson = chapter.lessons[lessonIndex];

  // Next lesson: the following one in this chapter, else the first of the next
  // chapter that has any.
  const nextInChapter = chapter.lessons[lessonIndex + 1];
  const nextChapter = chapters[chapterIndex + 1] ?? null;
  const nextHref = nextInChapter
    ? `/dashboard/course/${chapter.slug}/${nextInChapter.slug}`
    : nextChapter
      ? `/dashboard/course/${nextChapter.slug}/${nextChapter.lessons[0].slug}`
      : null;

  const counts = countChapterProgress(chapter, progress);
  const chapterComplete = counts.total > 0 && counts.done === counts.total;
  const lessonProgress = progress[lesson.id];

  return (
    <div className="space-y-5">
      <Link
        href="/dashboard/course"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
        חזרה לקורס
      </Link>

      <LessonView
        lesson={lesson}
        chapterTitleHe={chapter.titleHe}
        lessonNumber={lessonIndex + 1}
        lessonTotal={chapter.lessons.length}
        initialPositionSec={lessonProgress?.lastPositionSec ?? 0}
        initialCompleted={isLessonDone(lesson.id, progress)}
        nextHref={nextHref}
      />

      {chapterComplete && (
        <ChapterCompleteCard
          chapter={chapter}
          nextChapter={nextChapter}
          nextChapterHref={
            nextChapter
              ? `/dashboard/course/${nextChapter.slug}/${nextChapter.lessons[0].slug}`
              : null
          }
        />
      )}

      <LessonPlaylist
        chapter={chapter}
        currentLessonId={lesson.id}
        progress={progress}
      />
    </div>
  );
}
