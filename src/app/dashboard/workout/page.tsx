import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { TodayWorkout } from "@/components/dashboard/workout/TodayWorkout";
import {
  getEquipmentExercisesAction,
  getMyTodaySessionsAction,
  getPreviousLogsAction,
} from "@/lib/actions/trainee-workout";
import { pickOpenSession } from "@/lib/schedule/open-session";
import { israelMinutesOfDay } from "@/lib/utils/israel-time";
import { isValidUUID } from "@/lib/validations/common";

export const metadata: Metadata = {
  title: "האימון שלי | Garden of Eden",
};

interface PageProps {
  searchParams: Promise<{ focus?: string; equipment?: string; open?: string }>;
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
  const [sessionsResult, equipmentResult] = await Promise.all([
    getMyTodaySessionsAction(),
    equipmentId ? getEquipmentExercisesAction(equipmentId) : null,
  ]);

  if ("error" in sessionsResult && sessionsResult.error === "לא מחובר") {
    redirect("/auth/login?redirect=/dashboard/workout");
  }

  const sessions = "success" in sessionsResult ? sessionsResult.data : [];
  const loadError = "error" in sessionsResult ? sessionsResult.error : null;

  const requestedId =
    params.open && isValidUUID(params.open) ? params.open : null;
  const chosen =
    requestedId && sessions.some((session) => session.id === requestedId)
      ? requestedId
      : null;

  // An explicit choice beats the clock; a stale id from an old link does not.
  // The clock is read here, on the server, so the picker stays pure.
  const openId =
    chosen ??
    pickOpenSession(
      sessions.map((session) => ({
        id: session.id,
        slotStartTime: session.slotStartTime,
        exerciseIds: session.exercises.map((exercise) => exercise.id),
      })),
      israelMinutesOfDay(new Date()),
      focusId,
    );

  const equipmentExercises =
    equipmentResult && "success" in equipmentResult ? equipmentResult.data : [];
  const freeLogEquipment =
    equipmentResult && "success" in equipmentResult
      ? equipmentResult.equipment
      : null;

  // "בפעם הקודמת" — the trainee's last log per exercise, excluding today's
  // rows so the hint never echoes the entry being edited. Depends on the
  // session, so it cannot join the batch above. Only the open one: switching
  // hours is a navigation, so this runs again with the other session.
  const openSession = sessions.find((session) => session.id === openId) ?? null;
  const previousResult = openSession
    ? await getPreviousLogsAction(
        openSession.exercises.map((exercise) => exercise.exercise_id),
        openSession.exercises.map((exercise) => exercise.id),
      )
    : null;
  const previousLogs =
    previousResult && "success" in previousResult ? previousResult.data : {};

  return (
    <TodayWorkout
      sessions={sessions}
      openId={openId}
      loadError={loadError}
      focusId={focusId}
      equipmentId={equipmentId}
      equipmentExercises={equipmentExercises}
      previousLogs={previousLogs}
      freeLogEquipment={freeLogEquipment}
    />
  );
}
