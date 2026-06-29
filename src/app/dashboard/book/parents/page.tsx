import type { Metadata } from "next";
import { getBookTree } from "@/features/development-book/lib/actions";
import { ParentsPage } from "@/features/development-book/components/trainee/ParentsPage";

export const metadata: Metadata = {
  title: "להורים | ספר פיתוח שחקן | Garden of Eden",
};

// Force dynamic — depends on logged-in user profile (age group, position)
export const dynamic = "force-dynamic";

export default async function ParentsBookPage() {
  const { categories } = await getBookTree();

  return <ParentsPage categories={categories} />;
}
