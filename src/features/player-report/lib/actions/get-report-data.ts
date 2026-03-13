"use server";

import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { isValidUUID, isValidDateRange } from "@/lib/validations/common";
import { createClient } from "@/lib/supabase/server";
import { fetchEntranceReport, calculateWeeklyAverage } from "@/lib/arbox/reports";
import { extractTraineeNotes } from "@/lib/utils/trainee-notes";
import { categorizeNotes } from "../utils/aggregate-notes";
import { getAgeGroup } from "@/types/assessment";
import {
  calculateCardRatings,
  calculateGroupStats,
  calculateNeutralRatings,
  getLatestAssessmentsPerUser,
} from "@/lib/assessment-to-rating";
import type { ReportData, TraineeAttendance } from "../../types";
import type { ShiftReportForNotes } from "@/lib/utils/trainee-notes";
import type { PlayerAssessment } from "@/types/assessment";

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
    .select("id, full_name, birthdate, position, club, avatar_url, processed_avatar_url, created_at, arbox_user_id, role")
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

  // Fetch age group assessments for percentile-based ratings
  let groupAssessments: PlayerAssessment[] = [];
  const ageGroup = getAgeGroup(profile.birthdate);

  if (ageGroup) {
    // Find all trainees in the same age group
    const { data: traineeProfiles } = await supabase
      .from("profiles")
      .select("id, birthdate")
      .eq("role", "trainee");

    const sameAgeGroupIds = (traineeProfiles ?? [])
      .filter((p) => {
        const pGroup = getAgeGroup(p.birthdate);
        return pGroup?.id === ageGroup.id;
      })
      .map((p) => p.id);

    if (sameAgeGroupIds.length > 1) {
      const { data: fetchedGroupAssessments } = await supabase
        .from("player_assessments")
        .select("*")
        .in("user_id", sameAgeGroupIds)
        .is("deleted_at", null);

      groupAssessments = (fetchedGroupAssessments ?? []) as PlayerAssessment[];
    }
  }

  // Fetch pre-computed stats (may be null for most users)
  const { data: preComputedStats } = await supabase
    .from("player_stats")
    .select("overall_rating, pace, shooting, passing, dribbling, defending, physical, card_type")
    .eq("user_id", userId)
    .single();

  // Compute ratings dynamically when player_stats is empty but assessments exist
  const typedAssessments = (assessments ?? []) as PlayerAssessment[];
  const computedStats = (() => {
    if (preComputedStats) {
      return {
        overall_rating: preComputedStats.overall_rating,
        pace: preComputedStats.pace,
        shooting: preComputedStats.shooting,
        passing: preComputedStats.passing,
        dribbling: preComputedStats.dribbling,
        defending: preComputedStats.defending,
        physical: preComputedStats.physical,
        card_type: preComputedStats.card_type ?? null,
      };
    }
    if (typedAssessments.length === 0) return null;

    const latestAssessment = typedAssessments[0]!;
    if (groupAssessments.length > 1) {
      const latestPerUser = getLatestAssessmentsPerUser(groupAssessments);
      const groupStats = calculateGroupStats(latestPerUser);
      const ratings = calculateCardRatings(latestAssessment, groupStats);
      return { ...ratings, card_type: null };
    }
    const ratings = calculateNeutralRatings();
    return { ...ratings, card_type: null };
  })();

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
        processed_avatar_url: profile.processed_avatar_url ?? null,
        created_at: profile.created_at,
      },
      assessments: typedAssessments,
      groupAssessments,
      stats: computedStats,
      attendance,
      strengths,
      weaknesses,
      socialSkills,
      latestSummary: latestSummary ?? null,
    },
  };
}
