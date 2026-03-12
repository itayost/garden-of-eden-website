import { z } from "zod";

const playerAssessmentSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  assessment_date: z.string(),
  sprint_5m: z.number().nullable(),
  sprint_10m: z.number().nullable(),
  sprint_20m: z.number().nullable(),
  jump_2leg_height: z.number().nullable(),
  jump_2leg_distance: z.number().nullable(),
  jump_right_leg: z.number().nullable(),
  jump_left_leg: z.number().nullable(),
  blaze_spot_time: z.number().nullable(),
  kick_power_kaiser: z.number().nullable(),
  flexibility_ankle: z.number().nullable(),
  flexibility_knee: z.number().nullable(),
  flexibility_hip: z.number().nullable(),
  coordination: z.enum(["basic", "advanced", "deficient"]).nullable(),
  leg_power_technique: z.enum(["normal", "deficient"]).nullable(),
  body_structure: z.enum(["thin_weak", "good_build", "strong_athletic"]).nullable(),
  concentration_notes: z.string().nullable(),
  decision_making_notes: z.string().nullable(),
  work_ethic_notes: z.string().nullable(),
  recovery_notes: z.string().nullable(),
  nutrition_notes: z.string().nullable(),
  assessed_by: z.string().nullable(),
  notes: z.string().nullable(),
  created_at: z.string(),
});

export const playerReportPdfBodySchema = z.object({
  profile: z.object({
    full_name: z.string().max(100).nullable(),
    birthdate: z.string().nullable(),
    position: z.string().max(50).nullable(),
    club: z.string().max(100).nullable(),
    created_at: z.string(),
    processed_avatar_url: z.string().url().nullable(),
  }),
  assessments: z.array(playerAssessmentSchema),
  stats: z.object({
    overall_rating: z.number(),
    pace: z.number(),
    shooting: z.number(),
    passing: z.number(),
    dribbling: z.number(),
    defending: z.number(),
    physical: z.number(),
    card_type: z.string().nullable(),
  }).nullable(),
  attendance: z.object({
    totalSessions: z.number(),
    weeklyAverage: z.number(),
  }).nullable(),
  summary: z.string().max(2000),
  strengths: z.array(z.string().max(200)).max(20),
  weaknesses: z.array(z.string().max(200)).max(20),
  socialSkills: z.array(z.string().max(200)).max(20),
});

export type PlayerReportPdfBody = z.infer<typeof playerReportPdfBodySchema>;
