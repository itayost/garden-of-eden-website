export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string | null
          changes: Json | null
          created_at: string
          id: string
          metadata: Json | null
          user_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string | null
          changes?: Json | null
          created_at?: string
          id?: string
          metadata?: Json | null
          user_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string | null
          changes?: Json | null
          created_at?: string
          id?: string
          metadata?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      age_group_benchmarks: {
        Row: {
          age_group: string
          blaze_spot_time_best: number | null
          blaze_spot_time_worst: number | null
          flexibility_ankle_best: number | null
          flexibility_ankle_worst: number | null
          flexibility_hip_best: number | null
          flexibility_hip_worst: number | null
          flexibility_knee_best: number | null
          flexibility_knee_worst: number | null
          jump_2leg_distance_best: number | null
          jump_2leg_distance_worst: number | null
          jump_2leg_height_best: number | null
          jump_2leg_height_worst: number | null
          jump_left_leg_best: number | null
          jump_left_leg_worst: number | null
          jump_right_leg_best: number | null
          jump_right_leg_worst: number | null
          kick_power_kaiser_best: number | null
          kick_power_kaiser_worst: number | null
          kick_power_left_foot_best: number | null
          kick_power_left_foot_worst: number | null
          kick_power_right_foot_best: number | null
          kick_power_right_foot_worst: number | null
          player_count: number | null
          sprint_10m_best: number | null
          sprint_10m_worst: number | null
          sprint_20m_best: number | null
          sprint_20m_worst: number | null
          sprint_5m_best: number | null
          sprint_5m_worst: number | null
          updated_at: string | null
        }
        Insert: {
          age_group: string
          blaze_spot_time_best?: number | null
          blaze_spot_time_worst?: number | null
          flexibility_ankle_best?: number | null
          flexibility_ankle_worst?: number | null
          flexibility_hip_best?: number | null
          flexibility_hip_worst?: number | null
          flexibility_knee_best?: number | null
          flexibility_knee_worst?: number | null
          jump_2leg_distance_best?: number | null
          jump_2leg_distance_worst?: number | null
          jump_2leg_height_best?: number | null
          jump_2leg_height_worst?: number | null
          jump_left_leg_best?: number | null
          jump_left_leg_worst?: number | null
          jump_right_leg_best?: number | null
          jump_right_leg_worst?: number | null
          kick_power_kaiser_best?: number | null
          kick_power_kaiser_worst?: number | null
          kick_power_left_foot_best?: number | null
          kick_power_left_foot_worst?: number | null
          kick_power_right_foot_best?: number | null
          kick_power_right_foot_worst?: number | null
          player_count?: number | null
          sprint_10m_best?: number | null
          sprint_10m_worst?: number | null
          sprint_20m_best?: number | null
          sprint_20m_worst?: number | null
          sprint_5m_best?: number | null
          sprint_5m_worst?: number | null
          updated_at?: string | null
        }
        Update: {
          age_group?: string
          blaze_spot_time_best?: number | null
          blaze_spot_time_worst?: number | null
          flexibility_ankle_best?: number | null
          flexibility_ankle_worst?: number | null
          flexibility_hip_best?: number | null
          flexibility_hip_worst?: number | null
          flexibility_knee_best?: number | null
          flexibility_knee_worst?: number | null
          jump_2leg_distance_best?: number | null
          jump_2leg_distance_worst?: number | null
          jump_2leg_height_best?: number | null
          jump_2leg_height_worst?: number | null
          jump_left_leg_best?: number | null
          jump_left_leg_worst?: number | null
          jump_right_leg_best?: number | null
          jump_right_leg_worst?: number | null
          kick_power_kaiser_best?: number | null
          kick_power_kaiser_worst?: number | null
          kick_power_left_foot_best?: number | null
          kick_power_left_foot_worst?: number | null
          kick_power_right_foot_best?: number | null
          kick_power_right_foot_worst?: number | null
          player_count?: number | null
          sprint_10m_best?: number | null
          sprint_10m_worst?: number | null
          sprint_20m_best?: number | null
          sprint_20m_worst?: number | null
          sprint_5m_best?: number | null
          sprint_5m_worst?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      book_age_rows: {
        Row: {
          age_group: string
          created_at: string
          id: string
          metric_value_he: string | null
          order_index: number
          parameter_id: string
          recovery_he: string | null
          updated_at: string
          what_he: string | null
        }
        Insert: {
          age_group: string
          created_at?: string
          id?: string
          metric_value_he?: string | null
          order_index?: number
          parameter_id: string
          recovery_he?: string | null
          updated_at?: string
          what_he?: string | null
        }
        Update: {
          age_group?: string
          created_at?: string
          id?: string
          metric_value_he?: string | null
          order_index?: number
          parameter_id?: string
          recovery_he?: string | null
          updated_at?: string
          what_he?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "book_age_rows_parameter_id_fkey"
            columns: ["parameter_id"]
            isOneToOne: false
            referencedRelation: "book_parameters"
            referencedColumns: ["id"]
          },
        ]
      }
      book_categories: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          name_he: string
          order_index: number
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          name_he: string
          order_index?: number
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          name_he?: string
          order_index?: number
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      book_drill_card_failure_steps: {
        Row: {
          card_id: string
          id: string
          is_final: boolean
          order_index: number
          text_he: string
        }
        Insert: {
          card_id: string
          id?: string
          is_final?: boolean
          order_index?: number
          text_he: string
        }
        Update: {
          card_id?: string
          id?: string
          is_final?: boolean
          order_index?: number
          text_he?: string
        }
        Relationships: [
          {
            foreignKeyName: "book_drill_card_failure_steps_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "book_drill_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      book_drill_card_metrics: {
        Row: {
          before_he: string | null
          card_id: string
          id: string
          label_he: string
          order_index: number
          target_he: string | null
        }
        Insert: {
          before_he?: string | null
          card_id: string
          id?: string
          label_he: string
          order_index?: number
          target_he?: string | null
        }
        Update: {
          before_he?: string | null
          card_id?: string
          id?: string
          label_he?: string
          order_index?: number
          target_he?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "book_drill_card_metrics_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "book_drill_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      book_drill_card_phase_points: {
        Row: {
          id: string
          order_index: number
          phase_id: string
          text_he: string
        }
        Insert: {
          id?: string
          order_index?: number
          phase_id: string
          text_he: string
        }
        Update: {
          id?: string
          order_index?: number
          phase_id?: string
          text_he?: string
        }
        Relationships: [
          {
            foreignKeyName: "book_drill_card_phase_points_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "book_drill_card_phases"
            referencedColumns: ["id"]
          },
        ]
      }
      book_drill_card_phases: {
        Row: {
          card_id: string
          drill_note_he: string | null
          id: string
          name_he: string
          number: number | null
          order_index: number
          subtitle_he: string | null
        }
        Insert: {
          card_id: string
          drill_note_he?: string | null
          id?: string
          name_he: string
          number?: number | null
          order_index?: number
          subtitle_he?: string | null
        }
        Update: {
          card_id?: string
          drill_note_he?: string | null
          id?: string
          name_he?: string
          number?: number | null
          order_index?: number
          subtitle_he?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "book_drill_card_phases_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "book_drill_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      book_drill_cards: {
        Row: {
          age_min_label: string | null
          created_at: string
          drill_id: string
          golden_rule_he: string | null
          id: string
          level_label: string | null
          situation_label_he: string | null
          subtitle_he: string | null
          updated_at: string
        }
        Insert: {
          age_min_label?: string | null
          created_at?: string
          drill_id: string
          golden_rule_he?: string | null
          id?: string
          level_label?: string | null
          situation_label_he?: string | null
          subtitle_he?: string | null
          updated_at?: string
        }
        Update: {
          age_min_label?: string | null
          created_at?: string
          drill_id?: string
          golden_rule_he?: string | null
          id?: string
          level_label?: string | null
          situation_label_he?: string | null
          subtitle_he?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "book_drill_cards_drill_id_fkey"
            columns: ["drill_id"]
            isOneToOne: true
            referencedRelation: "book_drills"
            referencedColumns: ["id"]
          },
        ]
      }
      book_drill_muscles: {
        Row: {
          drill_id: string
          muscle_id: string
        }
        Insert: {
          drill_id: string
          muscle_id: string
        }
        Update: {
          drill_id?: string
          muscle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "book_drill_muscles_drill_id_fkey"
            columns: ["drill_id"]
            isOneToOne: false
            referencedRelation: "book_drills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_drill_muscles_muscle_id_fkey"
            columns: ["muscle_id"]
            isOneToOne: false
            referencedRelation: "book_muscles"
            referencedColumns: ["id"]
          },
        ]
      }
      book_drill_progress: {
        Row: {
          completed_at: string
          drill_id: string
          id: string
          status: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          drill_id: string
          id?: string
          status?: string
          user_id: string
        }
        Update: {
          completed_at?: string
          drill_id?: string
          id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "book_drill_progress_drill_id_fkey"
            columns: ["drill_id"]
            isOneToOne: false
            referencedRelation: "book_drills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_drill_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      book_drills: {
        Row: {
          connect_he: string | null
          created_at: string
          how_he: string | null
          id: string
          muscle_he: string | null
          name_en: string | null
          name_he: string | null
          order_index: number
          parameter_id: string
          sets_he: string | null
          slug: string
          updated_at: string
          why_he: string | null
        }
        Insert: {
          connect_he?: string | null
          created_at?: string
          how_he?: string | null
          id?: string
          muscle_he?: string | null
          name_en?: string | null
          name_he?: string | null
          order_index?: number
          parameter_id: string
          sets_he?: string | null
          slug: string
          updated_at?: string
          why_he?: string | null
        }
        Update: {
          connect_he?: string | null
          created_at?: string
          how_he?: string | null
          id?: string
          muscle_he?: string | null
          name_en?: string | null
          name_he?: string | null
          order_index?: number
          parameter_id?: string
          sets_he?: string | null
          slug?: string
          updated_at?: string
          why_he?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "book_drills_parameter_id_fkey"
            columns: ["parameter_id"]
            isOneToOne: false
            referencedRelation: "book_parameters"
            referencedColumns: ["id"]
          },
        ]
      }
      book_muscles: {
        Row: {
          created_at: string
          emoji: string | null
          id: string
          name_he: string
          order_index: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          emoji?: string | null
          id?: string
          name_he: string
          order_index?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          emoji?: string | null
          id?: string
          name_he?: string
          order_index?: number
          updated_at?: string
        }
        Relationships: []
      }
      book_parameter_positions: {
        Row: {
          parameter_id: string
          position: string
        }
        Insert: {
          parameter_id: string
          position: string
        }
        Update: {
          parameter_id?: string
          position?: string
        }
        Relationships: [
          {
            foreignKeyName: "book_parameter_positions_parameter_id_fkey"
            columns: ["parameter_id"]
            isOneToOne: false
            referencedRelation: "book_parameters"
            referencedColumns: ["id"]
          },
        ]
      }
      book_parameters: {
        Row: {
          age_metric_label: string | null
          category_id: string
          created_at: string
          id: string
          is_all_positions: boolean
          name_he: string
          number: number | null
          order_index: number
          report_highlight_he: string | null
          report_text_he: string | null
          slug: string
          subtitle_he: string | null
          updated_at: string
          verbal_text_he: string | null
          verbal_tip_he: string | null
        }
        Insert: {
          age_metric_label?: string | null
          category_id: string
          created_at?: string
          id?: string
          is_all_positions?: boolean
          name_he: string
          number?: number | null
          order_index?: number
          report_highlight_he?: string | null
          report_text_he?: string | null
          slug: string
          subtitle_he?: string | null
          updated_at?: string
          verbal_text_he?: string | null
          verbal_tip_he?: string | null
        }
        Update: {
          age_metric_label?: string | null
          category_id?: string
          created_at?: string
          id?: string
          is_all_positions?: boolean
          name_he?: string
          number?: number | null
          order_index?: number
          report_highlight_he?: string | null
          report_text_he?: string | null
          slug?: string
          subtitle_he?: string | null
          updated_at?: string
          verbal_text_he?: string | null
          verbal_tip_he?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "book_parameters_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "book_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          arbox_location_name: string | null
          created_at: string
          id: string
          is_active: boolean
          manager_phone: string | null
          name_he: string
          order_index: number
          updated_at: string
        }
        Insert: {
          arbox_location_name?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          manager_phone?: string | null
          name_he: string
          order_index?: number
          updated_at?: string
        }
        Update: {
          arbox_location_name?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          manager_phone?: string | null
          name_he?: string
          order_index?: number
          updated_at?: string
        }
        Relationships: []
      }
      churned_customers: {
        Row: {
          assigned_trainer_id: string | null
          author_id: string
          created_at: string
          end_date: string
          id: string
          name: string
          note: string
          note_color: string
          updated_at: string
        }
        Insert: {
          assigned_trainer_id?: string | null
          author_id: string
          created_at?: string
          end_date: string
          id?: string
          name: string
          note?: string
          note_color?: string
          updated_at?: string
        }
        Update: {
          assigned_trainer_id?: string | null
          author_id?: string
          created_at?: string
          end_date?: string
          id?: string
          name?: string
          note?: string
          note_color?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "churned_customers_assigned_trainer_id_fkey"
            columns: ["assigned_trainer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      course_chapters: {
        Row: {
          course_id: string
          created_at: string
          id: string
          needs_title: boolean
          order_index: number
          slug: string
          subtitle_he: string | null
          title_he: string
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          needs_title?: boolean
          order_index?: number
          slug: string
          subtitle_he?: string | null
          title_he: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          needs_title?: boolean
          order_index?: number
          slug?: string
          subtitle_he?: string | null
          title_he?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_chapters_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_lesson_progress: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          last_position_sec: number
          lesson_id: string
          updated_at: string
          user_id: string
          watched_sec: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          last_position_sec?: number
          lesson_id: string
          updated_at?: string
          user_id: string
          watched_sec?: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          last_position_sec?: number
          lesson_id?: string
          updated_at?: string
          user_id?: string
          watched_sec?: number
        }
        Relationships: [
          {
            foreignKeyName: "course_lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "course_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      course_lessons: {
        Row: {
          chapter_id: string
          created_at: string
          description_he: string | null
          duration_sec: number
          id: string
          is_published: boolean
          needs_title: boolean
          order_index: number
          slug: string
          title_he: string
          updated_at: string
          video_path: string | null
          video_path_sd: string | null
        }
        Insert: {
          chapter_id: string
          created_at?: string
          description_he?: string | null
          duration_sec?: number
          id?: string
          is_published?: boolean
          needs_title?: boolean
          order_index?: number
          slug: string
          title_he: string
          updated_at?: string
          video_path?: string | null
          video_path_sd?: string | null
        }
        Update: {
          chapter_id?: string
          created_at?: string
          description_he?: string | null
          duration_sec?: number
          id?: string
          is_published?: boolean
          needs_title?: boolean
          order_index?: number
          slug?: string
          title_he?: string
          updated_at?: string
          video_path?: string | null
          video_path_sd?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_lessons_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "course_chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          cover_url: string | null
          created_at: string
          description_he: string | null
          id: string
          is_published: boolean
          needs_title: boolean
          order_index: number
          slug: string
          title_he: string
          updated_at: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          description_he?: string | null
          id?: string
          is_published?: boolean
          needs_title?: boolean
          order_index?: number
          slug: string
          title_he: string
          updated_at?: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          description_he?: string | null
          id?: string
          is_published?: boolean
          needs_title?: boolean
          order_index?: number
          slug?: string
          title_he?: string
          updated_at?: string
        }
        Relationships: []
      }
      daily_briefs: {
        Row: {
          author_id: string
          author_name: string
          brief_date: string
          content: string
          created_at: string
          id: string
          updated_at: string
          updated_by_id: string | null
          updated_by_name: string | null
        }
        Insert: {
          author_id: string
          author_name: string
          brief_date: string
          content: string
          created_at?: string
          id?: string
          updated_at?: string
          updated_by_id?: string | null
          updated_by_name?: string | null
        }
        Update: {
          author_id?: string
          author_name?: string
          brief_date?: string
          content?: string
          created_at?: string
          id?: string
          updated_at?: string
          updated_by_id?: string | null
          updated_by_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_briefs_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_briefs_updated_by_id_fkey"
            columns: ["updated_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_schedule_slot_tombstones: {
        Row: {
          band_id: string
          created_at: string
          created_by: string | null
          schedule_date: string
        }
        Insert: {
          band_id: string
          created_at?: string
          created_by?: string | null
          schedule_date: string
        }
        Update: {
          band_id?: string
          created_at?: string
          created_by?: string | null
          schedule_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_schedule_slot_tombstones_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "weekly_schedule_bands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_schedule_slot_tombstones_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_schedule_slot_trainees: {
        Row: {
          booked_at: string | null
          cancelled_at: string | null
          id: string
          late_cancel: boolean
          order_index: number
          reminded_at: string | null
          slot_id: string
          source: string
          trainee_id: string | null
          trainee_name: string
        }
        Insert: {
          booked_at?: string | null
          cancelled_at?: string | null
          id?: string
          late_cancel?: boolean
          order_index?: number
          reminded_at?: string | null
          slot_id: string
          source?: string
          trainee_id?: string | null
          trainee_name: string
        }
        Update: {
          booked_at?: string | null
          cancelled_at?: string | null
          id?: string
          late_cancel?: boolean
          order_index?: number
          reminded_at?: string | null
          slot_id?: string
          source?: string
          trainee_id?: string | null
          trainee_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_schedule_slot_trainees_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "daily_schedule_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_schedule_slot_trainees_trainee_id_fkey"
            columns: ["trainee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_schedule_slot_trainers: {
        Row: {
          created_at: string
          id: string
          order_index: number
          slot_id: string
          trainer_id: string | null
          trainer_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_index?: number
          slot_id: string
          trainer_id?: string | null
          trainer_name: string
        }
        Update: {
          created_at?: string
          id?: string
          order_index?: number
          slot_id?: string
          trainer_id?: string | null
          trainer_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_schedule_slot_trainers_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "daily_schedule_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_schedule_slot_trainers_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_schedule_slots: {
        Row: {
          band_id: string | null
          branch_id: string | null
          created_at: string
          created_by: string
          focus_he: string | null
          id: string
          location_he: string | null
          max_trainees: number | null
          schedule_date: string
          start_time: string
          trainer_id: string | null
          trainer_name: string | null
          updated_at: string
          workout_built_by: string | null
          workout_built_by_name: string | null
          workout_notes_he: string | null
          workout_updated_at: string | null
        }
        Insert: {
          band_id?: string | null
          branch_id?: string | null
          created_at?: string
          created_by: string
          focus_he?: string | null
          id?: string
          location_he?: string | null
          max_trainees?: number | null
          schedule_date: string
          start_time: string
          trainer_id?: string | null
          trainer_name?: string | null
          updated_at?: string
          workout_built_by?: string | null
          workout_built_by_name?: string | null
          workout_notes_he?: string | null
          workout_updated_at?: string | null
        }
        Update: {
          band_id?: string | null
          branch_id?: string | null
          created_at?: string
          created_by?: string
          focus_he?: string | null
          id?: string
          location_he?: string | null
          max_trainees?: number | null
          schedule_date?: string
          start_time?: string
          trainer_id?: string | null
          trainer_name?: string | null
          updated_at?: string
          workout_built_by?: string | null
          workout_built_by_name?: string | null
          workout_notes_he?: string | null
          workout_updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_schedule_slots_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "weekly_schedule_bands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_schedule_slots_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_schedule_slots_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_schedule_slots_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_schedule_slots_workout_built_by_fkey"
            columns: ["workout_built_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollment_agreements: {
        Row: {
          accepts_terms: boolean
          agreement_version: string
          authorizes_payment: boolean
          child_birthdate: string | null
          child_name: string
          created_at: string
          declares_healthy: boolean
          emergency_contact_name: string
          emergency_contact_phone: string
          id: string
          medical_notes: string | null
          order_id: string | null
          parent_email: string | null
          parent_id_number: string
          parent_name: string
          parent_phone: string
          payment_method: string
          photo_consent: boolean
          plan_name: string
          plan_price_ils: number
          plan_start_on: string
          profile_id: string | null
          sign_reminded_at: string | null
          signature_name: string
          signed_at: string | null
          signed_ip: string | null
        }
        Insert: {
          accepts_terms: boolean
          agreement_version: string
          authorizes_payment: boolean
          child_birthdate?: string | null
          child_name: string
          created_at?: string
          declares_healthy: boolean
          emergency_contact_name?: string
          emergency_contact_phone?: string
          id?: string
          medical_notes?: string | null
          order_id?: string | null
          parent_email?: string | null
          parent_id_number?: string
          parent_name: string
          parent_phone: string
          payment_method: string
          photo_consent: boolean
          plan_name: string
          plan_price_ils: number
          plan_start_on: string
          profile_id?: string | null
          sign_reminded_at?: string | null
          signature_name?: string
          signed_at?: string | null
          signed_ip?: string | null
        }
        Update: {
          accepts_terms?: boolean
          agreement_version?: string
          authorizes_payment?: boolean
          child_birthdate?: string | null
          child_name?: string
          created_at?: string
          declares_healthy?: boolean
          emergency_contact_name?: string
          emergency_contact_phone?: string
          id?: string
          medical_notes?: string | null
          order_id?: string | null
          parent_email?: string | null
          parent_id_number?: string
          parent_name?: string
          parent_phone?: string
          payment_method?: string
          photo_consent?: boolean
          plan_name?: string
          plan_price_ils?: number
          plan_start_on?: string
          profile_id?: string | null
          sign_reminded_at?: string | null
          signature_name?: string
          signed_at?: string | null
          signed_ip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enrollment_agreements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_agreements_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment: {
        Row: {
          code: string
          created_at: string
          default_distance_m: number | null
          default_duration_seconds: number | null
          default_reps: number | null
          default_sets: number | null
          default_weight_kg: number | null
          howto_he: string | null
          id: string
          is_active: boolean
          name_he: string
          notes_he: string | null
          tracks_distance: boolean
          tracks_duration: boolean
          tracks_reps: boolean
          tracks_weight: boolean
          updated_at: string
          weight_max_kg: number | null
          weight_min_kg: number | null
          weight_step_kg: number
        }
        Insert: {
          code: string
          created_at?: string
          default_distance_m?: number | null
          default_duration_seconds?: number | null
          default_reps?: number | null
          default_sets?: number | null
          default_weight_kg?: number | null
          howto_he?: string | null
          id?: string
          is_active?: boolean
          name_he: string
          notes_he?: string | null
          tracks_distance?: boolean
          tracks_duration?: boolean
          tracks_reps?: boolean
          tracks_weight?: boolean
          updated_at?: string
          weight_max_kg?: number | null
          weight_min_kg?: number | null
          weight_step_kg?: number
        }
        Update: {
          code?: string
          created_at?: string
          default_distance_m?: number | null
          default_duration_seconds?: number | null
          default_reps?: number | null
          default_sets?: number | null
          default_weight_kg?: number | null
          howto_he?: string | null
          id?: string
          is_active?: boolean
          name_he?: string
          notes_he?: string | null
          tracks_distance?: boolean
          tracks_duration?: boolean
          tracks_reps?: boolean
          tracks_weight?: boolean
          updated_at?: string
          weight_max_kg?: number | null
          weight_min_kg?: number | null
          weight_step_kg?: number
        }
        Relationships: []
      }
      exercise_logs: {
        Row: {
          distance_m: number | null
          duration_seconds: number | null
          equipment_id: string | null
          exercise_id: string
          id: string
          logged_at: string
          note_he: string | null
          reps: number | null
          session_exercise_id: string | null
          sets: number | null
          trainee_id: string
          weight_kg: number | null
        }
        Insert: {
          distance_m?: number | null
          duration_seconds?: number | null
          equipment_id?: string | null
          exercise_id: string
          id?: string
          logged_at?: string
          note_he?: string | null
          reps?: number | null
          session_exercise_id?: string | null
          sets?: number | null
          trainee_id: string
          weight_kg?: number | null
        }
        Update: {
          distance_m?: number | null
          duration_seconds?: number | null
          equipment_id?: string | null
          exercise_id?: string
          id?: string
          logged_at?: string
          note_he?: string | null
          reps?: number | null
          session_exercise_id?: string | null
          sets?: number | null
          trainee_id?: string
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "exercise_logs_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_logs_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "workout_exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_logs_session_exercise_id_fkey"
            columns: ["session_exercise_id"]
            isOneToOne: false
            referencedRelation: "training_session_exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_logs_trainee_id_fkey"
            columns: ["trainee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      failed_shift_syncs: {
        Row: {
          action_type: string
          client_timestamp: string
          created_at: string | null
          failure_reason: string
          id: string
          resolved: boolean | null
          trainer_id: string
          trainer_name: string
        }
        Insert: {
          action_type: string
          client_timestamp: string
          created_at?: string | null
          failure_reason?: string
          id?: string
          resolved?: boolean | null
          trainer_id: string
          trainer_name: string
        }
        Update: {
          action_type?: string
          client_timestamp?: string
          created_at?: string | null
          failure_reason?: string
          id?: string
          resolved?: boolean | null
          trainer_id?: string
          trainer_name?: string
        }
        Relationships: []
      }
      lead_contact_log: {
        Row: {
          contact_type: Database["public"]["Enums"]["lead_contact_type"]
          created_at: string
          id: string
          lead_id: string
          notes: string | null
          outcome: Database["public"]["Enums"]["lead_contact_outcome"] | null
          rep: string | null
        }
        Insert: {
          contact_type: Database["public"]["Enums"]["lead_contact_type"]
          created_at?: string
          id?: string
          lead_id: string
          notes?: string | null
          outcome?: Database["public"]["Enums"]["lead_contact_outcome"] | null
          rep?: string | null
        }
        Update: {
          contact_type?: Database["public"]["Enums"]["lead_contact_type"]
          created_at?: string
          id?: string
          lead_id?: string
          notes?: string | null
          outcome?: Database["public"]["Enums"]["lead_contact_outcome"] | null
          rep?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_contact_log_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_flow_responses: {
        Row: {
          created_at: string
          data: Json | null
          flow_token: string | null
          id: string
          is_complete: boolean
          lead_id: string
          screen: string | null
        }
        Insert: {
          created_at?: string
          data?: Json | null
          flow_token?: string | null
          id?: string
          is_complete?: boolean
          lead_id: string
          screen?: string | null
        }
        Update: {
          created_at?: string
          data?: Json | null
          flow_token?: string | null
          id?: string
          is_complete?: boolean
          lead_id?: string
          screen?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_flow_responses_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_sent_messages: {
        Row: {
          campaign: string | null
          id: string
          lead_id: string
          message_id: string | null
          message_type: Database["public"]["Enums"]["lead_message_type"]
          sent_at: string
        }
        Insert: {
          campaign?: string | null
          id?: string
          lead_id: string
          message_id?: string | null
          message_type: Database["public"]["Enums"]["lead_message_type"]
          sent_at?: string
        }
        Update: {
          campaign?: string | null
          id?: string
          lead_id?: string
          message_id?: string | null
          message_type?: Database["public"]["Enums"]["lead_message_type"]
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_sent_messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_tabs: {
        Row: {
          color: string | null
          created_at: string
          deleted_at: string | null
          id: string
          is_default: boolean
          name: string
          position: number
          slug: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_default?: boolean
          name: string
          position?: number
          slug: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_default?: boolean
          name?: string
          position?: number
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          additional_info: string | null
          assigned_trainer_id: string | null
          birth_year: number | null
          club: string | null
          created_at: string
          flow_age_group: string | null
          flow_frequency: string | null
          flow_team: string | null
          id: string
          is_from_haifa: boolean
          months: number | null
          name: string
          note: string | null
          payment: number | null
          phone: string | null
          source: string
          status: Database["public"]["Enums"]["lead_status"]
          tab_id: string
          total_payment: number | null
          updated_at: string
        }
        Insert: {
          additional_info?: string | null
          assigned_trainer_id?: string | null
          birth_year?: number | null
          club?: string | null
          created_at?: string
          flow_age_group?: string | null
          flow_frequency?: string | null
          flow_team?: string | null
          id?: string
          is_from_haifa?: boolean
          months?: number | null
          name: string
          note?: string | null
          payment?: number | null
          phone?: string | null
          source?: string
          status?: Database["public"]["Enums"]["lead_status"]
          tab_id: string
          total_payment?: number | null
          updated_at?: string
        }
        Update: {
          additional_info?: string | null
          assigned_trainer_id?: string | null
          birth_year?: number | null
          club?: string | null
          created_at?: string
          flow_age_group?: string | null
          flow_frequency?: string | null
          flow_team?: string | null
          id?: string
          is_from_haifa?: boolean
          months?: number | null
          name?: string
          note?: string | null
          payment?: number | null
          phone?: string | null
          source?: string
          status?: Database["public"]["Enums"]["lead_status"]
          tab_id?: string
          total_payment?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_trainer_id_fkey"
            columns: ["assigned_trainer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_tab_id_fkey"
            columns: ["tab_id"]
            isOneToOne: false
            referencedRelation: "lead_tabs"
            referencedColumns: ["id"]
          },
        ]
      }
      mental_questionnaires: {
        Row: {
          full_name: string
          id: string
          last_session_conclusion: string | null
          mental_insight: string | null
          submitted_at: string | null
          tool_to_take: string | null
          user_id: string
          wants_more_zoom: boolean | null
          wants_one_on_one: boolean | null
          zoom_feeling: string | null
        }
        Insert: {
          full_name: string
          id?: string
          last_session_conclusion?: string | null
          mental_insight?: string | null
          submitted_at?: string | null
          tool_to_take?: string | null
          user_id: string
          wants_more_zoom?: boolean | null
          wants_one_on_one?: boolean | null
          zoom_feeling?: string | null
        }
        Update: {
          full_name?: string
          id?: string
          last_session_conclusion?: string | null
          mental_insight?: string | null
          submitted_at?: string | null
          tool_to_take?: string | null
          user_id?: string
          wants_more_zoom?: boolean | null
          wants_one_on_one?: boolean | null
          zoom_feeling?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mental_questionnaires_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      morning_webhook_events: {
        Row: {
          delivery_id: string
          error: string | null
          order_id: string | null
          payload: Json
          processed_at: string | null
          received_at: string
          topic: string
        }
        Insert: {
          delivery_id: string
          error?: string | null
          order_id?: string | null
          payload: Json
          processed_at?: string | null
          received_at?: string
          topic: string
        }
        Update: {
          delivery_id?: string
          error?: string | null
          order_id?: string | null
          payload?: Json
          processed_at?: string | null
          received_at?: string
          topic?: string
        }
        Relationships: [
          {
            foreignKeyName: "morning_webhook_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      nutrition_forms: {
        Row: {
          additional_comments: string | null
          allergies: boolean | null
          allergies_details: string | null
          chronic_conditions: boolean | null
          conditions_details: string | null
          counseling_details: string | null
          height: number | null
          id: string
          medications: string | null
          medications_list: string | null
          previous_counseling: boolean | null
          submitted_at: string | null
          user_id: string
          weight: number | null
          years_competitive: string | null
        }
        Insert: {
          additional_comments?: string | null
          allergies?: boolean | null
          allergies_details?: string | null
          chronic_conditions?: boolean | null
          conditions_details?: string | null
          counseling_details?: string | null
          height?: number | null
          id?: string
          medications?: string | null
          medications_list?: string | null
          previous_counseling?: boolean | null
          submitted_at?: string | null
          user_id: string
          weight?: number | null
          years_competitive?: string | null
        }
        Update: {
          additional_comments?: string | null
          allergies?: boolean | null
          allergies_details?: string | null
          chronic_conditions?: boolean | null
          conditions_details?: string | null
          counseling_details?: string | null
          height?: number | null
          id?: string
          medications?: string | null
          medications_list?: string | null
          previous_counseling?: boolean | null
          submitted_at?: string | null
          user_id?: string
          weight?: number | null
          years_competitive?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nutrition_forms_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      nutrition_measurements: {
        Row: {
          age: number | null
          bmi: number | null
          bmi_percentile: number | null
          body_fat_percentage: number | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          height_cm: number | null
          height_percentile: number | null
          id: string
          measurement_date: string
          notes: string | null
          updated_at: string
          user_id: string
          weight_kg: number | null
        }
        Insert: {
          age?: number | null
          bmi?: number | null
          bmi_percentile?: number | null
          body_fat_percentage?: number | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          height_cm?: number | null
          height_percentile?: number | null
          id?: string
          measurement_date?: string
          notes?: string | null
          updated_at?: string
          user_id: string
          weight_kg?: number | null
        }
        Update: {
          age?: number | null
          bmi?: number | null
          bmi_percentile?: number | null
          body_fat_percentage?: number | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          height_cm?: number | null
          height_percentile?: number | null
          id?: string
          measurement_date?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "nutrition_measurements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nutrition_measurements_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nutrition_measurements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      nutrition_recommendations: {
        Row: {
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          id: string
          recommendation_text: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          recommendation_text: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          recommendation_text?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nutrition_recommendations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nutrition_recommendations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          amount_ils: number
          approval_number: string | null
          branch_id: string
          card_brand: string | null
          card_last4: string | null
          child_birthdate: string | null
          child_name: string
          created_at: string
          currency: string
          email: string | null
          fulfilled_at: string | null
          fulfillment_error: string | null
          id: string
          installments: number
          login_phone: string
          morning_document_id: string | null
          morning_document_url: string | null
          morning_payment_url: string | null
          morning_transaction_id: string | null
          paid_at: string | null
          parent_name: string
          payer_phone: string
          payment_method: string | null
          payment_provider: string
          product_id: string
          profile_id: string | null
          provider_response: Json | null
          provider_transaction_id: string | null
          raw_webhook: Json | null
          received_by: string | null
          reference: string | null
          renewal_of_plan_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount_ils: number
          approval_number?: string | null
          branch_id: string
          card_brand?: string | null
          card_last4?: string | null
          child_birthdate?: string | null
          child_name: string
          created_at?: string
          currency?: string
          email?: string | null
          fulfilled_at?: string | null
          fulfillment_error?: string | null
          id?: string
          installments?: number
          login_phone: string
          morning_document_id?: string | null
          morning_document_url?: string | null
          morning_payment_url?: string | null
          morning_transaction_id?: string | null
          paid_at?: string | null
          parent_name: string
          payer_phone: string
          payment_method?: string | null
          payment_provider?: string
          product_id: string
          profile_id?: string | null
          provider_response?: Json | null
          provider_transaction_id?: string | null
          raw_webhook?: Json | null
          received_by?: string | null
          reference?: string | null
          renewal_of_plan_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount_ils?: number
          approval_number?: string | null
          branch_id?: string
          card_brand?: string | null
          card_last4?: string | null
          child_birthdate?: string | null
          child_name?: string
          created_at?: string
          currency?: string
          email?: string | null
          fulfilled_at?: string | null
          fulfillment_error?: string | null
          id?: string
          installments?: number
          login_phone?: string
          morning_document_id?: string | null
          morning_document_url?: string | null
          morning_payment_url?: string | null
          morning_transaction_id?: string | null
          paid_at?: string | null
          parent_name?: string
          payer_phone?: string
          payment_method?: string | null
          payment_provider?: string
          product_id?: string
          profile_id?: string | null
          provider_response?: Json | null
          provider_transaction_id?: string | null
          raw_webhook?: Json | null
          received_by?: string | null
          reference?: string | null
          renewal_of_plan_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "plan_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_renewal_of_plan_fk"
            columns: ["renewal_of_plan_id"]
            isOneToOne: false
            referencedRelation: "trainee_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          all_payments_num: number | null
          amount: number
          approved_at: string | null
          asmachta: string | null
          card_brand: string | null
          card_exp: string | null
          card_suffix: string | null
          card_type: string | null
          created_at: string | null
          custom_fields: Json | null
          description: string
          first_payment_sum: number | null
          id: string
          payer_email: string | null
          payer_name: string
          payer_phone: string
          payment_type: string
          payments_num: number | null
          periodical_payment_sum: number | null
          process_id: string
          process_token: string
          raw_webhook_data: Json | null
          status: string
          status_code: string | null
          transaction_id: string | null
          transaction_token: string | null
          updated_at: string | null
          user_id: string | null
          webhook_received_at: string | null
        }
        Insert: {
          all_payments_num?: number | null
          amount: number
          approved_at?: string | null
          asmachta?: string | null
          card_brand?: string | null
          card_exp?: string | null
          card_suffix?: string | null
          card_type?: string | null
          created_at?: string | null
          custom_fields?: Json | null
          description: string
          first_payment_sum?: number | null
          id?: string
          payer_email?: string | null
          payer_name: string
          payer_phone: string
          payment_type: string
          payments_num?: number | null
          periodical_payment_sum?: number | null
          process_id: string
          process_token: string
          raw_webhook_data?: Json | null
          status?: string
          status_code?: string | null
          transaction_id?: string | null
          transaction_token?: string | null
          updated_at?: string | null
          user_id?: string | null
          webhook_received_at?: string | null
        }
        Update: {
          all_payments_num?: number | null
          amount?: number
          approved_at?: string | null
          asmachta?: string | null
          card_brand?: string | null
          card_exp?: string | null
          card_suffix?: string | null
          card_type?: string | null
          created_at?: string | null
          custom_fields?: Json | null
          description?: string
          first_payment_sum?: number | null
          id?: string
          payer_email?: string | null
          payer_name?: string
          payer_phone?: string
          payment_type?: string
          payments_num?: number | null
          periodical_payment_sum?: number | null
          process_id?: string
          process_token?: string
          raw_webhook_data?: Json | null
          status?: string
          status_code?: string | null
          transaction_id?: string | null
          transaction_token?: string | null
          updated_at?: string | null
          user_id?: string | null
          webhook_received_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_products: {
        Row: {
          blurb_he: string | null
          branch_id: string
          created_at: string
          duration_days: number
          gift_he: string | null
          id: string
          is_active: boolean
          kind: string
          name_he: string
          once_per_trainee: boolean
          order_index: number
          price_ils: number
          sessions_total: number | null
          slug: string
          updated_at: string
        }
        Insert: {
          blurb_he?: string | null
          branch_id: string
          created_at?: string
          duration_days: number
          gift_he?: string | null
          id?: string
          is_active?: boolean
          kind: string
          name_he: string
          once_per_trainee?: boolean
          order_index?: number
          price_ils: number
          sessions_total?: number | null
          slug: string
          updated_at?: string
        }
        Update: {
          blurb_he?: string | null
          branch_id?: string
          created_at?: string
          duration_days?: number
          gift_he?: string | null
          id?: string
          is_active?: boolean
          kind?: string
          name_he?: string
          once_per_trainee?: boolean
          order_index?: number
          price_ils?: number
          sessions_total?: number | null
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_products_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      player_assessments: {
        Row: {
          assessed_by: string | null
          assessment_date: string | null
          blaze_spot_time: number | null
          body_structure: string | null
          concentration_notes: string | null
          coordination: string | null
          created_at: string | null
          decision_making_notes: string | null
          deleted_at: string | null
          deleted_by: string | null
          flexibility_ankle: number | null
          flexibility_hip: number | null
          flexibility_knee: number | null
          id: string
          jump_2leg_distance: number | null
          jump_2leg_height: number | null
          jump_left_leg: number | null
          jump_right_leg: number | null
          kick_power_kaiser: number | null
          kick_power_left_foot: number | null
          kick_power_machine_pct: number | null
          kick_power_right_foot: number | null
          leg_power_technique: string | null
          notes: string | null
          nutrition_notes: string | null
          recovery_notes: string | null
          sprint_10m: number | null
          sprint_20m: number | null
          sprint_5m: number | null
          user_id: string
          work_ethic_notes: string | null
        }
        Insert: {
          assessed_by?: string | null
          assessment_date?: string | null
          blaze_spot_time?: number | null
          body_structure?: string | null
          concentration_notes?: string | null
          coordination?: string | null
          created_at?: string | null
          decision_making_notes?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          flexibility_ankle?: number | null
          flexibility_hip?: number | null
          flexibility_knee?: number | null
          id?: string
          jump_2leg_distance?: number | null
          jump_2leg_height?: number | null
          jump_left_leg?: number | null
          jump_right_leg?: number | null
          kick_power_kaiser?: number | null
          kick_power_left_foot?: number | null
          kick_power_machine_pct?: number | null
          kick_power_right_foot?: number | null
          leg_power_technique?: string | null
          notes?: string | null
          nutrition_notes?: string | null
          recovery_notes?: string | null
          sprint_10m?: number | null
          sprint_20m?: number | null
          sprint_5m?: number | null
          user_id: string
          work_ethic_notes?: string | null
        }
        Update: {
          assessed_by?: string | null
          assessment_date?: string | null
          blaze_spot_time?: number | null
          body_structure?: string | null
          concentration_notes?: string | null
          coordination?: string | null
          created_at?: string | null
          decision_making_notes?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          flexibility_ankle?: number | null
          flexibility_hip?: number | null
          flexibility_knee?: number | null
          id?: string
          jump_2leg_distance?: number | null
          jump_2leg_height?: number | null
          jump_left_leg?: number | null
          jump_right_leg?: number | null
          kick_power_kaiser?: number | null
          kick_power_left_foot?: number | null
          kick_power_machine_pct?: number | null
          kick_power_right_foot?: number | null
          leg_power_technique?: string | null
          notes?: string | null
          nutrition_notes?: string | null
          recovery_notes?: string | null
          sprint_10m?: number | null
          sprint_20m?: number | null
          sprint_5m?: number | null
          user_id?: string
          work_ethic_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "player_assessments_assessed_by_fkey"
            columns: ["assessed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_assessments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      player_goals: {
        Row: {
          achieved_at: string | null
          achieved_value: number | null
          baseline_value: number | null
          created_at: string
          created_by: string | null
          current_value: number | null
          id: string
          is_lower_better: boolean
          metric_key: string
          target_value: number
          updated_at: string
          user_id: string
        }
        Insert: {
          achieved_at?: string | null
          achieved_value?: number | null
          baseline_value?: number | null
          created_at?: string
          created_by?: string | null
          current_value?: number | null
          id?: string
          is_lower_better?: boolean
          metric_key: string
          target_value: number
          updated_at?: string
          user_id: string
        }
        Update: {
          achieved_at?: string | null
          achieved_value?: number | null
          baseline_value?: number | null
          created_at?: string
          created_by?: string | null
          current_value?: number | null
          id?: string
          is_lower_better?: boolean
          metric_key?: string
          target_value?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_goals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_goals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      player_rating_snapshots: {
        Row: {
          age_group: string | null
          assessment_date: string
          assessment_id: string
          computed_at: string
          defending: number | null
          deleted_at: string | null
          dribbling: number | null
          id: string
          overall_rating: number | null
          pace: number | null
          passing: number | null
          physical: number | null
          shooting: number | null
          user_id: string
        }
        Insert: {
          age_group?: string | null
          assessment_date: string
          assessment_id: string
          computed_at?: string
          defending?: number | null
          deleted_at?: string | null
          dribbling?: number | null
          id?: string
          overall_rating?: number | null
          pace?: number | null
          passing?: number | null
          physical?: number | null
          shooting?: number | null
          user_id: string
        }
        Update: {
          age_group?: string | null
          assessment_date?: string
          assessment_id?: string
          computed_at?: string
          defending?: number | null
          deleted_at?: string | null
          dribbling?: number | null
          id?: string
          overall_rating?: number | null
          pace?: number | null
          passing?: number | null
          physical?: number | null
          shooting?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_rating_snapshots_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: true
            referencedRelation: "player_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_rating_snapshots_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      player_stats: {
        Row: {
          acceleration: number | null
          agility: number | null
          avatar_url: string | null
          balance: number | null
          ball_control: number | null
          card_type: string | null
          composure: number | null
          created_at: string | null
          crossing: number | null
          decision_making: number | null
          defending: number | null
          dribbling: number | null
          dribbling_skill: number | null
          finishing: number | null
          focus: number | null
          heading_accuracy: number | null
          id: string
          interceptions: number | null
          jumping: number | null
          last_updated_by: string | null
          long_passing: number | null
          long_shots: number | null
          marking: number | null
          notes: string | null
          nutrition_score: number | null
          overall_rating: number | null
          pace: number | null
          passing: number | null
          physical: number | null
          position: string | null
          positioning: number | null
          reactions: number | null
          recovery: number | null
          shooting: number | null
          short_passing: number | null
          shot_power: number | null
          sprint_speed: number | null
          stamina: number | null
          strength: number | null
          tackling: number | null
          updated_at: string | null
          user_id: string
          vision: number | null
          work_rate: number | null
        }
        Insert: {
          acceleration?: number | null
          agility?: number | null
          avatar_url?: string | null
          balance?: number | null
          ball_control?: number | null
          card_type?: string | null
          composure?: number | null
          created_at?: string | null
          crossing?: number | null
          decision_making?: number | null
          defending?: number | null
          dribbling?: number | null
          dribbling_skill?: number | null
          finishing?: number | null
          focus?: number | null
          heading_accuracy?: number | null
          id?: string
          interceptions?: number | null
          jumping?: number | null
          last_updated_by?: string | null
          long_passing?: number | null
          long_shots?: number | null
          marking?: number | null
          notes?: string | null
          nutrition_score?: number | null
          overall_rating?: number | null
          pace?: number | null
          passing?: number | null
          physical?: number | null
          position?: string | null
          positioning?: number | null
          reactions?: number | null
          recovery?: number | null
          shooting?: number | null
          short_passing?: number | null
          shot_power?: number | null
          sprint_speed?: number | null
          stamina?: number | null
          strength?: number | null
          tackling?: number | null
          updated_at?: string | null
          user_id: string
          vision?: number | null
          work_rate?: number | null
        }
        Update: {
          acceleration?: number | null
          agility?: number | null
          avatar_url?: string | null
          balance?: number | null
          ball_control?: number | null
          card_type?: string | null
          composure?: number | null
          created_at?: string | null
          crossing?: number | null
          decision_making?: number | null
          defending?: number | null
          dribbling?: number | null
          dribbling_skill?: number | null
          finishing?: number | null
          focus?: number | null
          heading_accuracy?: number | null
          id?: string
          interceptions?: number | null
          jumping?: number | null
          last_updated_by?: string | null
          long_passing?: number | null
          long_shots?: number | null
          marking?: number | null
          notes?: string | null
          nutrition_score?: number | null
          overall_rating?: number | null
          pace?: number | null
          passing?: number | null
          physical?: number | null
          position?: string | null
          positioning?: number | null
          reactions?: number | null
          recovery?: number | null
          shooting?: number | null
          short_passing?: number | null
          shot_power?: number | null
          sprint_speed?: number | null
          stamina?: number | null
          strength?: number | null
          tackling?: number | null
          updated_at?: string | null
          user_id?: string
          vision?: number | null
          work_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "player_stats_last_updated_by_fkey"
            columns: ["last_updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_stats_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      player_stats_history: {
        Row: {
          created_at: string | null
          defending: number | null
          dribbling: number | null
          id: string
          overall_rating: number | null
          pace: number | null
          passing: number | null
          physical: number | null
          player_stats_id: string
          shooting: number | null
          update_reason: string | null
          updated_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          defending?: number | null
          dribbling?: number | null
          id?: string
          overall_rating?: number | null
          pace?: number | null
          passing?: number | null
          physical?: number | null
          player_stats_id: string
          shooting?: number | null
          update_reason?: string | null
          updated_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          defending?: number | null
          dribbling?: number | null
          id?: string
          overall_rating?: number | null
          pace?: number | null
          passing?: number | null
          physical?: number | null
          player_stats_id?: string
          shooting?: number | null
          update_reason?: string | null
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_stats_history_player_stats_id_fkey"
            columns: ["player_stats_id"]
            isOneToOne: false
            referencedRelation: "player_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_stats_history_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_stats_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_workout_forms: {
        Row: {
          comments: string | null
          contact_info: string | null
          difficulty_level: number | null
          full_name: string
          id: string
          satisfaction_level: number | null
          submitted_at: string | null
          trainer_id: string | null
          training_date: string
          user_id: string
        }
        Insert: {
          comments?: string | null
          contact_info?: string | null
          difficulty_level?: number | null
          full_name: string
          id?: string
          satisfaction_level?: number | null
          submitted_at?: string | null
          trainer_id?: string | null
          training_date: string
          user_id: string
        }
        Update: {
          comments?: string | null
          contact_info?: string | null
          difficulty_level?: number | null
          full_name?: string
          id?: string
          satisfaction_level?: number | null
          submitted_at?: string | null
          trainer_id?: string | null
          training_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_workout_forms_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_workout_forms_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pre_workout_forms: {
        Row: {
          age: number | null
          full_name: string
          group_training: string | null
          id: string
          improvements_desired: string | null
          last_game: string | null
          next_match: string | null
          nutrition_status: string | null
          recent_injury: string | null
          sleep_hours: string | null
          submitted_at: string | null
          urine_color: string | null
          user_id: string
        }
        Insert: {
          age?: number | null
          full_name: string
          group_training?: string | null
          id?: string
          improvements_desired?: string | null
          last_game?: string | null
          next_match?: string | null
          nutrition_status?: string | null
          recent_injury?: string | null
          sleep_hours?: string | null
          submitted_at?: string | null
          urine_color?: string | null
          user_id: string
        }
        Update: {
          age?: number | null
          full_name?: string
          group_training?: string | null
          id?: string
          improvements_desired?: string | null
          last_game?: string | null
          next_match?: string | null
          nutrition_status?: string | null
          recent_injury?: string | null
          sleep_hours?: string | null
          submitted_at?: string | null
          urine_color?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pre_workout_forms_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_branches: {
        Row: {
          branch_id: string
          created_at: string
          profile_id: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          profile_id: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_branches_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_branches_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          access_override: string | null
          arbox_access_synced_at: string | null
          arbox_bought_course: boolean
          arbox_paid_training: boolean
          arbox_user_id: number | null
          avatar_url: string | null
          birthdate: string | null
          branches_set_by_admin_at: string | null
          club: string | null
          created_at: string | null
          deleted_at: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          full_name: string | null
          guardian_name: string | null
          guardian_phone: string | null
          id: string
          is_active: boolean
          medical_notes: string | null
          nutrition_appointment_status: Database["public"]["Enums"]["nutrition_appointment_status"]
          phone: string | null
          photo_consent: boolean | null
          position: string | null
          processed_avatar_url: string | null
          profile_completed: boolean | null
          role: Database["public"]["Enums"]["user_role"] | null
          tour_completed: boolean
          updated_at: string | null
          welcome_message_sent_at: string | null
        }
        Insert: {
          access_override?: string | null
          arbox_access_synced_at?: string | null
          arbox_bought_course?: boolean
          arbox_paid_training?: boolean
          arbox_user_id?: number | null
          avatar_url?: string | null
          birthdate?: string | null
          branches_set_by_admin_at?: string | null
          club?: string | null
          created_at?: string | null
          deleted_at?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          full_name?: string | null
          guardian_name?: string | null
          guardian_phone?: string | null
          id: string
          is_active?: boolean
          medical_notes?: string | null
          nutrition_appointment_status?: Database["public"]["Enums"]["nutrition_appointment_status"]
          phone?: string | null
          photo_consent?: boolean | null
          position?: string | null
          processed_avatar_url?: string | null
          profile_completed?: boolean | null
          role?: Database["public"]["Enums"]["user_role"] | null
          tour_completed?: boolean
          updated_at?: string | null
          welcome_message_sent_at?: string | null
        }
        Update: {
          access_override?: string | null
          arbox_access_synced_at?: string | null
          arbox_bought_course?: boolean
          arbox_paid_training?: boolean
          arbox_user_id?: number | null
          avatar_url?: string | null
          birthdate?: string | null
          branches_set_by_admin_at?: string | null
          club?: string | null
          created_at?: string | null
          deleted_at?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          full_name?: string | null
          guardian_name?: string | null
          guardian_phone?: string | null
          id?: string
          is_active?: boolean
          medical_notes?: string | null
          nutrition_appointment_status?: Database["public"]["Enums"]["nutrition_appointment_status"]
          phone?: string | null
          photo_consent?: boolean | null
          position?: string | null
          processed_avatar_url?: string | null
          profile_completed?: boolean | null
          role?: Database["public"]["Enums"]["user_role"] | null
          tour_completed?: boolean
          updated_at?: string | null
          welcome_message_sent_at?: string | null
        }
        Relationships: []
      }
      retention_notes: {
        Row: {
          assigned_trainer_id: string | null
          author_id: string
          created_at: string
          id: string
          note: string
          note_color: string
          report_month: string
          trainee_name: string
          trainee_phone: string
          updated_at: string
        }
        Insert: {
          assigned_trainer_id?: string | null
          author_id: string
          created_at?: string
          id?: string
          note?: string
          note_color?: string
          report_month: string
          trainee_name: string
          trainee_phone: string
          updated_at?: string
        }
        Update: {
          assigned_trainer_id?: string | null
          author_id?: string
          created_at?: string
          id?: string
          note?: string
          note_color?: string
          report_month?: string
          trainee_name?: string
          trainee_phone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "retention_notes_assigned_trainer_id_fkey"
            columns: ["assigned_trainer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      retention_reports: {
        Row: {
          created_at: string
          data: Json
          id: string
          report_month: string
        }
        Insert: {
          created_at?: string
          data: Json
          id?: string
          report_month: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          report_month?: string
        }
        Relationships: []
      }
      session_template_exercises: {
        Row: {
          exercise_id: string
          id: string
          notes_he: string | null
          order_index: number
          target_distance_m: number | null
          target_duration_seconds: number | null
          target_load_he: string | null
          target_reps: number | null
          target_reps_he: string | null
          target_sets: number | null
          target_weight_kg: number | null
          template_id: string
        }
        Insert: {
          exercise_id: string
          id?: string
          notes_he?: string | null
          order_index?: number
          target_distance_m?: number | null
          target_duration_seconds?: number | null
          target_load_he?: string | null
          target_reps?: number | null
          target_reps_he?: string | null
          target_sets?: number | null
          target_weight_kg?: number | null
          template_id: string
        }
        Update: {
          exercise_id?: string
          id?: string
          notes_he?: string | null
          order_index?: number
          target_distance_m?: number | null
          target_duration_seconds?: number | null
          target_load_he?: string | null
          target_reps?: number | null
          target_reps_he?: string | null
          target_sets?: number | null
          target_weight_kg?: number | null
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_template_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "workout_exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_template_exercises_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "session_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      session_templates: {
        Row: {
          created_at: string
          created_by: string
          created_by_name: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          created_by_name: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          created_by_name?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_change_requests: {
        Row: {
          applied_shift_id: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          id: string
          original_end_time: string | null
          original_start_time: string | null
          reason: string | null
          request_type: Database["public"]["Enums"]["shift_change_request_type"]
          requested_end_time: string
          requested_start_time: string
          shift_period: Database["public"]["Enums"]["shift_period"]
          status: Database["public"]["Enums"]["shift_change_request_status"]
          target_shift_id: string | null
          trainer_id: string
          trainer_name: string
          updated_at: string
        }
        Insert: {
          applied_shift_id?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          id?: string
          original_end_time?: string | null
          original_start_time?: string | null
          reason?: string | null
          request_type: Database["public"]["Enums"]["shift_change_request_type"]
          requested_end_time: string
          requested_start_time: string
          shift_period?: Database["public"]["Enums"]["shift_period"]
          status?: Database["public"]["Enums"]["shift_change_request_status"]
          target_shift_id?: string | null
          trainer_id: string
          trainer_name: string
          updated_at?: string
        }
        Update: {
          applied_shift_id?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          id?: string
          original_end_time?: string | null
          original_start_time?: string | null
          reason?: string | null
          request_type?: Database["public"]["Enums"]["shift_change_request_type"]
          requested_end_time?: string
          requested_start_time?: string
          shift_period?: Database["public"]["Enums"]["shift_period"]
          status?: Database["public"]["Enums"]["shift_change_request_status"]
          target_shift_id?: string | null
          trainer_id?: string
          trainer_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_change_requests_applied_shift_id_fkey"
            columns: ["applied_shift_id"]
            isOneToOne: false
            referencedRelation: "trainer_shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_change_requests_target_shift_id_fkey"
            columns: ["target_shift_id"]
            isOneToOne: false
            referencedRelation: "trainer_shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      slot_workout_exercises: {
        Row: {
          exercise_id: string
          id: string
          notes_he: string | null
          order_index: number
          slot_id: string
          target_distance_m: number | null
          target_duration_seconds: number | null
          target_load_he: string | null
          target_reps: number | null
          target_reps_he: string | null
          target_sets: number | null
          target_weight_kg: number | null
        }
        Insert: {
          exercise_id: string
          id?: string
          notes_he?: string | null
          order_index?: number
          slot_id: string
          target_distance_m?: number | null
          target_duration_seconds?: number | null
          target_load_he?: string | null
          target_reps?: number | null
          target_reps_he?: string | null
          target_sets?: number | null
          target_weight_kg?: number | null
        }
        Update: {
          exercise_id?: string
          id?: string
          notes_he?: string | null
          order_index?: number
          slot_id?: string
          target_distance_m?: number | null
          target_duration_seconds?: number | null
          target_load_he?: string | null
          target_reps?: number | null
          target_reps_he?: string | null
          target_sets?: number | null
          target_weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "slot_workout_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "workout_exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slot_workout_exercises_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "daily_schedule_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      trainee_clips: {
        Row: {
          id: string
          mime_type: string
          size_bytes: number
          storage_path: string
          uploaded_at: string
          user_id: string
        }
        Insert: {
          id?: string
          mime_type: string
          size_bytes: number
          storage_path: string
          uploaded_at?: string
          user_id: string
        }
        Update: {
          id?: string
          mime_type?: string
          size_bytes?: number
          storage_path?: string
          uploaded_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trainee_clips_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      trainee_communication_log: {
        Row: {
          author_id: string
          author_name: string
          content: string
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          id: string
          trainee_id: string
        }
        Insert: {
          author_id: string
          author_name: string
          content: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          trainee_id: string
        }
        Update: {
          author_id?: string
          author_name?: string
          content?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          trainee_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trainee_communication_log_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainee_communication_log_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainee_communication_log_trainee_id_fkey"
            columns: ["trainee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      trainee_meal_plans: {
        Row: {
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          id: string
          meal_plan: Json | null
          pdf_path: string | null
          pdf_url: string | null
          rest_day_pdf_path: string | null
          rest_day_pdf_url: string | null
          updated_at: string | null
          user_id: string
          workout_day_pdf_path: string | null
          workout_day_pdf_url: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          meal_plan?: Json | null
          pdf_path?: string | null
          pdf_url?: string | null
          rest_day_pdf_path?: string | null
          rest_day_pdf_url?: string | null
          updated_at?: string | null
          user_id: string
          workout_day_pdf_path?: string | null
          workout_day_pdf_url?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          meal_plan?: Json | null
          pdf_path?: string | null
          pdf_url?: string | null
          rest_day_pdf_path?: string | null
          rest_day_pdf_url?: string | null
          updated_at?: string | null
          user_id?: string
          workout_day_pdf_path?: string | null
          workout_day_pdf_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trainee_meal_plans_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainee_meal_plans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      trainee_next_games: {
        Row: {
          created_at: string
          game_date: string
          id: string
          opponent: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          game_date: string
          id?: string
          opponent: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          game_date?: string
          id?: string
          opponent?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trainee_next_games_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      trainee_plans: {
        Row: {
          branch_id: string
          created_at: string
          created_by: string | null
          ends_on: string
          id: string
          note: string | null
          order_id: string | null
          product_id: string
          profile_id: string
          reminded_3_days_at: string | null
          reminded_expired_at: string | null
          reminded_last_session_at: string | null
          sessions_total: number | null
          source: string
          starts_on: string
          status: string
          updated_at: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          created_by?: string | null
          ends_on: string
          id?: string
          note?: string | null
          order_id?: string | null
          product_id: string
          profile_id: string
          reminded_3_days_at?: string | null
          reminded_expired_at?: string | null
          reminded_last_session_at?: string | null
          sessions_total?: number | null
          source: string
          starts_on: string
          status?: string
          updated_at?: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          created_by?: string | null
          ends_on?: string
          id?: string
          note?: string | null
          order_id?: string | null
          product_id?: string
          profile_id?: string
          reminded_3_days_at?: string | null
          reminded_expired_at?: string | null
          reminded_last_session_at?: string | null
          sessions_total?: number | null
          source?: string
          starts_on?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trainee_plans_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainee_plans_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainee_plans_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainee_plans_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "plan_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainee_plans_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      trainee_summaries: {
        Row: {
          author_id: string
          created_at: string
          id: string
          summary: string
          updated_at: string
          user_id: string
        }
        Insert: {
          author_id: string
          created_at?: string
          id?: string
          summary: string
          updated_at?: string
          user_id: string
        }
        Update: {
          author_id?: string
          created_at?: string
          id?: string
          summary?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trainee_summaries_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainee_summaries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      trainer_shift_reports: {
        Row: {
          achievements_details: string | null
          achievements_per_trainee: Json | null
          achievements_trainee_ids: string[] | null
          complaints_details: string | null
          complaints_per_trainee: Json
          complaints_trainee_ids: string[] | null
          discipline_details: string | null
          discipline_per_trainee: Json
          discipline_trainee_ids: string[] | null
          external_visitors_details: string | null
          facility_cleaned_scheduled: boolean
          facility_left_clean: boolean
          facility_not_clean_reason: string | null
          facility_not_cleaned_reason: string | null
          has_achievements: boolean
          has_complaints: boolean
          has_discipline_issues: boolean
          has_external_visitors: boolean
          has_homework: boolean
          has_injuries: boolean
          has_insufficient_attention: boolean
          has_parent_complaints: boolean
          has_parent_seeking_staff: boolean
          has_physical_limitations: boolean
          has_poor_mental_state: boolean
          has_praise: boolean
          has_pro_candidates: boolean
          has_social_skills: boolean
          has_video_feedback: boolean
          has_worked_on_focus: boolean
          homework_details: string | null
          homework_per_trainee: Json
          homework_trainee_ids: string[]
          id: string
          injuries_details: string | null
          injuries_per_trainee: Json
          injuries_trainee_ids: string[] | null
          insufficient_attention_details: string | null
          insufficient_attention_per_trainee: Json
          insufficient_attention_trainee_ids: string[] | null
          limitations_details: string | null
          limitations_per_trainee: Json
          limitations_trainee_ids: string[] | null
          mental_state_details: string | null
          mental_state_per_trainee: Json
          mental_state_trainee_ids: string[] | null
          new_trainees_details: string | null
          new_trainees_ids: string[] | null
          new_trainees_per_trainee: Json
          parent_complaints_details: string | null
          parent_seeking_details: string | null
          praise_details: string | null
          praise_per_trainee: Json
          praise_trainee_ids: string[]
          pro_candidates_details: string | null
          pro_candidates_per_trainee: Json
          pro_candidates_trainee_ids: string[] | null
          report_date: string
          social_skills_details: string | null
          social_skills_per_trainee: Json
          social_skills_trainee_ids: string[] | null
          submitted_at: string | null
          trained_new_trainees: boolean
          trainer_id: string
          trainer_name: string
          updated_at: string | null
          video_feedback_details: string | null
          video_feedback_per_trainee: Json
          video_feedback_trainee_ids: string[]
          worked_on_details: string | null
          worked_on_per_trainee: Json
          worked_on_trainee_ids: string[]
        }
        Insert: {
          achievements_details?: string | null
          achievements_per_trainee?: Json | null
          achievements_trainee_ids?: string[] | null
          complaints_details?: string | null
          complaints_per_trainee?: Json
          complaints_trainee_ids?: string[] | null
          discipline_details?: string | null
          discipline_per_trainee?: Json
          discipline_trainee_ids?: string[] | null
          external_visitors_details?: string | null
          facility_cleaned_scheduled?: boolean
          facility_left_clean?: boolean
          facility_not_clean_reason?: string | null
          facility_not_cleaned_reason?: string | null
          has_achievements?: boolean
          has_complaints?: boolean
          has_discipline_issues?: boolean
          has_external_visitors?: boolean
          has_homework?: boolean
          has_injuries?: boolean
          has_insufficient_attention?: boolean
          has_parent_complaints?: boolean
          has_parent_seeking_staff?: boolean
          has_physical_limitations?: boolean
          has_poor_mental_state?: boolean
          has_praise?: boolean
          has_pro_candidates?: boolean
          has_social_skills?: boolean
          has_video_feedback?: boolean
          has_worked_on_focus?: boolean
          homework_details?: string | null
          homework_per_trainee?: Json
          homework_trainee_ids?: string[]
          id?: string
          injuries_details?: string | null
          injuries_per_trainee?: Json
          injuries_trainee_ids?: string[] | null
          insufficient_attention_details?: string | null
          insufficient_attention_per_trainee?: Json
          insufficient_attention_trainee_ids?: string[] | null
          limitations_details?: string | null
          limitations_per_trainee?: Json
          limitations_trainee_ids?: string[] | null
          mental_state_details?: string | null
          mental_state_per_trainee?: Json
          mental_state_trainee_ids?: string[] | null
          new_trainees_details?: string | null
          new_trainees_ids?: string[] | null
          new_trainees_per_trainee?: Json
          parent_complaints_details?: string | null
          parent_seeking_details?: string | null
          praise_details?: string | null
          praise_per_trainee?: Json
          praise_trainee_ids?: string[]
          pro_candidates_details?: string | null
          pro_candidates_per_trainee?: Json
          pro_candidates_trainee_ids?: string[] | null
          report_date: string
          social_skills_details?: string | null
          social_skills_per_trainee?: Json
          social_skills_trainee_ids?: string[] | null
          submitted_at?: string | null
          trained_new_trainees?: boolean
          trainer_id: string
          trainer_name: string
          updated_at?: string | null
          video_feedback_details?: string | null
          video_feedback_per_trainee?: Json
          video_feedback_trainee_ids?: string[]
          worked_on_details?: string | null
          worked_on_per_trainee?: Json
          worked_on_trainee_ids?: string[]
        }
        Update: {
          achievements_details?: string | null
          achievements_per_trainee?: Json | null
          achievements_trainee_ids?: string[] | null
          complaints_details?: string | null
          complaints_per_trainee?: Json
          complaints_trainee_ids?: string[] | null
          discipline_details?: string | null
          discipline_per_trainee?: Json
          discipline_trainee_ids?: string[] | null
          external_visitors_details?: string | null
          facility_cleaned_scheduled?: boolean
          facility_left_clean?: boolean
          facility_not_clean_reason?: string | null
          facility_not_cleaned_reason?: string | null
          has_achievements?: boolean
          has_complaints?: boolean
          has_discipline_issues?: boolean
          has_external_visitors?: boolean
          has_homework?: boolean
          has_injuries?: boolean
          has_insufficient_attention?: boolean
          has_parent_complaints?: boolean
          has_parent_seeking_staff?: boolean
          has_physical_limitations?: boolean
          has_poor_mental_state?: boolean
          has_praise?: boolean
          has_pro_candidates?: boolean
          has_social_skills?: boolean
          has_video_feedback?: boolean
          has_worked_on_focus?: boolean
          homework_details?: string | null
          homework_per_trainee?: Json
          homework_trainee_ids?: string[]
          id?: string
          injuries_details?: string | null
          injuries_per_trainee?: Json
          injuries_trainee_ids?: string[] | null
          insufficient_attention_details?: string | null
          insufficient_attention_per_trainee?: Json
          insufficient_attention_trainee_ids?: string[] | null
          limitations_details?: string | null
          limitations_per_trainee?: Json
          limitations_trainee_ids?: string[] | null
          mental_state_details?: string | null
          mental_state_per_trainee?: Json
          mental_state_trainee_ids?: string[] | null
          new_trainees_details?: string | null
          new_trainees_ids?: string[] | null
          new_trainees_per_trainee?: Json
          parent_complaints_details?: string | null
          parent_seeking_details?: string | null
          praise_details?: string | null
          praise_per_trainee?: Json
          praise_trainee_ids?: string[]
          pro_candidates_details?: string | null
          pro_candidates_per_trainee?: Json
          pro_candidates_trainee_ids?: string[] | null
          report_date?: string
          social_skills_details?: string | null
          social_skills_per_trainee?: Json
          social_skills_trainee_ids?: string[] | null
          submitted_at?: string | null
          trained_new_trainees?: boolean
          trainer_id?: string
          trainer_name?: string
          updated_at?: string | null
          video_feedback_details?: string | null
          video_feedback_per_trainee?: Json
          video_feedback_trainee_ids?: string[]
          worked_on_details?: string | null
          worked_on_per_trainee?: Json
          worked_on_trainee_ids?: string[]
        }
        Relationships: []
      }
      trainer_shifts: {
        Row: {
          auto_ended: boolean | null
          branch_id: string | null
          created_at: string | null
          end_time: string | null
          flagged_for_review: boolean | null
          id: string
          other_purpose_category: string | null
          other_purpose_minutes: number
          shift_period: Database["public"]["Enums"]["shift_period"]
          start_time: string
          trainer_id: string
          trainer_name: string
          updated_at: string | null
        }
        Insert: {
          auto_ended?: boolean | null
          branch_id?: string | null
          created_at?: string | null
          end_time?: string | null
          flagged_for_review?: boolean | null
          id?: string
          other_purpose_category?: string | null
          other_purpose_minutes?: number
          shift_period?: Database["public"]["Enums"]["shift_period"]
          start_time?: string
          trainer_id: string
          trainer_name: string
          updated_at?: string | null
        }
        Update: {
          auto_ended?: boolean | null
          branch_id?: string | null
          created_at?: string | null
          end_time?: string | null
          flagged_for_review?: boolean | null
          id?: string
          other_purpose_category?: string | null
          other_purpose_minutes?: number
          shift_period?: Database["public"]["Enums"]["shift_period"]
          start_time?: string
          trainer_id?: string
          trainer_name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trainer_shifts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      trainer_tasks: {
        Row: {
          admin_seen_at: string | null
          assigned_to: string
          cancelled_at: string | null
          completed_at: string | null
          completed_by: string | null
          completion_note: string | null
          created_at: string
          created_by: string
          created_by_name: string
          description: string | null
          due_date: string
          id: string
          reopen_reason: string | null
          status: Database["public"]["Enums"]["trainer_task_status"]
          title: string
          trainee_id: string | null
          updated_at: string
        }
        Insert: {
          admin_seen_at?: string | null
          assigned_to: string
          cancelled_at?: string | null
          completed_at?: string | null
          completed_by?: string | null
          completion_note?: string | null
          created_at?: string
          created_by: string
          created_by_name: string
          description?: string | null
          due_date: string
          id?: string
          reopen_reason?: string | null
          status?: Database["public"]["Enums"]["trainer_task_status"]
          title: string
          trainee_id?: string | null
          updated_at?: string
        }
        Update: {
          admin_seen_at?: string | null
          assigned_to?: string
          cancelled_at?: string | null
          completed_at?: string | null
          completed_by?: string | null
          completion_note?: string | null
          created_at?: string
          created_by?: string
          created_by_name?: string
          description?: string | null
          due_date?: string
          id?: string
          reopen_reason?: string | null
          status?: Database["public"]["Enums"]["trainer_task_status"]
          title?: string
          trainee_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trainer_tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainer_tasks_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainer_tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainer_tasks_trainee_id_fkey"
            columns: ["trainee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      trainers: {
        Row: {
          active: boolean | null
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      training_session_exercises: {
        Row: {
          exercise_id: string
          id: string
          notes_he: string | null
          order_index: number
          session_id: string
          target_distance_m: number | null
          target_duration_seconds: number | null
          target_load_he: string | null
          target_reps: number | null
          target_reps_he: string | null
          target_sets: number | null
          target_weight_kg: number | null
        }
        Insert: {
          exercise_id: string
          id?: string
          notes_he?: string | null
          order_index?: number
          session_id: string
          target_distance_m?: number | null
          target_duration_seconds?: number | null
          target_load_he?: string | null
          target_reps?: number | null
          target_reps_he?: string | null
          target_sets?: number | null
          target_weight_kg?: number | null
        }
        Update: {
          exercise_id?: string
          id?: string
          notes_he?: string | null
          order_index?: number
          session_id?: string
          target_distance_m?: number | null
          target_duration_seconds?: number | null
          target_load_he?: string | null
          target_reps?: number | null
          target_reps_he?: string | null
          target_sets?: number | null
          target_weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "training_session_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "workout_exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_session_exercises_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "training_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      training_sessions: {
        Row: {
          built_by: string
          built_by_name: string
          completed_at: string | null
          created_at: string
          id: string
          notes_he: string | null
          session_date: string
          slot_id: string | null
          slot_workout_synced_at: string | null
          trainee_id: string
          updated_at: string
        }
        Insert: {
          built_by: string
          built_by_name: string
          completed_at?: string | null
          created_at?: string
          id?: string
          notes_he?: string | null
          session_date: string
          slot_id?: string | null
          slot_workout_synced_at?: string | null
          trainee_id: string
          updated_at?: string
        }
        Update: {
          built_by?: string
          built_by_name?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          notes_he?: string | null
          session_date?: string
          slot_id?: string | null
          slot_workout_synced_at?: string | null
          trainee_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_sessions_built_by_fkey"
            columns: ["built_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_sessions_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "daily_schedule_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_sessions_trainee_id_fkey"
            columns: ["trainee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_achievements: {
        Row: {
          badge_type: Database["public"]["Enums"]["achievement_badge_type"]
          celebrated: boolean
          id: string
          metadata: Json | null
          unlocked_at: string
          user_id: string
        }
        Insert: {
          badge_type: Database["public"]["Enums"]["achievement_badge_type"]
          celebrated?: boolean
          id?: string
          metadata?: Json | null
          unlocked_at?: string
          user_id: string
        }
        Update: {
          badge_type?: Database["public"]["Enums"]["achievement_badge_type"]
          celebrated?: boolean
          id?: string
          metadata?: Json | null
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_streaks: {
        Row: {
          created_at: string
          current_streak: number
          last_activity_date: string | null
          longest_streak: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_streak?: number
          last_activity_date?: string | null
          longest_streak?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_streak?: number
          last_activity_date?: string | null
          longest_streak?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_streaks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      video_progress: {
        Row: {
          id: string
          user_id: string
          video_id: string
          watched: boolean | null
          watched_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          video_id: string
          watched?: boolean | null
          watched_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          video_id?: string
          watched?: boolean | null
          watched_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "video_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_progress_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "workout_videos"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_schedule_band_trainers: {
        Row: {
          band_id: string
          created_at: string
          id: string
          order_index: number
          trainer_id: string | null
          trainer_name: string
        }
        Insert: {
          band_id: string
          created_at?: string
          id?: string
          order_index?: number
          trainer_id?: string | null
          trainer_name: string
        }
        Update: {
          band_id?: string
          created_at?: string
          id?: string
          order_index?: number
          trainer_id?: string | null
          trainer_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_schedule_band_trainers_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "weekly_schedule_bands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_schedule_band_trainers_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_schedule_bands: {
        Row: {
          branch_id: string | null
          created_at: string
          created_by: string
          end_time: string | null
          id: string
          is_bookable: boolean
          is_standby: boolean
          label_he: string | null
          location_he: string | null
          max_trainees: number
          start_time: string
          trainer_id: string
          trainer_name: string
          updated_at: string
          weekday: number
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          created_by: string
          end_time?: string | null
          id?: string
          is_bookable?: boolean
          is_standby?: boolean
          label_he?: string | null
          location_he?: string | null
          max_trainees?: number
          start_time: string
          trainer_id: string
          trainer_name: string
          updated_at?: string
          weekday: number
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          created_by?: string
          end_time?: string | null
          id?: string
          is_bookable?: boolean
          is_standby?: boolean
          label_he?: string | null
          location_he?: string | null
          max_trainees?: number
          start_time?: string
          trainer_id?: string
          trainer_name?: string
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "weekly_schedule_bands_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_schedule_bands_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_schedule_bands_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_schedule_exceptions: {
        Row: {
          branch_id: string | null
          created_at: string
          created_by: string
          end_time: string | null
          exception_date: string
          id: string
          kind: string
          label_he: string | null
          location_he: string | null
          note_he: string | null
          start_time: string | null
          trainer_id: string
          trainer_name: string
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          created_by: string
          end_time?: string | null
          exception_date: string
          id?: string
          kind: string
          label_he?: string | null
          location_he?: string | null
          note_he?: string | null
          start_time?: string | null
          trainer_id: string
          trainer_name: string
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          created_by?: string
          end_time?: string | null
          exception_date?: string
          id?: string
          kind?: string
          label_he?: string | null
          location_he?: string | null
          note_he?: string | null
          start_time?: string | null
          trainer_id?: string
          trainer_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_schedule_exceptions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_schedule_exceptions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_schedule_exceptions_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_exercises: {
        Row: {
          created_at: string
          cues_he: string | null
          default_distance_m: number | null
          default_duration_seconds: number | null
          default_reps: number | null
          default_sets: number | null
          default_weight_kg: number | null
          equipment: string | null
          equipment_id: string | null
          goal_he: string | null
          id: string
          main_category: string
          name_en: string | null
          name_he: string | null
          order_index: number
          sub_category: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          cues_he?: string | null
          default_distance_m?: number | null
          default_duration_seconds?: number | null
          default_reps?: number | null
          default_sets?: number | null
          default_weight_kg?: number | null
          equipment?: string | null
          equipment_id?: string | null
          goal_he?: string | null
          id?: string
          main_category: string
          name_en?: string | null
          name_he?: string | null
          order_index?: number
          sub_category?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          cues_he?: string | null
          default_distance_m?: number | null
          default_duration_seconds?: number | null
          default_reps?: number | null
          default_sets?: number | null
          default_weight_kg?: number | null
          equipment?: string | null
          equipment_id?: string | null
          goal_he?: string | null
          id?: string
          main_category?: string
          name_en?: string | null
          name_he?: string | null
          order_index?: number
          sub_category?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_exercises_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_program_cells: {
        Row: {
          id: string
          load_he: string | null
          notes_he: string | null
          program_exercise_id: string
          reps_he: string | null
          sets: number | null
          week_number: number
        }
        Insert: {
          id?: string
          load_he?: string | null
          notes_he?: string | null
          program_exercise_id: string
          reps_he?: string | null
          sets?: number | null
          week_number: number
        }
        Update: {
          id?: string
          load_he?: string | null
          notes_he?: string | null
          program_exercise_id?: string
          reps_he?: string | null
          sets?: number | null
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "workout_program_cells_program_exercise_id_fkey"
            columns: ["program_exercise_id"]
            isOneToOne: false
            referencedRelation: "workout_program_exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_program_exercises: {
        Row: {
          created_at: string
          exercise_id: string
          id: string
          notes_he: string | null
          order_index: number
          program_id: string
        }
        Insert: {
          created_at?: string
          exercise_id: string
          id?: string
          notes_he?: string | null
          order_index?: number
          program_id: string
        }
        Update: {
          created_at?: string
          exercise_id?: string
          id?: string
          notes_he?: string | null
          order_index?: number
          program_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_program_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "workout_exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_program_exercises_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "workout_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_programs: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          order_index: number
          periodization_type: string | null
          updated_at: string
          weeks: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          order_index?: number
          periodization_type?: string | null
          updated_at?: string
          weeks?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          order_index?: number
          periodization_type?: string | null
          updated_at?: string
          weeks?: number
        }
        Relationships: [
          {
            foreignKeyName: "workout_programs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_videos: {
        Row: {
          created_at: string | null
          day_number: number
          day_topic: string
          description: string | null
          duration_minutes: number
          id: string
          order_index: number
          title: string
          youtube_url: string
        }
        Insert: {
          created_at?: string | null
          day_number: number
          day_topic: string
          description?: string | null
          duration_minutes: number
          id?: string
          order_index: number
          title: string
          youtube_url: string
        }
        Update: {
          created_at?: string | null
          day_number?: number
          day_topic?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          order_index?: number
          title?: string
          youtube_url?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_slot_workout: {
        Args: { p_slot_id: string }
        Returns: {
          action: string
          trainee_count: number
        }[]
      }
      apply_slot_workout_to_trainee: {
        Args: { p_slot_id: string; p_trainee_id: string }
        Returns: string
      }
      approve_shift_change_request: {
        Args: {
          p_actor_id: string
          p_note: string
          p_override_end?: string
          p_override_start?: string
          p_request_id: string
        }
        Returns: {
          applied_shift_id: string
          mode: string
        }[]
      }
      book_slot: {
        Args: {
          p_plan_ends: string
          p_plan_starts: string
          p_sessions_total: number
          p_sessions_used: number
          p_slot_id: string
          p_today: string
          p_trainee_id: string
          p_trainee_name: string
          p_weekly_cap: number
        }
        Returns: {
          max_trainees: number
          roster_id: string
          seats_taken: number
        }[]
      }
      clear_slot_workout: { Args: { p_slot_id: string }; Returns: number }
      compute_age_group: { Args: { p_birthdate: string }; Returns: string }
      count_weekdays_missed: {
        Args: { current_activity: string; last_activity: string }
        Returns: number
      }
      drop_slot_workout_session: {
        Args: { p_slot_id: string; p_trainee_id: string }
        Returns: boolean
      }
      get_user_role: {
        Args: { user_id: string }
        Returns: Database["public"]["Enums"]["user_role"]
      }
      is_admin_or_trainer: { Args: never; Returns: boolean }
      is_course_admin: { Args: never; Returns: boolean }
      is_course_staff: { Args: never; Returns: boolean }
      is_goal_achieved: {
        Args: {
          p_current_value: number
          p_is_lower_better: boolean
          p_target_value: number
        }
        Returns: boolean
      }
      is_weekday_israel: { Args: { check_timestamp: string }; Returns: boolean }
      recalculate_age_group_benchmarks: {
        Args: { p_age_group: string }
        Returns: undefined
      }
      reorder_course_chapters: {
        Args: { p_course_id: string; p_ids: string[] }
        Returns: undefined
      }
      reorder_course_lessons: {
        Args: { p_chapter_id: string; p_ids: string[] }
        Returns: undefined
      }
      replace_session_exercises: {
        Args: { p_exercises: Json; p_session_id: string }
        Returns: undefined
      }
      replace_slot_roster: {
        Args: { p_slot_id: string; p_trainees: Json }
        Returns: undefined
      }
      replace_template_exercises: {
        Args: { p_exercises: Json; p_template_id: string }
        Returns: undefined
      }
      save_slot_workout: {
        Args: {
          p_built_by: string
          p_built_by_name: string
          p_exercises: Json
          p_notes: string
          p_slot_id: string
        }
        Returns: {
          action: string
          trainee_count: number
        }[]
      }
      save_workout_program_grid: {
        Args: { p_program_id: string; p_rows: Json }
        Returns: undefined
      }
      soft_delete_user: { Args: { target_user_id: string }; Returns: undefined }
      update_user_streak: {
        Args: { p_activity_timestamp: string; p_user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      achievement_badge_type:
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
        | "five_goals_achieved"
        | "book_first_drill"
        | "book_ten_drills"
        | "book_category_complete"
        | "book_all_drills"
        | "course_first_lesson"
        | "course_chapter_complete"
        | "course_complete"
      lead_contact_outcome:
        | "interested"
        | "not_interested"
        | "callback"
        | "no_answer"
      lead_contact_type: "call" | "whatsapp" | "meeting" | "message_sent"
      lead_message_type: "template" | "flow" | "text"
      lead_status:
        | "new"
        | "callback"
        | "in_progress"
        | "closed"
        | "disqualified"
      nutrition_appointment_status: "not_scheduled" | "scheduled" | "completed"
      shift_change_request_status:
        | "pending"
        | "approved"
        | "rejected"
        | "cancelled"
      shift_change_request_type: "edit" | "retro_add"
      shift_period: "morning" | "regular"
      trainer_task_status: "open" | "done" | "cancelled"
      user_role: "trainee" | "trainer" | "admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      achievement_badge_type: [
        "nutrition_form_completed",
        "profile_completed",
        "first_pre_workout",
        "first_post_workout",
        "first_video_watched",
        "videos_day_complete",
        "all_videos_watched",
        "first_assessment",
        "five_assessments",
        "ten_assessments",
        "sprint_improved",
        "jump_improved",
        "overall_improved_5pts",
        "overall_improved_10pts",
        "streak_7_days",
        "streak_30_days",
        "streak_100_days",
        "first_goal_achieved",
        "five_goals_achieved",
        "book_first_drill",
        "book_ten_drills",
        "book_category_complete",
        "book_all_drills",
        "course_first_lesson",
        "course_chapter_complete",
        "course_complete",
      ],
      lead_contact_outcome: [
        "interested",
        "not_interested",
        "callback",
        "no_answer",
      ],
      lead_contact_type: ["call", "whatsapp", "meeting", "message_sent"],
      lead_message_type: ["template", "flow", "text"],
      lead_status: ["new", "callback", "in_progress", "closed", "disqualified"],
      nutrition_appointment_status: ["not_scheduled", "scheduled", "completed"],
      shift_change_request_status: [
        "pending",
        "approved",
        "rejected",
        "cancelled",
      ],
      shift_change_request_type: ["edit", "retro_add"],
      shift_period: ["morning", "regular"],
      trainer_task_status: ["open", "done", "cancelled"],
      user_role: ["trainee", "trainer", "admin"],
    },
  },
} as const
