/*
  # Create Daily Sparks Table

  1. New Tables
    - `0008-ap-daily-sparks`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `spark_date` (date, unique per user per day)
      - `fuel_level` (integer, 1-3)
      - `mode` (text, "Recovery", "Steady", or "Sprint")
      - `initial_target_score` (integer, 20, 35, or 55)
      - `committed_at` (timestamptz)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `0008-ap-daily-sparks` table
    - Add policies for authenticated users to:
      - Read their own daily sparks
      - Insert their own daily sparks (one per day)
      - No updates or deletes allowed (commitment is final)

  3. Constraints
    - Unique constraint on (user_id, spark_date) to ensure one spark per day
    - Check constraints on fuel_level (1-3) and mode values
    - Check constraint on initial_target_score matching fuel_level
*/

-- Create daily sparks table
CREATE TABLE IF NOT EXISTS "0008-ap-daily-sparks" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  spark_date date NOT NULL,
  fuel_level integer NOT NULL CHECK (fuel_level >= 1 AND fuel_level <= 3),
  mode text NOT NULL CHECK (mode IN ('Recovery', 'Steady', 'Sprint')),
  initial_target_score integer NOT NULL CHECK (
    (fuel_level = 1 AND initial_target_score = 20) OR
    (fuel_level = 2 AND initial_target_score = 35) OR
    (fuel_level = 3 AND initial_target_score = 55)
  ),
  committed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),

  -- Ensure only one spark per user per day
  UNIQUE(user_id, spark_date)
);

-- Enable Row Level Security
ALTER TABLE "0008-ap-daily-sparks" ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own sparks
CREATE POLICY "Users can read own daily sparks"
  ON "0008-ap-daily-sparks"
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own sparks (once per day)
CREATE POLICY "Users can insert own daily spark"
  ON "0008-ap-daily-sparks"
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- No update or delete policies - sparks are final commitments

-- Create index for efficient date-based queries
CREATE INDEX IF NOT EXISTS idx_daily_sparks_user_date
  ON "0008-ap-daily-sparks"(user_id, spark_date DESC);

-- Create index for efficient user-based queries
CREATE INDEX IF NOT EXISTS idx_daily_sparks_user_id
  ON "0008-ap-daily-sparks"(user_id);