import type { Metadata } from "next";
import { CourseLessonPage } from "@/features/course/components/trainee/CourseLessonPage";
import { TACTICAL_COURSE_SLUG } from "@/features/course/lib/course-slugs";

export const metadata: Metadata = {
  title: "שיעור | Garden of Eden",
};

export const dynamic = "force-dynamic";

interface LessonPageProps {
  params: Promise<{ chapterSlug: string; lessonSlug: string }>;
}

export default async function LessonPage({ params }: LessonPageProps) {
  const { chapterSlug, lessonSlug } = await params;
  return (
    <CourseLessonPage
      slug={TACTICAL_COURSE_SLUG}
      basePath="/dashboard/tactical-course"
      chapterSlug={chapterSlug}
      lessonSlug={lessonSlug}
    />
  );
}
