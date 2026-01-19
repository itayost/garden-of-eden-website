"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Target, Plus, Trash2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { GoalManagementPanelProps } from "../types";
import { calculateGoalProgress } from "../lib/utils/goal-utils";
import { deleteGoal } from "../lib/actions/delete-goal";
import { GoalCard } from "./GoalCard";
import { SetGoalDialog } from "./SetGoalDialog";

/**
 * Panel for trainers to manage a player's goals
 * Used on the admin player detail page
 */
export function GoalManagementPanel({
  userId,
  playerName,
  currentMetrics,
  existingGoals,
}: GoalManagementPanelProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deletingGoalId, setDeletingGoalId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Calculate progress for all goals
  const goalsWithProgress = existingGoals.map(calculateGoalProgress);
  const activeGoals = goalsWithProgress.filter((g) => !g.is_achieved);
  const achievedGoals = goalsWithProgress.filter((g) => g.is_achieved);

  const handleDeleteGoal = (goalId: string) => {
    setDeletingGoalId(goalId);
    startTransition(async () => {
      const result = await deleteGoal(goalId);
      if (result.success) {
        toast.success("היעד נמחק בהצלחה");
      } else {
        toast.error(result.error || "שגיאה במחיקת היעד");
      }
      setDeletingGoalId(null);
    });
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Target className="h-5 w-5 text-primary" />
            ניהול יעדים - {playerName}
          </CardTitle>
          <Button
            size="sm"
            onClick={() => setIsDialogOpen(true)}
            className="gap-1"
          >
            <Plus className="h-4 w-4" />
            יעד חדש
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Active Goals */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              יעדים פעילים
              <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs">
                {activeGoals.length}
              </span>
            </h3>
            {activeGoals.length === 0 ? (
              <div className="text-center py-6 border rounded-lg bg-muted/50">
                <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm text-muted-foreground">אין יעדים פעילים</p>
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => setIsDialogOpen(true)}
                >
                  הוסף יעד חדש
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {activeGoals.map((goal) => (
                  <div key={goal.id} className="relative group">
                    <GoalCard goal={goal} />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 left-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleDeleteGoal(goal.id)}
                      disabled={isPending && deletingGoalId === goal.id}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Achieved Goals */}
          {achievedGoals.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                יעדים שהושגו
                <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs">
                  {achievedGoals.length}
                </span>
              </h3>
              <div className="space-y-3">
                {achievedGoals.map((goal) => (
                  <div key={goal.id} className="relative group">
                    <GoalCard goal={goal} />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 left-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                      onClick={() => handleDeleteGoal(goal.id)}
                      disabled={isPending && deletingGoalId === goal.id}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <SetGoalDialog
        userId={userId}
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        currentMetrics={currentMetrics}
        existingGoals={existingGoals}
      />
    </>
  );
}
