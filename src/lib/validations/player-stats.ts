import { z } from "zod";

const statValue = z.number().min(1).max(99);

export const playerStatsSchema = z.object({
  position: z.string().min(1),
  card_type: z.enum(["standard", "gold", "silver", "bronze", "special"]),
  // Main stats
  pace: statValue,
  shooting: statValue,
  passing: statValue,
  dribbling: statValue,
  defending: statValue,
  physical: statValue,
  // Pace sub-stats
  acceleration: statValue,
  sprint_speed: statValue,
  agility: statValue,
  // Shooting sub-stats
  finishing: statValue,
  shot_power: statValue,
  long_shots: statValue,
  positioning: statValue,
  // Passing sub-stats
  vision: statValue,
  short_passing: statValue,
  long_passing: statValue,
  crossing: statValue,
  // Dribbling sub-stats
  ball_control: statValue,
  dribbling_skill: statValue,
  composure: statValue,
  reactions: statValue,
  // Defending sub-stats
  interceptions: statValue,
  tackling: statValue,
  marking: statValue,
  heading_accuracy: statValue,
  // Physical sub-stats
  stamina: statValue,
  strength: statValue,
  jumping: statValue,
  balance: statValue,
  // Training metrics
  focus: statValue,
  decision_making: statValue,
  work_rate: statValue,
  recovery: statValue,
  nutrition_score: statValue,
  // Notes
  notes: z.string().optional(),
});

export type PlayerStatsFormData = z.infer<typeof playerStatsSchema>;

// Default values for a new player
export const DEFAULT_PLAYER_STATS: PlayerStatsFormData = {
  position: "CM",
  card_type: "gold",
  pace: 50,
  shooting: 50,
  passing: 50,
  dribbling: 50,
  defending: 50,
  physical: 50,
  acceleration: 50,
  sprint_speed: 50,
  agility: 50,
  finishing: 50,
  shot_power: 50,
  long_shots: 50,
  positioning: 50,
  vision: 50,
  short_passing: 50,
  long_passing: 50,
  crossing: 50,
  ball_control: 50,
  dribbling_skill: 50,
  composure: 50,
  reactions: 50,
  interceptions: 50,
  tackling: 50,
  marking: 50,
  heading_accuracy: 50,
  stamina: 50,
  strength: 50,
  jumping: 50,
  balance: 50,
  focus: 50,
  decision_making: 50,
  work_rate: 50,
  recovery: 50,
  nutrition_score: 50,
  notes: "",
};
