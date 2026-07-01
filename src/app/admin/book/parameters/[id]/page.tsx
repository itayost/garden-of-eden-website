import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getParameterForEdit } from "@/features/development-book/lib/actions/admin-book-parameters";
import { listMuscles } from "@/features/development-book/lib/actions/admin-book-muscles";
import { ParameterForm } from "@/features/development-book/components/admin/ParameterForm";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = {
  title: "עריכת פרמטר | Garden of Eden",
};

export default async function AdminParameterEditPage({ params }: PageProps) {
  const { id } = await params;
  const [parameter, allMuscles] = await Promise.all([
    getParameterForEdit(id),
    listMuscles(),
  ]);

  if (!parameter) {
    notFound();
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-3xl font-bold mb-2">
          עריכת פרמטר: {parameter.nameHe}
        </h1>
        <p className="text-muted-foreground">
          {parameter.number !== null ? `פרמטר מספר ${parameter.number}` : "ללא מספר"}
          {parameter.subtitleHe ? ` — ${parameter.subtitleHe}` : ""}
        </p>
      </div>

      {/* key={id} forces remount when navigating between different parameters,
          preventing stale edit state (project gotcha: useState(prop) only runs on mount) */}
      <ParameterForm key={id} parameter={parameter} allMuscles={allMuscles} />
    </div>
  );
}
