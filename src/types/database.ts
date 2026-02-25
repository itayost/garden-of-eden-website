export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = "trainee" | "trainer" | "admin";

export interface Database {
  // Required for proper Supabase client type inference
  __InternalSupabase: {
    PostgrestVersion: "14.1";
  };
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          phone: string | null;
          role: UserRole;
          birthdate: string | null;
          position: string | null;
          avatar_url: string | null;
          processed_avatar_url: string | null;
          profile_completed: boolean;
          is_active: boolean;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          phone?: string | null;
          role?: UserRole;
          birthdate?: string | null;
          position?: string | null;
          avatar_url?: string | null;
          processed_avatar_url?: string | null;
          profile_completed?: boolean;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          phone?: string | null;
          role?: UserRole;
          birthdate?: string | null;
          position?: string | null;
          avatar_url?: string | null;
          processed_avatar_url?: string | null;
          profile_completed?: boolean;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      activity_logs: {
        Row: {
          id: string;
          user_id: string;
          action: string;
          actor_id: string | null;
          actor_name: string | null;
          metadata: Json | null;
          changes: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          action: string;
          actor_id?: string | null;
          actor_name?: string | null;
          metadata?: Json | null;
          changes?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          action?: string;
          actor_id?: string | null;
          actor_name?: string | null;
          metadata?: Json | null;
          changes?: Json | null;
          created_at?: string;
        };
        Relationships: [];
      };
      trainers: {
        Row: {
          id: string;
          name: string;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      pre_workout_forms: {
        Row: {
          id: string;
          user_id: string;
          full_name: string;
          age: number | null;
          group_training: string | null;
          urine_color: string | null;
          nutrition_status: string | null;
          last_game: string | null;
          improvements_desired: string | null;
          sleep_hours: string | null;
          recent_injury: string | null;
          next_match: string | null;
          submitted_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          full_name: string;
          age?: number | null;
          group_training?: string | null;
          urine_color?: string | null;
          nutrition_status?: string | null;
          last_game?: string | null;
          improvements_desired?: string | null;
          sleep_hours?: string | null;
          recent_injury?: string | null;
          next_match?: string | null;
          submitted_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          full_name?: string;
          age?: number | null;
          group_training?: string | null;
          urine_color?: string | null;
          nutrition_status?: string | null;
          last_game?: string | null;
          improvements_desired?: string | null;
          sleep_hours?: string | null;
          recent_injury?: string | null;
          next_match?: string | null;
          submitted_at?: string;
        };
        Relationships: [];
      };
      post_workout_forms: {
        Row: {
          id: string;
          user_id: string;
          full_name: string;
          training_date: string;
          trainer_id: string | null;
          difficulty_level: number;
          satisfaction_level: number;
          comments: string | null;
          contact_info: string | null;
          submitted_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          full_name: string;
          training_date: string;
          trainer_id?: string | null;
          difficulty_level: number;
          satisfaction_level: number;
          comments?: string | null;
          contact_info?: string | null;
          submitted_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          full_name?: string;
          training_date?: string;
          trainer_id?: string | null;
          difficulty_level?: number;
          satisfaction_level?: number;
          comments?: string | null;
          contact_info?: string | null;
          submitted_at?: string;
        };
        Relationships: [];
      };
      nutrition_forms: {
        Row: {
          id: string;
          user_id: string;
          full_name: string;
          age: number;
          years_competitive: string | null;
          previous_counseling: boolean;
          counseling_details: string | null;
          weight: number | null;
          height: number | null;
          allergies: boolean;
          allergies_details: string | null;
          chronic_conditions: boolean;
          conditions_details: string | null;
          medications: string | null;
          medications_list: string | null;
          bloating_frequency: number | null;
          stomach_pain: number | null;
          bowel_frequency: number | null;
          stool_consistency: string | null;
          overuse_injuries: string | null;
          illness_interruptions: number | null;
          max_days_missed: number | null;
          fatigue_level: number | null;
          concentration: number | null;
          energy_level: number | null;
          muscle_soreness: number | null;
          physical_exhaustion: number | null;
          preparedness: number | null;
          overall_energy: number | null;
          additional_comments: string | null;
          submitted_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          full_name: string;
          age: number;
          years_competitive?: string | null;
          previous_counseling?: boolean;
          counseling_details?: string | null;
          weight?: number | null;
          height?: number | null;
          allergies?: boolean;
          allergies_details?: string | null;
          chronic_conditions?: boolean;
          conditions_details?: string | null;
          medications?: string | null;
          medications_list?: string | null;
          bloating_frequency?: number | null;
          stomach_pain?: number | null;
          bowel_frequency?: number | null;
          stool_consistency?: string | null;
          overuse_injuries?: string | null;
          illness_interruptions?: number | null;
          max_days_missed?: number | null;
          fatigue_level?: number | null;
          concentration?: number | null;
          energy_level?: number | null;
          muscle_soreness?: number | null;
          physical_exhaustion?: number | null;
          preparedness?: number | null;
          overall_energy?: number | null;
          additional_comments?: string | null;
          submitted_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          full_name?: string;
          age?: number;
          years_competitive?: string | null;
          previous_counseling?: boolean;
          counseling_details?: string | null;
          weight?: number | null;
          height?: number | null;
          allergies?: boolean;
          allergies_details?: string | null;
          chronic_conditions?: boolean;
          conditions_details?: string | null;
          medications?: string | null;
          medications_list?: string | null;
          bloating_frequency?: number | null;
          stomach_pain?: number | null;
          bowel_frequency?: number | null;
          stool_consistency?: string | null;
          overuse_injuries?: string | null;
          illness_interruptions?: number | null;
          max_days_missed?: number | null;
          fatigue_level?: number | null;
          concentration?: number | null;
          energy_level?: number | null;
          muscle_soreness?: number | null;
          physical_exhaustion?: number | null;
          preparedness?: number | null;
          overall_energy?: number | null;
          additional_comments?: string | null;
          submitted_at?: string;
        };
        Relationships: [];
      };
      workout_videos: {
        Row: {
          id: string;
          day_number: number;
          day_topic: string;
          title: string;
          youtube_url: string;
          description: string | null;
          duration_minutes: number;
          order_index: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          day_number: number;
          day_topic: string;
          title: string;
          youtube_url: string;
          description?: string | null;
          duration_minutes: number;
          order_index: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          day_number?: number;
          day_topic?: string;
          title?: string;
          youtube_url?: string;
          description?: string | null;
          duration_minutes?: number;
          order_index?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      video_progress: {
        Row: {
          id: string;
          user_id: string;
          video_id: string;
          watched: boolean;
          watched_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          video_id: string;
          watched?: boolean;
          watched_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          video_id?: string;
          watched?: boolean;
          watched_at?: string | null;
        };
        Relationships: [];
      };
      player_stats: {
        Row: {
          id: string;
          user_id: string;
          position: string;
          card_type: string;
          overall_rating: number;
          avatar_url: string | null;
          pace: number;
          shooting: number;
          passing: number;
          dribbling: number;
          defending: number;
          physical: number;
          acceleration: number;
          sprint_speed: number;
          agility: number;
          finishing: number;
          shot_power: number;
          long_shots: number;
          positioning: number;
          vision: number;
          short_passing: number;
          long_passing: number;
          crossing: number;
          ball_control: number;
          dribbling_skill: number;
          composure: number;
          reactions: number;
          interceptions: number;
          tackling: number;
          marking: number;
          heading_accuracy: number;
          stamina: number;
          strength: number;
          jumping: number;
          balance: number;
          focus: number;
          decision_making: number;
          work_rate: number;
          recovery: number;
          nutrition_score: number;
          last_updated_by: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          position?: string;
          card_type?: string;
          overall_rating?: number;
          avatar_url?: string | null;
          pace?: number;
          shooting?: number;
          passing?: number;
          dribbling?: number;
          defending?: number;
          physical?: number;
          acceleration?: number;
          sprint_speed?: number;
          agility?: number;
          finishing?: number;
          shot_power?: number;
          long_shots?: number;
          positioning?: number;
          vision?: number;
          short_passing?: number;
          long_passing?: number;
          crossing?: number;
          ball_control?: number;
          dribbling_skill?: number;
          composure?: number;
          reactions?: number;
          interceptions?: number;
          tackling?: number;
          marking?: number;
          heading_accuracy?: number;
          stamina?: number;
          strength?: number;
          jumping?: number;
          balance?: number;
          focus?: number;
          decision_making?: number;
          work_rate?: number;
          recovery?: number;
          nutrition_score?: number;
          last_updated_by?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          position?: string;
          card_type?: string;
          overall_rating?: number;
          avatar_url?: string | null;
          pace?: number;
          shooting?: number;
          passing?: number;
          dribbling?: number;
          defending?: number;
          physical?: number;
          acceleration?: number;
          sprint_speed?: number;
          agility?: number;
          finishing?: number;
          shot_power?: number;
          long_shots?: number;
          positioning?: number;
          vision?: number;
          short_passing?: number;
          long_passing?: number;
          crossing?: number;
          ball_control?: number;
          dribbling_skill?: number;
          composure?: number;
          reactions?: number;
          interceptions?: number;
          tackling?: number;
          marking?: number;
          heading_accuracy?: number;
          stamina?: number;
          strength?: number;
          jumping?: number;
          balance?: number;
          focus?: number;
          decision_making?: number;
          work_rate?: number;
          recovery?: number;
          nutrition_score?: number;
          last_updated_by?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      player_stats_history: {
        Row: {
          id: string;
          player_stats_id: string;
          user_id: string;
          overall_rating: number;
          pace: number;
          shooting: number;
          passing: number;
          dribbling: number;
          defending: number;
          physical: number;
          updated_by: string | null;
          update_reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          player_stats_id: string;
          user_id: string;
          overall_rating: number;
          pace: number;
          shooting: number;
          passing: number;
          dribbling: number;
          defending: number;
          physical: number;
          updated_by?: string | null;
          update_reason?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          player_stats_id?: string;
          user_id?: string;
          overall_rating?: number;
          pace?: number;
          shooting?: number;
          passing?: number;
          dribbling?: number;
          defending?: number;
          physical?: number;
          updated_by?: string | null;
          update_reason?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      user_streaks: {
        Row: {
          user_id: string;
          current_streak: number;
          longest_streak: number;
          last_activity_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          current_streak?: number;
          longest_streak?: number;
          last_activity_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          current_streak?: number;
          longest_streak?: number;
          last_activity_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      player_assessments: {
        Row: {
          id: string;
          user_id: string;
          assessment_date: string;
          sprint_5m: number | null;
          sprint_10m: number | null;
          sprint_20m: number | null;
          jump_2leg_distance: number | null;
          jump_right_leg: number | null;
          jump_left_leg: number | null;
          jump_2leg_height: number | null;
          blaze_spot_time: number | null;
          flexibility_ankle: number | null;
          flexibility_knee: number | null;
          flexibility_hip: number | null;
          coordination: "basic" | "advanced" | "deficient" | null;
          leg_power_technique: "normal" | "deficient" | null;
          body_structure: "thin_weak" | "good_build" | "strong_athletic" | null;
          kick_power_kaiser: number | null;
          concentration_notes: string | null;
          decision_making_notes: string | null;
          work_ethic_notes: string | null;
          recovery_notes: string | null;
          nutrition_notes: string | null;
          assessed_by: string | null;
          notes: string | null;
          created_at: string;
          deleted_at: string | null;
          deleted_by: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          assessment_date?: string;
          sprint_5m?: number | null;
          sprint_10m?: number | null;
          sprint_20m?: number | null;
          jump_2leg_distance?: number | null;
          jump_right_leg?: number | null;
          jump_left_leg?: number | null;
          jump_2leg_height?: number | null;
          blaze_spot_time?: number | null;
          flexibility_ankle?: number | null;
          flexibility_knee?: number | null;
          flexibility_hip?: number | null;
          coordination?: "basic" | "advanced" | "deficient" | null;
          leg_power_technique?: "normal" | "deficient" | null;
          body_structure?: "thin_weak" | "good_build" | "strong_athletic" | null;
          kick_power_kaiser?: number | null;
          concentration_notes?: string | null;
          decision_making_notes?: string | null;
          work_ethic_notes?: string | null;
          recovery_notes?: string | null;
          nutrition_notes?: string | null;
          assessed_by?: string | null;
          notes?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          assessment_date?: string;
          sprint_5m?: number | null;
          sprint_10m?: number | null;
          sprint_20m?: number | null;
          jump_2leg_distance?: number | null;
          jump_right_leg?: number | null;
          jump_left_leg?: number | null;
          jump_2leg_height?: number | null;
          blaze_spot_time?: number | null;
          flexibility_ankle?: number | null;
          flexibility_knee?: number | null;
          flexibility_hip?: number | null;
          coordination?: "basic" | "advanced" | "deficient" | null;
          leg_power_technique?: "normal" | "deficient" | null;
          body_structure?: "thin_weak" | "good_build" | "strong_athletic" | null;
          kick_power_kaiser?: number | null;
          concentration_notes?: string | null;
          decision_making_notes?: string | null;
          work_ethic_notes?: string | null;
          recovery_notes?: string | null;
          nutrition_notes?: string | null;
          assessed_by?: string | null;
          notes?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
        };
        Relationships: [];
      };
      player_goals: {
        Row: {
          id: string;
          user_id: string;
          metric_key: string;
          target_value: number;
          baseline_value: number | null;
          current_value: number | null;
          is_lower_better: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          achieved_at: string | null;
          achieved_value: number | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          metric_key: string;
          target_value: number;
          baseline_value?: number | null;
          current_value?: number | null;
          is_lower_better: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          achieved_at?: string | null;
          achieved_value?: number | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          metric_key?: string;
          target_value?: number;
          baseline_value?: number | null;
          current_value?: number | null;
          is_lower_better?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          achieved_at?: string | null;
          achieved_value?: number | null;
        };
        Relationships: [];
      };
      payments: {
        Row: {
          id: string;
          user_id: string | null;
          process_id: string;
          process_token: string;
          transaction_id: string | null;
          transaction_token: string | null;
          asmachta: string | null;
          amount: number;
          description: string;
          payment_type: "one_time" | "recurring";
          status: "pending" | "completed" | "failed" | "cancelled";
          status_code: string | null;
          card_suffix: string | null;
          card_type: string | null;
          card_brand: string | null;
          card_exp: string | null;
          payer_name: string;
          payer_phone: string;
          payer_email: string | null;
          payments_num: number | null;
          all_payments_num: number | null;
          first_payment_sum: number | null;
          periodical_payment_sum: number | null;
          webhook_received_at: string | null;
          approved_at: string | null;
          custom_fields: Json | null;
          raw_webhook_data: Json | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          process_id: string;
          process_token: string;
          transaction_id?: string | null;
          transaction_token?: string | null;
          asmachta?: string | null;
          amount: number;
          description: string;
          payment_type: "one_time" | "recurring";
          status?: "pending" | "completed" | "failed" | "cancelled";
          status_code?: string | null;
          card_suffix?: string | null;
          card_type?: string | null;
          card_brand?: string | null;
          card_exp?: string | null;
          payer_name: string;
          payer_phone: string;
          payer_email?: string | null;
          payments_num?: number | null;
          all_payments_num?: number | null;
          first_payment_sum?: number | null;
          periodical_payment_sum?: number | null;
          webhook_received_at?: string | null;
          approved_at?: string | null;
          custom_fields?: Json | null;
          raw_webhook_data?: Json | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          process_id?: string;
          process_token?: string;
          transaction_id?: string | null;
          transaction_token?: string | null;
          asmachta?: string | null;
          amount?: number;
          description?: string;
          payment_type?: "one_time" | "recurring";
          status?: "pending" | "completed" | "failed" | "cancelled";
          status_code?: string | null;
          card_suffix?: string | null;
          card_type?: string | null;
          card_brand?: string | null;
          card_exp?: string | null;
          payer_name?: string;
          payer_phone?: string;
          payer_email?: string | null;
          payments_num?: number | null;
          all_payments_num?: number | null;
          first_payment_sum?: number | null;
          periodical_payment_sum?: number | null;
          webhook_received_at?: string | null;
          approved_at?: string | null;
          custom_fields?: Json | null;
          raw_webhook_data?: Json | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      user_achievements: {
        Row: {
          id: string;
          user_id: string;
          badge_type: string;
          unlocked_at: string;
          metadata: Record<string, unknown> | null;
          celebrated: boolean;
        };
        Insert: {
          id?: string;
          user_id: string;
          badge_type: string;
          unlocked_at?: string;
          metadata?: Record<string, unknown> | null;
          celebrated?: boolean;
        };
        Update: {
          id?: string;
          user_id?: string;
          badge_type?: string;
          unlocked_at?: string;
          metadata?: Record<string, unknown> | null;
          celebrated?: boolean;
        };
        Relationships: [];
      };
      trainee_meal_plans: {
        Row: {
          id: string;
          user_id: string;
          meal_plan: Json;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          meal_plan?: Json;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          meal_plan?: Json;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      trainer_shift_reports: {
        Row: {
          id: string;
          trainer_id: string;
          trainer_name: string;
          report_date: string;
          trained_new_trainees: boolean;
          new_trainees_ids: string[];
          new_trainees_details: string | null;
          has_discipline_issues: boolean;
          discipline_trainee_ids: string[];
          discipline_details: string | null;
          has_injuries: boolean;
          injuries_trainee_ids: string[];
          injuries_details: string | null;
          has_physical_limitations: boolean;
          limitations_trainee_ids: string[];
          limitations_details: string | null;
          has_achievements: boolean;
          achievements_trainee_ids: string[];
          achievements_details: string | null;
          achievements_per_trainee: Record<string, { details?: string; categories: string[] }> | null;
          has_poor_mental_state: boolean;
          mental_state_trainee_ids: string[];
          mental_state_details: string | null;
          has_complaints: boolean;
          complaints_trainee_ids: string[];
          complaints_details: string | null;
          has_insufficient_attention: boolean;
          insufficient_attention_trainee_ids: string[];
          insufficient_attention_details: string | null;
          has_pro_candidates: boolean;
          pro_candidates_trainee_ids: string[];
          pro_candidates_details: string | null;
          has_parent_seeking_staff: boolean;
          parent_seeking_details: string | null;
          has_external_visitors: boolean;
          external_visitors_details: string | null;
          has_parent_complaints: boolean;
          parent_complaints_details: string | null;
          facility_left_clean: boolean;
          facility_not_clean_reason: string | null;
          facility_cleaned_scheduled: boolean;
          facility_not_cleaned_reason: string | null;
          submitted_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          trainer_id: string;
          trainer_name: string;
          report_date: string;
          trained_new_trainees?: boolean;
          new_trainees_ids?: string[];
          new_trainees_details?: string | null;
          has_discipline_issues?: boolean;
          discipline_trainee_ids?: string[];
          discipline_details?: string | null;
          has_injuries?: boolean;
          injuries_trainee_ids?: string[];
          injuries_details?: string | null;
          has_physical_limitations?: boolean;
          limitations_trainee_ids?: string[];
          limitations_details?: string | null;
          has_achievements?: boolean;
          achievements_trainee_ids?: string[];
          achievements_details?: string | null;
          achievements_per_trainee?: Record<string, { details?: string; categories: string[] }> | null;
          has_poor_mental_state?: boolean;
          mental_state_trainee_ids?: string[];
          mental_state_details?: string | null;
          has_complaints?: boolean;
          complaints_trainee_ids?: string[];
          complaints_details?: string | null;
          has_insufficient_attention?: boolean;
          insufficient_attention_trainee_ids?: string[];
          insufficient_attention_details?: string | null;
          has_pro_candidates?: boolean;
          pro_candidates_trainee_ids?: string[];
          pro_candidates_details?: string | null;
          has_parent_seeking_staff?: boolean;
          parent_seeking_details?: string | null;
          has_external_visitors?: boolean;
          external_visitors_details?: string | null;
          has_parent_complaints?: boolean;
          parent_complaints_details?: string | null;
          facility_left_clean?: boolean;
          facility_not_clean_reason?: string | null;
          facility_cleaned_scheduled?: boolean;
          facility_not_cleaned_reason?: string | null;
          submitted_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          trainer_id?: string;
          trainer_name?: string;
          report_date?: string;
          trained_new_trainees?: boolean;
          new_trainees_ids?: string[];
          new_trainees_details?: string | null;
          has_discipline_issues?: boolean;
          discipline_trainee_ids?: string[];
          discipline_details?: string | null;
          has_injuries?: boolean;
          injuries_trainee_ids?: string[];
          injuries_details?: string | null;
          has_physical_limitations?: boolean;
          limitations_trainee_ids?: string[];
          limitations_details?: string | null;
          has_achievements?: boolean;
          achievements_trainee_ids?: string[];
          achievements_details?: string | null;
          achievements_per_trainee?: Record<string, { details?: string; categories: string[] }> | null;
          has_poor_mental_state?: boolean;
          mental_state_trainee_ids?: string[];
          mental_state_details?: string | null;
          has_complaints?: boolean;
          complaints_trainee_ids?: string[];
          complaints_details?: string | null;
          has_insufficient_attention?: boolean;
          insufficient_attention_trainee_ids?: string[];
          insufficient_attention_details?: string | null;
          has_pro_candidates?: boolean;
          pro_candidates_trainee_ids?: string[];
          pro_candidates_details?: string | null;
          has_parent_seeking_staff?: boolean;
          parent_seeking_details?: string | null;
          has_external_visitors?: boolean;
          external_visitors_details?: string | null;
          has_parent_complaints?: boolean;
          parent_complaints_details?: string | null;
          facility_left_clean?: boolean;
          facility_not_clean_reason?: string | null;
          facility_cleaned_scheduled?: boolean;
          facility_not_cleaned_reason?: string | null;
          submitted_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      trainer_shifts: {
        Row: {
          id: string;
          trainer_id: string;
          trainer_name: string;
          start_time: string;
          end_time: string | null;
          auto_ended: boolean;
          flagged_for_review: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          trainer_id: string;
          trainer_name: string;
          start_time?: string;
          end_time?: string | null;
          auto_ended?: boolean;
          flagged_for_review?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          trainer_id?: string;
          trainer_name?: string;
          start_time?: string;
          end_time?: string | null;
          auto_ended?: boolean;
          flagged_for_review?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      nutrition_recommendations: {
        Row: {
          id: string;
          user_id: string;
          recommendation_text: string;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          recommendation_text: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          recommendation_text?: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      user_role: UserRole;
    };
  };
}

// Helper types
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Trainer = Database["public"]["Tables"]["trainers"]["Row"];
export type PreWorkoutForm = Database["public"]["Tables"]["pre_workout_forms"]["Row"];
export type PostWorkoutForm = Database["public"]["Tables"]["post_workout_forms"]["Row"];
export type NutritionForm = Database["public"]["Tables"]["nutrition_forms"]["Row"];
export type WorkoutVideo = Database["public"]["Tables"]["workout_videos"]["Row"];
export type VideoProgress = Database["public"]["Tables"]["video_progress"]["Row"];
export type PlayerStats = Database["public"]["Tables"]["player_stats"]["Row"];
export type PlayerStatsInsert = Database["public"]["Tables"]["player_stats"]["Insert"];
export type PlayerStatsUpdate = Database["public"]["Tables"]["player_stats"]["Update"];
export type PlayerStatsHistory = Database["public"]["Tables"]["player_stats_history"]["Row"];
export type PlayerAssessmentRow = Database["public"]["Tables"]["player_assessments"]["Row"];
export type PlayerAssessmentInsert = Database["public"]["Tables"]["player_assessments"]["Insert"];
export type PlayerAssessmentUpdate = Database["public"]["Tables"]["player_assessments"]["Update"];
export type ActivityLogRow = Database["public"]["Tables"]["activity_logs"]["Row"];
export type UserStreakRow = Database["public"]["Tables"]["user_streaks"]["Row"];
export type PlayerGoalRow = Database["public"]["Tables"]["player_goals"]["Row"];
export type PlayerGoalInsert = Database["public"]["Tables"]["player_goals"]["Insert"];
export type PlayerGoalUpdate = Database["public"]["Tables"]["player_goals"]["Update"];
export type UserAchievementRow = Database["public"]["Tables"]["user_achievements"]["Row"];
export type UserAchievementInsert = Database["public"]["Tables"]["user_achievements"]["Insert"];
export type UserAchievementUpdate = Database["public"]["Tables"]["user_achievements"]["Update"];
export type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];
export type PaymentInsert = Database["public"]["Tables"]["payments"]["Insert"];
export type PaymentUpdate = Database["public"]["Tables"]["payments"]["Update"];
export type TrainerShiftReport = Database["public"]["Tables"]["trainer_shift_reports"]["Row"];
export type TrainerShift = Database["public"]["Tables"]["trainer_shifts"]["Row"];

/** Achievement badge types */
export type AchievementBadgeType =
  | "nutrition_form_completed"
  | "profile_completed"
  | "first_pre_workout"
  | "first_post_workout"
  | "first_video_watched"
  | "videos_day_complete"
  | "all_videos_watched"
  | "first_assessment"
  | "five_assessments"
  | "ten_assessments"
  | "sprint_improved"
  | "jump_improved"
  | "overall_improved_5pts"
  | "overall_improved_10pts"
  | "streak_7_days"
  | "streak_30_days"
  | "streak_100_days"
  | "first_goal_achieved"
  | "five_goals_achieved";
