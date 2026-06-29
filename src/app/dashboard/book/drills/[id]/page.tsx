import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDrillCard } from "@/features/development-book/lib/actions";
import { DrillCard } from "@/features/development-book/components/trainee/DrillCard";

export const metadata: Metadata = {
  title: "כרטיס תרגיל | ספר פיתוח שחקן | Garden of Eden",
};

export const dynamic = "force-dynamic";

interface DrillCardPageProps {
  params: Promise<{ id: string }>;
}

export default async function DrillCardPage({ params }: DrillCardPageProps) {
  const { id } = await params;
  const result = await getDrillCard(id);

  if (result === null) {
    notFound();
  }

  return (
    <div className="max-w-2xl mx-auto pb-16">
      <DrillCard drill={result.drill} card={result.card} />
    </div>
  );
}
