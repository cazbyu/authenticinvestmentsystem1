/*
  # Add Evening Review Hybrid Architecture Columns

  1. Schema Changes
    - Add columns to `0008-ap-daily-reviews` table:
      - `rose_reflection_id` (uuid, references 0008-ap-reflections)
      - `thorn_reflection_id` (uuid, references 0008-ap-reflections)
      - `brain_dump_reflection_id` (uuid, references 0008-ap-reflections)
      - `final_score` (numeric, user's actual score for the day)
      - `target_score` (numeric, user's target from Morning Spark)
      - `dominant_cardinal` (text, which compass direction dominated: north/east/west/south)
      - `is_win` (boolean, whether user met or exceeded their target)

  2. RPC Function
    - Create `create_evening_review()` function to handle the full transaction:
      - Creates rose, thorn, and brain_dump reflections in 0008-ap-reflections
      - Creates daily review record with foreign keys to reflections
      - Calculates is_win based on final_score vs target_score
      - All in one atomic transaction

  3. Security
    - RLS policies already exist from previous migration
    - Foreign key constraints ensure data integrity
*/

-- Add new columns to daily reviews table
ALTER TABLE "0008-ap-daily-reviews"
  ADD COLUMN IF NOT EXISTS rose_reflection_id uuid REFERENCES "0008-ap-reflections"(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS thorn_reflection_id uuid REFERENCES "0008-ap-reflections"(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS brain_dump_reflection_id uuid REFERENCES "0008-ap-reflections"(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS final_score numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS target_score numeric DEFAULT 35,
  ADD COLUMN IF NOT EXISTS dominant_cardinal text CHECK (dominant_cardinal IN ('north', 'east', 'west', 'south')),
  ADD COLUMN IF NOT EXISTS is_win boolean DEFAULT false;

-- Create RPC function for creating evening review in one transaction
CREATE OR REPLACE FUNCTION create_evening_review(
  p_user_id uuid,
  p_review_date date,
  p_rose_content text,
  p_thorn_content text,
  p_brain_dump_content text,
  p_final_score numeric,
  p_target_score numeric,
  p_dominant_cardinal text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rose_id uuid;
  v_thorn_id uuid;
  v_brain_dump_id uuid;
  v_review_id uuid;
  v_is_win boolean;
BEGIN
  -- Check if user owns this request
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Calculate is_win
  v_is_win := p_final_score >= p_target_score;

  -- Create rose reflection if content provided
  IF p_rose_content IS NOT NULL AND LENGTH(TRIM(p_rose_content)) > 0 THEN
    INSERT INTO "0008-ap-reflections" (
      user_id,
      reflection_type,
      parent_type,
      content,
      reflection_date
    ) VALUES (
      p_user_id,
      'daily',
      'rose',
      p_rose_content,
      p_review_date
    )
    RETURNING id INTO v_rose_id;
  END IF;

  -- Create thorn reflection if content provided
  IF p_thorn_content IS NOT NULL AND LENGTH(TRIM(p_thorn_content)) > 0 THEN
    INSERT INTO "0008-ap-reflections" (
      user_id,
      reflection_type,
      parent_type,
      content,
      reflection_date
    ) VALUES (
      p_user_id,
      'daily',
      'thorn',
      p_thorn_content,
      p_review_date
    )
    RETURNING id INTO v_thorn_id;
  END IF;

  -- Create brain dump reflection if content provided
  IF p_brain_dump_content IS NOT NULL AND LENGTH(TRIM(p_brain_dump_content)) > 0 THEN
    INSERT INTO "0008-ap-reflections" (
      user_id,
      reflection_type,
      parent_type,
      content,
      reflection_date
    ) VALUES (
      p_user_id,
      'daily',
      'brain_dump',
      p_brain_dump_content,
      p_review_date
    )
    RETURNING id INTO v_brain_dump_id;
  END IF;

  -- Create daily review record with all metadata
  INSERT INTO "0008-ap-daily-reviews" (
    user_id,
    review_date,
    rose_reflection_id,
    thorn_reflection_id,
    brain_dump_reflection_id,
    final_score,
    target_score,
    dominant_cardinal,
    is_win
  ) VALUES (
    p_user_id,
    p_review_date,
    v_rose_id,
    v_thorn_id,
    v_brain_dump_id,
    p_final_score,
    p_target_score,
    p_dominant_cardinal,
    v_is_win
  )
  ON CONFLICT (user_id, review_date)
  DO UPDATE SET
    rose_reflection_id = EXCLUDED.rose_reflection_id,
    thorn_reflection_id = EXCLUDED.thorn_reflection_id,
    brain_dump_reflection_id = EXCLUDED.brain_dump_reflection_id,
    final_score = EXCLUDED.final_score,
    target_score = EXCLUDED.target_score,
    dominant_cardinal = EXCLUDED.dominant_cardinal,
    is_win = EXCLUDED.is_win
  RETURNING id INTO v_review_id;

  RETURN v_review_id;
END;
$$;

-- Drop and recreate view for complete daily reviews with reflection content
DROP VIEW IF EXISTS "v-daily-reviews-complete";

CREATE VIEW "v-daily-reviews-complete" AS
SELECT
  dr.id,
  dr.user_id,
  dr.review_date,
  dr.final_score,
  dr.target_score,
  dr.dominant_cardinal,
  dr.is_win,
  dr.created_at,
  rose.content as rose_content,
  thorn.content as thorn_content,
  brain_dump.content as brain_dump_content
FROM "0008-ap-daily-reviews" dr
LEFT JOIN "0008-ap-reflections" rose ON dr.rose_reflection_id = rose.id
LEFT JOIN "0008-ap-reflections" thorn ON dr.thorn_reflection_id = thorn.id
LEFT JOIN "0008-ap-reflections" brain_dump ON dr.brain_dump_reflection_id = brain_dump.id;