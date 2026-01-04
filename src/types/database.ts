export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = "trainee" | "trainer" | "admin";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          phone: string | null;
          role: UserRole;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          phone?: string | null;
          role?: UserRole;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          phone?: string | null;
          role?: UserRole;
          created_at?: string;
          updated_at?: string;
        };
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
