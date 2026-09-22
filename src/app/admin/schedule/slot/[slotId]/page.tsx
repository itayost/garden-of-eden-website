import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { SlotWorkoutEditor } from "@/components/admin/schedule/SlotWorkoutEditor";
import { getSlotWorkoutAction } from "@/lib/actions/slot-workout";
import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { isValidUUID } from "@/lib/validations/common";

export const metadata: Metadata = {
  title: "אימון קבוצתי | Garden of Eden",
};

interface PageProps {
  params: Promise<{ slotId: string }>;
  searchParams: Promise<{ branch?: string }>;
}

export default async function SlotWorkoutPage({ params, searchParams }: PageProps) {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) redirect("/dashboard");

  const { slotId } = await params;
  if (!isValidUUID(slotId)) notFound();

  const query = await searchParams;
  const branchId = query.branch && isValidUUID(query.branch) ? query.branch : null;

  const result = await getSlotWorkoutAction(slotId);
  if ("error" in result) {
    return <p className="py-12 text-center text-destructive">{result.error}</p>;
  }

  return (
    <SlotWorkoutEditor
      // The editor seeds its rows on mount, so a navigation between two slots
      // must not carry the first slot's exercises into the second.
      key={slotId}
      workout={result.data}
      branchId={branchId}
    />
  );
}
