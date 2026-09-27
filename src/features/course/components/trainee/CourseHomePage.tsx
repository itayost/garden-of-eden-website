import {
  getPublishedCourse,
  getMyLessonProgress,
  getCourseViewer,
} from "@/features/course/lib/actions";
import { canOpenCourse } from "@/features/course/lib/course-access-rule";
import { CourseAccessNotice } from "./CourseAccessNotice";
import {
  countCourseProgress,
  findResumePoint,
} from "@/features/course/lib/progress-utils";
import { CourseCover } from "./CourseCover";
import { CourseProgressRing } from "./CourseProgressRing";
import { ResumeCard } from "./ResumeCard";
import { ChapterList } from "./ChapterList";



interface CourseHomePageProps {
  /** Which course; pages never rely on "the first published one". */
  slug: string;
  /** Route the course's lesson pages hang off. */
  basePath: string;
}

/** A course's home: cover, resume, progress and chapters. */
export async function CourseHomePage({ slug, basePath }: CourseHomePageProps) {
  const [course, progress, viewer] = await Promise.all([
    getPublishedCourse(slug),
    getMyLessonProgress(),
    getCourseViewer(),
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

  if (!canOpenCourse(course.activeOnly, viewer)) return <CourseAccessNotice />;

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
          {resume && <ResumeCard point={resume} basePath={basePath} />}

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
            <ChapterList chapters={chapters} progress={progress} basePath={basePath} />
          </section>
        </div>
      )}
    </div>
  );
}
