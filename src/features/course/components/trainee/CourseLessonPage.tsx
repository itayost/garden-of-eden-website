import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import {
  getPublishedCourse,
  getMyLessonProgress,
  getCourseViewer,
} from "@/features/course/lib/actions";
import { canOpenCourse } from "@/features/course/lib/course-access-rule";
import { CourseAccessNotice } from "./CourseAccessNotice";
import {
  countChapterProgress,
  isLessonDone,
} from "@/features/course/lib/progress-utils";
import { LessonView } from "./LessonView";
import { LessonPlaylist } from "./LessonPlaylist";
import { ChapterCompleteCard } from "./ChapterCompleteCard";



interface CourseLessonPageProps {
  slug: string;
  basePath: string;
  chapterSlug: string;
  lessonSlug: string;
}

/** One lesson of a course: player, next lesson, chapter playlist. */
export async function CourseLessonPage({
  slug,
  basePath,
  chapterSlug,
  lessonSlug,
}: CourseLessonPageProps) {
  const [course, progress, viewer] = await Promise.all([
    getPublishedCourse(slug),
    getMyLessonProgress(),
    getCourseViewer(),
  ]);
  if (!course) notFound();
  if (!canOpenCourse(course.activeOnly, viewer)) return <CourseAccessNotice />;

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
    ? `${basePath}/${chapter.slug}/${nextInChapter.slug}`
    : nextChapter
      ? `${basePath}/${nextChapter.slug}/${nextChapter.lessons[0].slug}`
      : null;

  const counts = countChapterProgress(chapter, progress);
  const chapterComplete = counts.total > 0 && counts.done === counts.total;
  const lessonProgress = progress[lesson.id];

  return (
    <div className="space-y-5">
      <Link
        href={basePath}
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
              ? `${basePath}/${nextChapter.slug}/${nextChapter.lessons[0].slug}`
              : null
          }
        />
      )}

      <LessonPlaylist
        chapter={chapter}
        currentLessonId={lesson.id}
        progress={progress}
        basePath={basePath}
      />
    </div>
  );
}
