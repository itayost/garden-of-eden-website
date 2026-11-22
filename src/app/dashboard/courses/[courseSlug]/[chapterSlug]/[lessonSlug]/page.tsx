import type { Metadata } from "next";
import { CourseLessonPage } from "@/features/course/components/trainee/CourseLessonPage";
import { courseHref } from "@/features/course/lib/course-slugs";

export const metadata: Metadata = {
  title: "שיעור | Garden of Eden",
};

export const dynamic = "force-dynamic";

interface LessonPageProps {
  params: Promise<{ courseSlug: string; chapterSlug: string; lessonSlug: string }>;
}

export default async function LessonPage({ params }: LessonPageProps) {
  const { courseSlug, chapterSlug, lessonSlug } = await params;
  return (
    <CourseLessonPage
      slug={courseSlug}
      basePath={courseHref(courseSlug)}
      chapterSlug={chapterSlug}
      lessonSlug={lessonSlug}
    />
  );
}
