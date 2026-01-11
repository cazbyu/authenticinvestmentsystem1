/*
  # Create Daily Reviews Table

  1. New Tables
    - `0008-ap-daily-reviews`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `review_date` (date, unique per user per day)
      - `content` (text, review content)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `0008-ap-daily-reviews` table
    - Add policies for authenticated users to:
      - Read their own daily reviews
      - Insert their own daily reviews (one per day)
      - Update their own daily reviews
      - Delete their own daily reviews

  3. Constraints
    - Unique constraint on (user_id, review_date) to ensure one review per day
*/

-- Create daily reviews table
CREATE TABLE IF NOT EXISTS "0008-ap-daily-reviews" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  review_date date NOT NULL,
  content text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- Ensure only one review per user per day
  UNIQUE(user_id, review_date)
);

-- Enable Row Level Security
ALTER TABLE "0008-ap-daily-reviews" ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own reviews
CREATE POLICY "Users can read own daily reviews"
  ON "0008-ap-daily-reviews"
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own reviews
CREATE POLICY "Users can insert own daily review"
  ON "0008-ap-daily-reviews"
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own reviews
CREATE POLICY "Users can update own daily reviews"
  ON "0008-ap-daily-reviews"
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own reviews
CREATE POLICY "Users can delete own daily reviews"
  ON "0008-ap-daily-reviews"
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_daily_reviews_user_date
  ON "0008-ap-daily-reviews"(user_id, review_date DESC);

CREATE INDEX IF NOT EXISTS idx_daily_reviews_user_id
  ON "0008-ap-daily-reviews"(user_id);

-- Create trigger function for auto-updating timestamps
CREATE OR REPLACE FUNCTION update_daily_reviews_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply the trigger
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'update_daily_reviews_updated_at_trigger'
    ) THEN
        CREATE TRIGGER update_daily_reviews_updated_at_trigger
          BEFORE UPDATE ON "0008-ap-daily-reviews"
          FOR EACH ROW
          EXECUTE FUNCTION update_daily_reviews_updated_at();
    END IF;
END $$;