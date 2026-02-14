-- Add committed_task_ids JSONB column to daily-sparks
-- Stores the task IDs the user committed to during Morning Spark V2
-- Used to display "Today's Contract" on the dashboard
ALTER TABLE "0008-ap-daily-sparks"
ADD COLUMN IF NOT EXISTS committed_task_ids jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN "0008-ap-daily-sparks".committed_task_ids IS 'Array of task IDs the user committed to during Morning Spark. Used for Today''s Contract view.';
