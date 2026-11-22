import type { Metadata } from "next";
import { CourseHomePage } from "@/features/course/components/trainee/CourseHomePage";
import { courseHref } from "@/features/course/lib/course-slugs";

export const metadata: Metadata = {
  title: "קורס | Garden of Eden",
};

// Depends on the signed-in trainee's own progress.
export const dynamic = "force-dynamic";

interface CoursePageProps {
  params: Promise<{ courseSlug: string }>;
}

export default async function Page({ params }: CoursePageProps) {
  const { courseSlug } = await params;
  return <CourseHomePage slug={courseSlug} basePath={courseHref(courseSlug)} />;
}
