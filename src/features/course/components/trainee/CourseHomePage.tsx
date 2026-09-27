import { loadCourseForViewer } from "@/features/course/lib/load-course";
import { CourseNotice } from "../CourseNotice";
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
  const { course, progress, canOpen } = await loadCourseForViewer(slug);

  if (!course) {
    return <CourseNotice message="הקורס עדיין לא פורסם. נעדכן אותך ברגע שהוא יעלה." />;
  }

  if (!canOpen) return <CourseNotice />;

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
        <CourseNotice message="עוד לא פורסמו שיעורים בקורס." />
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
