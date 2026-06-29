import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getDrillForEdit } from "@/features/development-book/lib/actions/admin-book-drills";
import { DrillCardForm } from "@/features/development-book/components/admin/DrillCardForm";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = {
  title: "עריכת תרגיל | Garden of Eden",
};

export default async function AdminDrillEditPage({ params }: PageProps) {
  const { id } = await params;
  const result = await getDrillForEdit(id);

  if (!result) {
    notFound();
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-3xl font-bold mb-2">
          עריכת תרגיל: {result.drill.nameHe ?? result.drill.nameEn ?? id}
        </h1>
        <p className="text-muted-foreground">
          {result.card ? "כרטיס פרימיום קיים" : "אין כרטיס פרימיום — ניתן ליצור כאן"}
        </p>
      </div>

      {/* key={id} forces remount when navigating between different drills,
          preventing stale edit state (project gotcha: useState(prop) only runs on mount) */}
      <DrillCardForm key={id} drill={result.drill} card={result.card} />
    </div>
  );
}
