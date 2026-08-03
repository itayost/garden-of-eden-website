import { redirect } from "next/navigation";

import { DailyBriefCard } from "@/components/admin/tasks/DailyBriefCard";
import { TaskDataTable } from "@/components/admin/tasks/TaskDataTable";
import { TasksReviewSection } from "@/components/admin/tasks/TasksReviewSection";
import { listTrainersForAssignmentAction } from "@/lib/actions/admin-trainers-list";
import { getLinkableTraineesAction, getTasksAction } from "@/lib/actions/admin-tasks";
import { getBriefAction } from "@/lib/actions/daily-briefs";
import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { israelToday } from "@/lib/utils/tasks";

export const metadata = { title: "משימות" };

export default async function TasksPage() {
  const { error: authError, user, profile } = await verifyAdminOrTrainer();
  if (authError) redirect("/dashboard");

  const isAdmin = profile!.role === "admin";
  const today = israelToday();

  // Independent queries — fetch in parallel rather than waterfalling.
  // The trainer and trainee rosters feed admin-only UI (the trainer filter and
  // the create/edit dialogs), so a trainer never fetches them — that would ship
  // every active trainee's name into their page payload for nothing.
  const [tasksResult, briefResult, trainersResult, traineesResult] = await Promise.all([
    getTasksAction(),
    getBriefAction(today),
    isAdmin ? listTrainersForAssignmentAction() : null,
    isAdmin ? getLinkableTraineesAction() : null,
  ]);

  const tasks = "success" in tasksResult ? tasksResult.data : [];
  const brief = "success" in briefResult ? briefResult.data : null;
  const trainers = trainersResult && "success" in trainersResult ? trainersResult.data : [];
  const trainees = traineesResult && "success" in traineesResult ? traineesResult.data : [];

  return (
    <div className="space-y-6">
      <DailyBriefCard brief={brief} briefDate={today} isAdmin={isAdmin} />

      {isAdmin && <TasksReviewSection tasks={tasks} today={today} />}

      <TaskDataTable
        tasks={tasks}
        isAdmin={isAdmin}
        currentUserId={user!.id}
        trainers={trainers}
        trainees={trainees}
        today={today}
      />
    </div>
  );
}
