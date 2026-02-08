/*
  # Add Alignment Escort Features

  1. Modified Tables
    - `0008-ap-user-ritual-settings`
      - `guided_mode_enabled` (boolean, default true) - Enable/disable the Alignment Escort coaching layer

  2. New Tables
    - `0008-ap-week-plan-items`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `alignment_id` (uuid, references 0008-ap-weekly-alignments, nullable during ritual)
      - `item_type` (text, enum: 'task', 'event', 'idea')
      - `item_id` (uuid) - Foreign key to tasks/events/deposit_ideas
      - `title` (text) - Title of the item
      - `source_step` (integer, 1-5) - Which step created it
      - `source_context` (text) - e.g., "Role: Father" or "Wellness: Physical" or "Goal: Launch business"
      - `aligned_to` (text, nullable) - Which North Star element it connects to
      - `created_at` (timestamptz)
      - `is_committed` (boolean, default false) - Whether user committed to this in Step 5

  3. Security
    - Enable RLS on `0008-ap-week-plan-items` table
    - Add policies for authenticated users to manage their own week plan items

  4. Notes
    - guided_mode_enabled applies to all rituals but primarily affects Weekly Alignment
    - Week plan items are temporary during the ritual, then linked to alignment_id when completed
    - Items can be created, reviewed, and committed through the escort flow
*/

-- Add guided_mode_enabled to ritual settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '0008-ap-user-ritual-settings' AND column_name = 'guided_mode_enabled'
  ) THEN
    ALTER TABLE "0008-ap-user-ritual-settings" ADD COLUMN guided_mode_enabled BOOLEAN NOT NULL DEFAULT true;
  END IF;
END $$;

-- Create week plan items table
CREATE TABLE IF NOT EXISTS "0008-ap-week-plan-items" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alignment_id uuid REFERENCES "0008-ap-weekly-alignments"(id) ON DELETE CASCADE,
  item_type text NOT NULL CHECK (item_type IN ('task', 'event', 'idea')),
  item_id uuid,
  title text NOT NULL,
  source_step integer NOT NULL CHECK (source_step BETWEEN 1 AND 5),
  source_context text NOT NULL,
  aligned_to text,
  is_committed boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE "0008-ap-week-plan-items" ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own week plan items
CREATE POLICY "Users can read own week plan items"
  ON "0008-ap-week-plan-items"
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own week plan items
CREATE POLICY "Users can insert own week plan items"
  ON "0008-ap-week-plan-items"
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own week plan items
CREATE POLICY "Users can update own week plan items"
  ON "0008-ap-week-plan-items"
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own week plan items
CREATE POLICY "Users can delete own week plan items"
  ON "0008-ap-week-plan-items"
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_week_plan_items_user_id
  ON "0008-ap-week-plan-items"(user_id);

CREATE INDEX IF NOT EXISTS idx_week_plan_items_alignment_id
  ON "0008-ap-week-plan-items"(alignment_id);

CREATE INDEX IF NOT EXISTS idx_week_plan_items_user_alignment
  ON "0008-ap-week-plan-items"(user_id, alignment_id);

-- Set default guided_mode_enabled for all existing ritual settings
UPDATE "0008-ap-user-ritual-settings"
SET guided_mode_enabled = true
WHERE guided_mode_enabled IS NULL;