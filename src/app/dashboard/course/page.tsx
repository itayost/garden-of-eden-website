import type { Metadata } from "next";
import {
  getPublishedCourse,
  getMyLessonProgress,
} from "@/features/course/lib/actions";
import {
  countCourseProgress,
  findResumePoint,
} from "@/features/course/lib/progress-utils";
import { CourseCover } from "@/features/course/components/trainee/CourseCover";
import { CourseProgressRing } from "@/features/course/components/trainee/CourseProgressRing";
import { ResumeCard } from "@/features/course/components/trainee/ResumeCard";
import { ChapterList } from "@/features/course/components/trainee/ChapterList";

export const metadata: Metadata = {
  title: "הקורס הדיגיטלי | Garden of Eden",
};

// Depends on the signed-in trainee's own progress.
export const dynamic = "force-dynamic";

export default async function CoursePage() {
  const [course, progress] = await Promise.all([
    getPublishedCourse(),
    getMyLessonProgress(),
  ]);

  if (!course) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/50 py-16 text-center">
        <p className="text-sm text-muted-foreground">
          הקורס עדיין לא פורסם. נעדכן אותך ברגע שהוא יעלה.
        </p>
      </div>
    );
  }

  const chapters = course.chapters.filter(
    (chapter) => chapter.lessons.length > 0
  );
  const counts = countCourseProgress(chapters, progress);
  const resume = findResumePoint(chapters, progress);

  return (
    <div>
      <CourseCover
        titleHe={course.titleHe}
        descriptionHe={course.descriptionHe}
        chapters={chapters}
      />

      {chapters.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 py-16 text-center">
          <p className="text-sm text-muted-foreground">
            עוד לא פורסמו שיעורים בקורס.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {resume && <ResumeCard point={resume} />}

          <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-4">
            <div>
              <p className="font-bold">ההתקדמות שלך</p>
              <p className="text-xs text-muted-foreground tabular-nums">
                {counts.done} מתוך {counts.total} שיעורים
              </p>
            </div>
            <CourseProgressRing done={counts.done} total={counts.total} />
          </div>

          <section aria-labelledby="chapters-heading" className="space-y-3">
            <h2 id="chapters-heading" className="text-lg font-bold">
              פרקים
            </h2>
            <ChapterList chapters={chapters} progress={progress} />
          </section>
        </div>
      )}
    </div>
  );
}
