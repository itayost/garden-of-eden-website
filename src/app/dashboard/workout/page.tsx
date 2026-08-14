import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { TodayWorkout } from "@/components/dashboard/workout/TodayWorkout";
import {
  getEquipmentExercisesAction,
  getMyTodaySessionAction,
  getPreviousLogsAction,
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

  // The session and the scanned machine are independent lookups, and this is
  // the page a trainee opens standing at the equipment — run them together.
  // The free-log path covers a scan that matched no exercise in today's
  // session: it returns that machine's exercises and its profile.
  const [sessionResult, equipmentResult] = await Promise.all([
    getMyTodaySessionAction(),
    equipmentId ? getEquipmentExercisesAction(equipmentId) : null,
  ]);

  if ("error" in sessionResult && sessionResult.error === "לא מחובר") {
    redirect("/auth/login?redirect=/dashboard/workout");
  }

  const session = "success" in sessionResult ? sessionResult.data : null;
  const loadError = "error" in sessionResult ? sessionResult.error : null;

  const equipmentExercises =
    equipmentResult && "success" in equipmentResult ? equipmentResult.data : [];
  const freeLogEquipment =
    equipmentResult && "success" in equipmentResult
      ? equipmentResult.equipment
      : null;

  // "בפעם הקודמת" — the trainee's last log per exercise, excluding today's
  // rows so the hint never echoes the entry being edited. Depends on the
  // session, so it cannot join the batch above.
  const previousResult = session
    ? await getPreviousLogsAction(
        session.exercises.map((exercise) => exercise.exercise_id),
        session.exercises.map((exercise) => exercise.id),
      )
    : null;
  const previousLogs =
    previousResult && "success" in previousResult ? previousResult.data : {};

  return (
    <TodayWorkout
      session={session}
      loadError={loadError}
      focusId={focusId}
      equipmentId={equipmentId}
      equipmentExercises={equipmentExercises}
      previousLogs={previousLogs}
      freeLogEquipment={freeLogEquipment}
    />
  );
}
