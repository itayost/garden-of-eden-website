-- Extend achievement_badge_type enum with player-development-book badges.
ALTER TYPE achievement_badge_type ADD VALUE IF NOT EXISTS 'book_first_drill';
ALTER TYPE achievement_badge_type ADD VALUE IF NOT EXISTS 'book_ten_drills';
ALTER TYPE achievement_badge_type ADD VALUE IF NOT EXISTS 'book_category_complete';
ALTER TYPE achievement_badge_type ADD VALUE IF NOT EXISTS 'book_all_drills';
