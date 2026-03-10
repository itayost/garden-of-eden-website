"use server";

import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { isValidUUID, isValidDateRange } from "@/lib/validations/common";
import { createClient } from "@/lib/supabase/server";
import { fetchEntranceReport, calculateWeeklyAverage } from "@/lib/arbox/reports";
import { extractTraineeNotes } from "@/lib/utils/trainee-notes";
import { categorizeNotes } from "../utils/aggregate-notes";
import type { ReportData, TraineeAttendance } from "../../types";
import type { ShiftReportForNotes } from "@/lib/utils/trainee-notes";

export async function getReportData(
  userId: string,
  fromDate: string,
  toDate: string,
): Promise<{ error: string | null; data: ReportData | null }> {
  const auth = await verifyAdminOrTrainer();
  if (auth.error) {
    return { error: auth.error, data: null };
  }

  if (!isValidUUID(userId)) {
    return { error: "מזהה משתמש לא תקין", data: null };
  }

  if (!isValidDateRange(fromDate, toDate)) {
    return { error: "טווח תאריכים לא תקין", data: null };
  }

  const supabase = await createClient();

  // Fetch profile
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, birthdate, position, club, avatar_url, created_at, arbox_user_id, role")
    .eq("id", userId)
    .single();

  if (profileError || !profile) {
    return { error: "משתמש לא נמצא", data: null };
  }

  // Trainers can only view reports for trainees (not other trainers/admins)
  if (auth.profile?.role === "trainer" && profile.role !== "trainee") {
    return { error: "אין הרשאה לצפות בדוח זה", data: null };
  }

  // Fetch assessments (all, sorted newest first)
  const { data: assessments } = await supabase
    .from("player_assessments")
    .select("*")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("assessment_date", { ascending: false });

  // Fetch latest stats
  const { data: stats } = await supabase
    .from("player_stats")
    .select("overall_rating, pace, shooting, passing, dribbling, defending, physical")
    .eq("user_id", userId)
    .single();

  // Fetch shift reports mentioning this trainee in date range
  const { data: shiftReports } = await supabase
    .from("trainer_shift_reports")
    .select("id, report_date, trainer_name, new_trainees_ids, new_trainees_details, discipline_trainee_ids, discipline_details, injuries_trainee_ids, injuries_details, limitations_trainee_ids, limitations_details, achievements_trainee_ids, achievements_details, achievements_per_trainee, mental_state_trainee_ids, mental_state_details, complaints_trainee_ids, complaints_details, insufficient_attention_trainee_ids, insufficient_attention_details, pro_candidates_trainee_ids, pro_candidates_details, has_social_skills, social_skills_trainee_ids, social_skills_details")
    .gte("report_date", fromDate)
    .lte("report_date", toDate)
    .order("report_date", { ascending: false })
    .limit(500);

  const notes = extractTraineeNotes(
    (shiftReports ?? []) as unknown as ShiftReportForNotes[],
    userId,
  );
  const { strengths, weaknesses, socialSkills } = categorizeNotes(notes);

  // Fetch attendance from Arbox (graceful fallback)
  let attendance: TraineeAttendance | null = null;
  if (profile.arbox_user_id) {
    try {
      const entranceData = await fetchEntranceReport(fromDate, toDate);
      const userEntries = entranceData.filter(
        (e) => e.user_id === profile.arbox_user_id,
      );
      attendance = {
        totalSessions: userEntries.length,
        weeklyAverage: calculateWeeklyAverage(userEntries.length, fromDate, toDate),
        sessions: userEntries.map((e) => ({
          date: e.date,
          className: e.class_name,
        })),
      };
    } catch {
      // Arbox API failure is non-blocking
      attendance = null;
    }
  }

  // Fetch latest summary
  const { data: latestSummary } = await supabase
    .from("trainee_summaries")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    error: null,
    data: {
      profile: {
        id: profile.id,
        full_name: profile.full_name,
        birthdate: profile.birthdate,
        position: profile.position,
        club: profile.club,
        avatar_url: profile.avatar_url,
        created_at: profile.created_at,
      },
      assessments: assessments ?? [],
      stats: stats ?? null,
      attendance,
      strengths,
      weaknesses,
      socialSkills,
      latestSummary: latestSummary ?? null,
    },
  };
}
