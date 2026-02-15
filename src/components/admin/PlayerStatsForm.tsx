"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { savePlayerStatsAction } from "@/lib/actions/admin-player-stats";
import {
  playerStatsSchema,
  type PlayerStatsFormData,
  DEFAULT_PLAYER_STATS,
} from "@/lib/validations/player-stats";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import {
  STAT_LABELS_HE,
  POSITIONS,
  POSITION_LABELS_HE,
  CARD_TYPES,
  STAT_CATEGORIES,
  TRAINING_METRICS,
  getStatColor,
} from "@/types/player-stats";
import type { PlayerStats } from "@/types/database";
import { cn } from "@/lib/utils";
import { StatSlider } from "@/components/admin/stats";

interface PlayerStatsFormProps {
  userId: string;
  playerName: string;
  existingStats: PlayerStats | null;
}

export function PlayerStatsForm({
  userId,
  playerName,
  existingStats,
}: PlayerStatsFormProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const defaultValues: PlayerStatsFormData = existingStats
    ? {
        position: existingStats.position,
        card_type: existingStats.card_type as PlayerStatsFormData["card_type"],
        pace: existingStats.pace,
        shooting: existingStats.shooting,
        passing: existingStats.passing,
        dribbling: existingStats.dribbling,
        defending: existingStats.defending,
        physical: existingStats.physical,
        acceleration: existingStats.acceleration,
        sprint_speed: existingStats.sprint_speed,
        agility: existingStats.agility,
        finishing: existingStats.finishing,
        shot_power: existingStats.shot_power,
        long_shots: existingStats.long_shots,
        positioning: existingStats.positioning,
        vision: existingStats.vision,
        short_passing: existingStats.short_passing,
        long_passing: existingStats.long_passing,
        crossing: existingStats.crossing,
        ball_control: existingStats.ball_control,
        dribbling_skill: existingStats.dribbling_skill,
        composure: existingStats.composure,
        reactions: existingStats.reactions,
        interceptions: existingStats.interceptions,
        tackling: existingStats.tackling,
        marking: existingStats.marking,
        heading_accuracy: existingStats.heading_accuracy,
        stamina: existingStats.stamina,
        strength: existingStats.strength,
        jumping: existingStats.jumping,
        balance: existingStats.balance,
        focus: existingStats.focus,
        decision_making: existingStats.decision_making,
        work_rate: existingStats.work_rate,
        recovery: existingStats.recovery,
        nutrition_score: existingStats.nutrition_score,
        notes: existingStats.notes || "",
      }
    : DEFAULT_PLAYER_STATS;

  const form = useForm<PlayerStatsFormData>({
    resolver: zodResolver(playerStatsSchema),
    defaultValues,
  });

  // Calculate overall rating from main stats
  const calculateOverall = (data: PlayerStatsFormData): number => {
    const { pace, shooting, passing, dribbling, defending, physical } = data;
    return Math.round(
      (pace + shooting + passing + dribbling + defending + physical) / 6
    );
  };

  const onSubmit = async (data: PlayerStatsFormData) => {
    setLoading(true);

    try {
      const result = await savePlayerStatsAction(userId, data, existingStats?.id || null);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(existingStats ? "הסטטיסטיקות עודכנו בהצלחה!" : "כרטיס השחקן נוצר בהצלחה!");
      router.refresh();
    } catch (error: unknown) {
      console.error("Submit error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "שגיאה בשמירת הסטטיסטיקות";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Watch all main stats to calculate overall in real-time
  const watchedStats = form.watch([
    "pace",
    "shooting",
    "passing",
    "dribbling",
    "defending",
    "physical",
  ]);
  const currentOverall = Math.round(
    watchedStats.reduce((sum, val) => sum + val, 0) / 6
  );

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>מידע בסיסי</span>
              <span className={cn("text-2xl", getStatColor(currentOverall))}>
                דירוג: {currentOverall}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="position"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>עמדה</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="בחר עמדה" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {POSITIONS.map((pos) => (
                        <SelectItem key={pos} value={pos}>
                          {pos} - {POSITION_LABELS_HE[pos]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="card_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>סוג כרטיס</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="בחר סוג" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {CARD_TYPES.map(({ value, label }) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Stats Tabs */}
        <Tabs defaultValue="pace" className="w-full">
          <TabsList className="grid grid-cols-3 lg:grid-cols-6 mb-4 h-auto">
            {STAT_CATEGORIES.map((cat) => (
              <TabsTrigger key={cat.key} value={cat.key} className="text-xs sm:text-sm py-2">
                {STAT_LABELS_HE[cat.key]}
              </TabsTrigger>
            ))}
          </TabsList>

          {STAT_CATEGORIES.map((category) => (
            <TabsContent key={category.key} value={category.key}>
              <Card>
                <CardContent className="pt-6 space-y-6">
                  {/* Main stat */}
                  <FormField
                    control={form.control}
                    name={category.key as keyof PlayerStatsFormData}
                    render={({ field }) => (
                      <div className="p-4 bg-muted rounded-lg">
                        <StatSlider
                          label={`${STAT_LABELS_HE[category.key]} (ראשי)`}
                          value={field.value as number}
                          onChange={field.onChange}
                        />
                      </div>
                    )}
                  />

                  {/* Sub-stats */}
                  <div className="space-y-4">
                    {category.subStats.map((subStat) => (
                      <FormField
                        key={subStat}
                        control={form.control}
                        name={subStat as keyof PlayerStatsFormData}
                        render={({ field }) => (
                          <StatSlider
                            label={STAT_LABELS_HE[subStat]}
                            value={field.value as number}
                            onChange={field.onChange}
                          />
                        )}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>

        {/* Training Metrics */}
        <Card>
          <CardHeader>
            <CardTitle>מדדי אימון נוספים</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {TRAINING_METRICS.map((metric) => (
              <FormField
                key={metric}
                control={form.control}
                name={metric as keyof PlayerStatsFormData}
                render={({ field }) => (
                  <StatSlider
                    label={STAT_LABELS_HE[metric]}
                    value={field.value as number}
                    onChange={field.onChange}
                  />
                )}
              />
            ))}
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader>
            <CardTitle>הערות</CardTitle>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Textarea
                      placeholder="הערות על השחקן..."
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Submit Button */}
        <Button type="submit" className="w-full" size="lg" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="ml-2 h-5 w-5 animate-spin" />
              שומר...
            </>
          ) : (
            <>
              <Save className="ml-2 h-5 w-5" />
              {existingStats ? "עדכון סטטיסטיקות" : "יצירת כרטיס"}
            </>
          )}
        </Button>
      </form>
    </Form>
  );
}
