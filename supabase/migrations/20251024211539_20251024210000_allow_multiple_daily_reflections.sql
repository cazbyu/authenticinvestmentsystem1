/*
  # Allow Multiple Daily Reflections

  1. Changes
    - Remove unique index constraint on daily reflections to allow multiple reflections per day
    - Users can now create unlimited reflections throughout the day

  2. Security
    - RLS policies remain unchanged - users can only access their own reflections
*/

-- Drop the unique index that prevents multiple daily reflections per user per day
DROP INDEX IF EXISTS idx_reflections_daily_unique;
