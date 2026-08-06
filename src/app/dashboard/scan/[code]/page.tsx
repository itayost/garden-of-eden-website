import { redirect } from "next/navigation";

import {
  getMyTodaySessionAction,
  resolveEquipmentCodeAction,
} from "@/lib/actions/trainee-workout";
import { findScanTarget } from "@/lib/utils/scan-match";

interface PageProps {
  params: Promise<{ code: string }>;
}

/**
 * The QR landing route. The sticker on each machine encodes this URL; the
 * phone's native camera opens it and the login flow round-trips the deep link.
 *
 * Only trainees reach this page: the middleware bounces unauthenticated users
 * to login (preserving the deep link) and redirects staff hitting /dashboard/*
 * to /admin before the page runs. So no auth or role branches here.
 *
 * Resolution: scanned equipment → the trainee's today session → the first
 * unlogged exercise on that equipment → the workout page with its log form
 * open. No match → the workout page in free-log mode for that equipment.
 * This page renders nothing itself — it only decides where to land.
 */
export default async function ScanPage({ params }: PageProps) {
  const { code } = await params;

  const equipmentResult = await resolveEquipmentCodeAction(code);
  const equipment =
    "success" in equipmentResult ? equipmentResult.data : null;
  // Unknown or inactive code: land on the workout page rather than a dead end.
  if (!equipment) redirect("/dashboard/workout");

  const sessionResult = await getMyTodaySessionAction();
  const session = "success" in sessionResult ? sessionResult.data : null;

  if (session) {
    const target = findScanTarget(
      session.exercises.map((exercise) => ({
        sessionExerciseId: exercise.id,
        equipmentId: exercise.exercise?.equipment_id ?? null,
        hasLog: (exercise.logs?.length ?? 0) > 0,
      })),
      equipment.id,
    );

    if (target) {
      redirect(`/dashboard/workout?focus=${target}&equipment=${equipment.id}`);
    }
  }

  redirect(`/dashboard/workout?equipment=${equipment.id}`);
}
