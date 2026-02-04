-- Garden of Eden Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create user role enum
CREATE TYPE user_role AS ENUM ('trainee', 'trainer', 'admin');

-- Profiles table (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  role user_role DEFAULT 'trainee',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trainers table
CREATE TABLE trainers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pre-workout forms
CREATE TABLE pre_workout_forms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  age INTEGER,
  group_training TEXT,
  urine_color TEXT,
  nutrition_status TEXT,
  last_game TEXT,
  improvements_desired TEXT,
  sleep_hours TEXT,
  recent_injury TEXT,
  next_match TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

-- Post-workout forms
CREATE TABLE post_workout_forms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  training_date DATE NOT NULL,
  trainer_id UUID REFERENCES trainers(id),
  difficulty_level INTEGER CHECK (difficulty_level >= 1 AND difficulty_level <= 10),
  satisfaction_level INTEGER CHECK (satisfaction_level >= 1 AND satisfaction_level <= 10),
  comments TEXT,
  contact_info TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

-- Nutrition forms (one-time questionnaire)
CREATE TABLE nutrition_forms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  age INTEGER NOT NULL,
  years_competitive TEXT,
  previous_counseling BOOLEAN DEFAULT false,
  counseling_details TEXT,
  weight DECIMAL(5,2),
  height DECIMAL(3,2),
  allergies BOOLEAN DEFAULT false,
  allergies_details TEXT,
  chronic_conditions BOOLEAN DEFAULT false,
  conditions_details TEXT,
  medications TEXT,
  medications_list TEXT,
  bloating_frequency INTEGER,
  stomach_pain INTEGER,
  bowel_frequency INTEGER,
  stool_consistency TEXT,
  overuse_injuries TEXT,
  illness_interruptions INTEGER,
  max_days_missed INTEGER,
  fatigue_level INTEGER,
  concentration INTEGER,
  energy_level INTEGER,
  muscle_soreness INTEGER,
  physical_exhaustion INTEGER,
  preparedness INTEGER,
  overall_energy INTEGER,
  additional_comments TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workout videos
CREATE TABLE workout_videos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  day_number INTEGER NOT NULL CHECK (day_number >= 1 AND day_number <= 5),
  day_topic TEXT NOT NULL,
  title TEXT NOT NULL,
  youtube_url TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER NOT NULL,
  order_index INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Video progress tracking
CREATE TABLE video_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  video_id UUID NOT NULL REFERENCES workout_videos(id) ON DELETE CASCADE,
  watched BOOLEAN DEFAULT false,
  watched_at TIMESTAMPTZ,
  UNIQUE(user_id, video_id)
);

-- Indexes for better performance
CREATE INDEX idx_pre_workout_user ON pre_workout_forms(user_id);
CREATE INDEX idx_pre_workout_date ON pre_workout_forms(submitted_at);
CREATE INDEX idx_post_workout_user ON post_workout_forms(user_id);
CREATE INDEX idx_post_workout_date ON post_workout_forms(submitted_at);
CREATE INDEX idx_nutrition_user ON nutrition_forms(user_id);
CREATE INDEX idx_videos_day ON workout_videos(day_number);
CREATE INDEX idx_video_progress_user ON video_progress(user_id);

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainers ENABLE ROW LEVEL SECURITY;
ALTER TABLE pre_workout_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_workout_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrition_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_progress ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'trainer'))
  );

-- Trainers policies (public read)
CREATE POLICY "Anyone can view active trainers" ON trainers
  FOR SELECT USING (active = true);

CREATE POLICY "Admins can manage trainers" ON trainers
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Pre-workout forms policies
CREATE POLICY "Users can view own pre-workout forms" ON pre_workout_forms
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own pre-workout forms" ON pre_workout_forms
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all pre-workout forms" ON pre_workout_forms
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'trainer'))
  );

-- Post-workout forms policies
CREATE POLICY "Users can view own post-workout forms" ON post_workout_forms
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own post-workout forms" ON post_workout_forms
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all post-workout forms" ON post_workout_forms
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'trainer'))
  );

-- Nutrition forms policies
CREATE POLICY "Users can view own nutrition forms" ON nutrition_forms
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own nutrition forms" ON nutrition_forms
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all nutrition forms" ON nutrition_forms
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'trainer'))
  );

-- Workout videos policies (public read for authenticated)
CREATE POLICY "Authenticated users can view videos" ON workout_videos
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage videos" ON workout_videos
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Video progress policies
CREATE POLICY "Users can view own progress" ON video_progress
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own progress" ON video_progress
  FOR ALL USING (auth.uid() = user_id);

-- Function to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, phone, role)
  VALUES (new.id, new.phone, 'trainee');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Insert default trainers
INSERT INTO trainers (name, active) VALUES
  ('לידור חי זינטי', true),
  ('דניאל קמרט', true),
  ('נדב דטנר', true),
  ('אביעד וכשטוק', true),
  ('יונתן דנינו', true),
  ('דין לוי', true),
  ('עידו ברק', true);

-- Insert sample workout videos (placeholders)
INSERT INTO workout_videos (day_number, day_topic, title, youtube_url, description, duration_minutes, order_index) VALUES
  (1, 'גמישות ויציבות', 'תרגיל 1 - מתיחות דינמיות', 'https://youtube.com/watch?v=placeholder1', 'מתיחות דינמיות לחימום', 5, 1),
  (1, 'גמישות ויציבות', 'תרגיל 2 - חיזוק ליבה', 'https://youtube.com/watch?v=placeholder2', 'תרגילי ליבה בסיסיים', 8, 2),
  (2, 'כוח רגליים', 'תרגיל 1 - סקוואטים', 'https://youtube.com/watch?v=placeholder3', 'סקוואטים עם משקל גוף', 6, 1),
  (2, 'כוח רגליים', 'תרגיל 2 - לאנג׳ים', 'https://youtube.com/watch?v=placeholder4', 'לאנג׳ים קדימה ואחורה', 7, 2),
  (3, 'זריזות וקואורדינציה', 'תרגיל 1 - תרגילי זריזות', 'https://youtube.com/watch?v=placeholder5', 'תרגילי רגליים מהירות', 8, 1),
  (3, 'זריזות וקואורדינציה', 'תרגיל 2 - קואורדינציה', 'https://youtube.com/watch?v=placeholder6', 'תרגילי קואורדינציה עם כדור', 7, 2),
  (4, 'סיבולת לב-ריאה', 'תרגיל 1 - אינטרוולים', 'https://youtube.com/watch?v=placeholder7', 'ריצות אינטרוולים', 10, 1),
  (4, 'סיבולת לב-ריאה', 'תרגיל 2 - HIIT', 'https://youtube.com/watch?v=placeholder8', 'אימון HIIT קצר', 8, 2),
  (5, 'שיקום והתאוששות', 'תרגיל 1 - מתיחות', 'https://youtube.com/watch?v=placeholder9', 'מתיחות סטטיות', 10, 1),
  (5, 'שיקום והתאוששות', 'תרגיל 2 - רולר', 'https://youtube.com/watch?v=placeholder10', 'עבודה עם רולר קצף', 8, 2);
