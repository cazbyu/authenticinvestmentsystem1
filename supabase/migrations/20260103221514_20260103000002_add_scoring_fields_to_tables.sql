/*
  # Add Scoring Fields to Existing Tables

  Updates existing tables with scoring system fields
*/

-- =====================================================
-- 1. USER PREFERENCES TABLE
-- =====================================================

ALTER TABLE "0008-ap-user-preferences"
ADD COLUMN IF NOT EXISTS "morning_spark_time" TIME DEFAULT '06:00:00',
ADD COLUMN IF NOT EXISTS "week_start_day" INTEGER DEFAULT 1;

COMMENT ON COLUMN "0008-ap-user-preferences"."morning_spark_time" IS 'User target wake-up time for Early Spark bonus calculation';
COMMENT ON COLUMN "0008-ap-user-preferences"."week_start_day" IS 'Week start day: 0=Sunday, 1=Monday, etc.';

-- =====================================================
-- 2. DAILY SPARKS TABLE
-- =====================================================

ALTER TABLE "0008-ap-daily-sparks"
ADD COLUMN IF NOT EXISTS "beat_target_bonus_awarded" BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS "spark_points" INTEGER DEFAULT 0;

COMMENT ON COLUMN "0008-ap-daily-sparks"."beat_target_bonus_awarded" IS 'True if user beat their daily target (+10 bonus)';
COMMENT ON COLUMN "0008-ap-daily-sparks"."spark_points" IS 'Points earned from this spark (5 or 10 based on timing)';

-- =====================================================
-- 3. DAILY REVIEWS TABLE
-- =====================================================

ALTER TABLE "0008-ap-daily-reviews"
ADD COLUMN IF NOT EXISTS "review_points" INTEGER DEFAULT 0;

COMMENT ON COLUMN "0008-ap-daily-reviews"."review_points" IS 'Points earned from this evening review (10 if before midnight)';

-- =====================================================
-- 4. REFLECTIONS TABLE
-- =====================================================

ALTER TABLE "0008-ap-reflections"
ADD COLUMN IF NOT EXISTS "is_first_rose_of_day" BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS "points_awarded" INTEGER DEFAULT 0;

COMMENT ON COLUMN "0008-ap-reflections"."is_first_rose_of_day" IS 'True if this was the first rose reflection of the day (+1 bonus)';
COMMENT ON COLUMN "0008-ap-reflections"."points_awarded" IS 'Points awarded for this reflection (1 or 2)';

-- =====================================================
-- 5. TASKS TABLE
-- =====================================================

ALTER TABLE "0008-ap-tasks"
ADD COLUMN IF NOT EXISTS "is_deposit_idea" BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN "0008-ap-tasks"."is_deposit_idea" IS 'True if this task was activated from a deposit idea (+5 vs +3 points)';

-- =====================================================
-- 6. DEPOSIT IDEAS TABLE
-- =====================================================

ALTER TABLE "0008-ap-deposit-ideas"
ADD COLUMN IF NOT EXISTS "creation_points_awarded" BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN "0008-ap-deposit-ideas"."creation_points_awarded" IS 'True if +1 creation bonus already awarded';

-- =====================================================
-- 7. GOALS TABLES
-- =====================================================

ALTER TABLE "0008-ap-goals-12wk"
ADD COLUMN IF NOT EXISTS "completion_reward" TEXT;

ALTER TABLE "0008-ap-goals-custom"
ADD COLUMN IF NOT EXISTS "completion_reward" TEXT;

COMMENT ON COLUMN "0008-ap-goals-12wk"."completion_reward" IS 'User-defined reward text shown on goal completion (no points awarded)';
COMMENT ON COLUMN "0008-ap-goals-custom"."completion_reward" IS 'User-defined reward text shown on goal completion (no points awarded)';

-- =====================================================
-- 8. ADD INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_daily_sparks_user_date
  ON "0008-ap-daily-sparks" (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_daily_reviews_user_date
  ON "0008-ap-daily-reviews" (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reflections_user_date
  ON "0008-ap-reflections" (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reflections_rose_first
  ON "0008-ap-reflections" (user_id, is_first_rose_of_day)
  WHERE is_first_rose_of_day = TRUE;

CREATE INDEX IF NOT EXISTS idx_tasks_deposit_idea
  ON "0008-ap-tasks" (user_id, is_deposit_idea)
  WHERE is_deposit_idea = TRUE;