-- Add one_thing boolean to 0008-ap-tasks
-- Indicates this task is the user's "One Thing" focus for the day
ALTER TABLE "0008-ap-tasks"
ADD COLUMN IF NOT EXISTS one_thing boolean DEFAULT false;
