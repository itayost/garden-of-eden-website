import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { TodayWorkout } from "@/components/dashboard/workout/TodayWorkout";
import {
  getEquipmentExercisesAction,
  getMyTodaySessionAction,
} from "@/lib/actions/trainee-workout";
import { isValidUUID } from "@/lib/validations/common";

export const metadata: Metadata = {
  title: "האימון שלי | Garden of Eden",
};

interface PageProps {
  searchParams: Promise<{ focus?: string; equipment?: string }>;
}

export default async function WorkoutPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const focusId =
    params.focus && isValidUUID(params.focus) ? params.focus : null;
  const equipmentId =
    params.equipment && isValidUUID(params.equipment) ? params.equipment : null;

  const sessionResult = await getMyTodaySessionAction();
  if ("error" in sessionResult && sessionResult.error === "לא מחובר") {
    redirect("/auth/login?redirect=/dashboard/workout");
  }

  const session = "success" in sessionResult ? sessionResult.data : null;
  const loadError = "error" in sessionResult ? sessionResult.error : null;

  // The free-log path: a scan landed on equipment with no matching exercise
  // in today's session — offer that equipment's exercises directly.
  const equipmentExercisesResult = equipmentId
    ? await getEquipmentExercisesAction(equipmentId)
    : null;
  const equipmentExercises =
    equipmentExercisesResult && "success" in equipmentExercisesResult
      ? equipmentExercisesResult.data
      : [];

  return (
    <TodayWorkout
      session={session}
      loadError={loadError}
      focusId={focusId}
      equipmentId={equipmentId}
      equipmentExercises={equipmentExercises}
    />
  );
}
