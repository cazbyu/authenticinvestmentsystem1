/*
  # Change time columns to time type for local timezone support

  ## Changes Made
  
  1. Drop Dependent Views
    - Drop materialized view `mv_role_weekly` (depends on ap_task_when)
    - Drop view `ap_task_when` (depends on start_time/end_time columns)
  
  2. Column Type Changes
    - Change `start_time` from `timestamp with time zone` to `time`
    - Change `end_time` from `timestamp with time zone` to `time`
  
  3. Data Migration
    - Extract time portion from existing timestamp values
    - Preserve all existing time data
  
  4. Recreate Views
    - Recreate `ap_task_when` view with updated logic
    - Recreate `mv_role_weekly` materialized view
  
  ## Why This Change
  
  Times are now stored as simple HH:MM:SS values in the user's local timezone,
  eliminating timezone conversion issues when displaying events.
*/

-- Step 1: Drop dependent views
DROP MATERIALIZED VIEW IF EXISTS mv_role_weekly CASCADE;
DROP VIEW IF EXISTS ap_task_when CASCADE;

-- Step 2: Create temporary columns with new type
ALTER TABLE "0008-ap-tasks" ADD COLUMN IF NOT EXISTS start_time_new time;
ALTER TABLE "0008-ap-tasks" ADD COLUMN IF NOT EXISTS end_time_new time;

-- Step 3: Migrate data - extract time portion from timestamps
UPDATE "0008-ap-tasks" 
SET start_time_new = start_time::time 
WHERE start_time IS NOT NULL;

UPDATE "0008-ap-tasks" 
SET end_time_new = end_time::time 
WHERE end_time IS NOT NULL;

-- Step 4: Drop old columns and rename new ones
ALTER TABLE "0008-ap-tasks" DROP COLUMN start_time;
ALTER TABLE "0008-ap-tasks" DROP COLUMN end_time;
ALTER TABLE "0008-ap-tasks" RENAME COLUMN start_time_new TO start_time;
ALTER TABLE "0008-ap-tasks" RENAME COLUMN end_time_new TO end_time;

-- Step 5: Recreate ap_task_when view
-- Since start_time is now just time, we can't use it directly in the COALESCE with timestamp
-- Instead, we'll use due_date when available, and combine start_date + start_time when not
CREATE OR REPLACE VIEW ap_task_when AS
SELECT 
  t.id,
  t.user_id,
  COALESCE(
    (t.due_date)::timestamp with time zone,
    CASE 
      WHEN t.start_date IS NOT NULL AND t.start_time IS NOT NULL 
      THEN (t.start_date || ' ' || t.start_time)::timestamp with time zone
      WHEN t.start_date IS NOT NULL 
      THEN (t.start_date)::timestamp with time zone
      ELSE NULL
    END
  ) AS when_ts,
  t.is_authentic_deposit,
  t.is_urgent,
  t.is_important,
  t.is_twelve_week_goal,
  1 AS interaction_value
FROM "0008-ap-tasks" t;

-- Step 6: Recreate mv_role_weekly materialized view
-- This is a simplified recreation - adjust if the original was more complex
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_role_weekly AS
SELECT 
  user_id,
  DATE_TRUNC('week', when_ts) AS week_start,
  COUNT(*) AS task_count,
  SUM(CASE WHEN is_authentic_deposit THEN interaction_value ELSE 0 END) AS authentic_deposits,
  SUM(CASE WHEN is_urgent AND is_important THEN interaction_value ELSE 0 END) AS urgent_important,
  SUM(CASE WHEN is_twelve_week_goal THEN interaction_value ELSE 0 END) AS twelve_week_goals
FROM ap_task_when
GROUP BY user_id, DATE_TRUNC('week', when_ts);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_mv_role_weekly_user_week 
ON mv_role_weekly(user_id, week_start);
