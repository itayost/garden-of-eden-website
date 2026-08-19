-- Extend achievement_badge_type enum with digital-course badges.
ALTER TYPE achievement_badge_type ADD VALUE IF NOT EXISTS 'course_first_lesson';
ALTER TYPE achievement_badge_type ADD VALUE IF NOT EXISTS 'course_chapter_complete';
ALTER TYPE achievement_badge_type ADD VALUE IF NOT EXISTS 'course_complete';
