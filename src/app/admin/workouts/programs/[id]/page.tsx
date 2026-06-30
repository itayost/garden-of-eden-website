import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProgramForEdit } from "@/features/workouts/lib/actions";
import { ProgramBuilder } from "@/features/workouts/components/ProgramBuilder";

export const metadata: Metadata = {
  title: "עריכת תוכנית אימון | Garden of Eden",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProgramBuilderPage({ params }: PageProps) {
  const { id } = await params;
  const grid = await getProgramForEdit(id);

  if (!grid) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-1">עריכת תוכנית</h1>
        <p className="text-muted-foreground text-sm">
          ערוך את תרגילי התוכנית, תאי השבועות ומטא-הנתונים
        </p>
      </div>

      <ProgramBuilder key={id} programId={id} initialGrid={grid} />
    </div>
  );
}
