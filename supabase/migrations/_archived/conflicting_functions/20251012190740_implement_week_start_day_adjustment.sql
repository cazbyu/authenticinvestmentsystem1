/*
  # Implement Week Start Day Adjustment for Global Timelines

  ## Summary
  When users activate a global timeline and select "Monday" as their week start day,
  all week boundaries (start_date and end_date) should be adjusted by adding 1 day.
  This ensures that Week 1 starts on a Monday instead of the original cycle start date.

  ## Changes Made

  1. **Create generate_adjusted_global_weeks function**
     - Reads global_cycle start_date and end_date
     - Applies +1 day offset when week_start_day is 'monday'
     - Populates 0008-ap-global-weeks table with adjusted dates
     - Handles both Sunday (no offset) and Monday (+1 day offset) preferences

  2. **Update fn_activate_user_global_timeline function**
     - Calls generate_adjusted_global_weeks after creating the timeline record
     - Ensures weeks are pre-calculated based on user's week_start_day preference
     - Provides immediate week data for the frontend

  3. **Add trigger for automatic week generation**
     - Automatically generates weeks when new timeline is activated
     - Ensures consistency between timeline creation and week availability

  ## Important Notes
  - Sunday preference: uses original cycle dates (no adjustment)
  - Monday preference: adds 1 day to all week start and end dates
  - All 12 weeks are shifted consistently when Monday is selected
  - Existing week records are replaced if timeline is reactivated

  ## Security
  - Functions use SECURITY DEFINER with proper authentication checks
  - Only authenticated users can generate weeks for their timelines
*/

-- =====================================================
-- Function: Generate Adjusted Global Weeks
-- =====================================================
CREATE OR REPLACE FUNCTION generate_adjusted_global_weeks(
  p_user_global_timeline_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_global_cycle_id uuid;
  v_week_start_day text;
  v_cycle_start_date date;
  v_cycle_end_date date;
  v_day_offset interval;
  v_week_num integer;
  v_week_start date;
  v_week_end date;
BEGIN
  -- Get authenticated user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Get timeline details
  SELECT
    ugt.global_cycle_id,
    ugt.week_start_day,
    gc.start_date,
    gc.end_date
  INTO
    v_global_cycle_id,
    v_week_start_day,
    v_cycle_start_date,
    v_cycle_end_date
  FROM "0008-ap-user-global-timelines" ugt
  JOIN "0008-ap-global-cycles" gc ON ugt.global_cycle_id = gc.id
  WHERE ugt.id = p_user_global_timeline_id
    AND ugt.user_id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Timeline not found or access denied';
  END IF;

  -- Calculate day offset based on week_start_day preference
  -- Sunday: no offset (0 days)
  -- Monday: add 1 day to shift the entire timeline forward
  IF v_week_start_day = 'monday' THEN
    v_day_offset := INTERVAL '1 day';
  ELSE
    v_day_offset := INTERVAL '0 days';
  END IF;

  -- Delete existing weeks for this cycle to avoid duplicates
  DELETE FROM "0008-ap-global-weeks"
  WHERE global_cycle_id = v_global_cycle_id;

  -- Generate 12 weeks with adjusted dates
  FOR v_week_num IN 1..12 LOOP
    -- Calculate week start: cycle start + (week_number - 1) * 7 days + offset
    v_week_start := (v_cycle_start_date + ((v_week_num - 1) * INTERVAL '7 days') + v_day_offset)::date;

    -- Calculate week end: week_start + 6 days
    v_week_end := (v_week_start + INTERVAL '6 days')::date;

    -- Insert week record
    INSERT INTO "0008-ap-global-weeks" (
      global_cycle_id,
      week_number,
      week_start,
      week_end
    ) VALUES (
      v_global_cycle_id,
      v_week_num,
      v_week_start,
      v_week_end
    )
    ON CONFLICT (global_cycle_id, week_number)
    DO UPDATE SET
      week_start = EXCLUDED.week_start,
      week_end = EXCLUDED.week_end,
      updated_at = now();
  END LOOP;

  RAISE NOTICE 'Generated 12 weeks for global_cycle_id % with % offset',
    v_global_cycle_id,
    CASE WHEN v_week_start_day = 'monday' THEN '+1 day' ELSE 'no' END;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION generate_adjusted_global_weeks(uuid) TO authenticated;

-- =====================================================
-- Update fn_activate_user_global_timeline Function
-- =====================================================
CREATE OR REPLACE FUNCTION fn_activate_user_global_timeline(
  p_global_cycle_id uuid,
  p_week_start_day text DEFAULT 'sunday'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_new_timeline_id uuid;
  v_existing_timeline_id uuid;
  v_cycle_exists boolean;
BEGIN
  -- Get authenticated user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Validate week_start_day
  IF p_week_start_day NOT IN ('sunday', 'monday') THEN
    RAISE EXCEPTION 'Invalid week_start_day. Must be sunday or monday';
  END IF;

  -- Verify global cycle exists and is active
  SELECT EXISTS(
    SELECT 1 FROM "0008-ap-global-cycles"
    WHERE id = p_global_cycle_id
      AND (status = 'active' OR status IS NULL)
  ) INTO v_cycle_exists;

  IF NOT v_cycle_exists THEN
    RAISE EXCEPTION 'Global cycle not found or not active';
  END IF;

  -- Check if user already has this exact cycle activated
  SELECT id INTO v_existing_timeline_id
  FROM "0008-ap-user-global-timelines"
  WHERE user_id = v_user_id
    AND global_cycle_id = p_global_cycle_id
    AND status = 'active';

  IF FOUND THEN
    RAISE EXCEPTION 'This global cycle is already activated';
  END IF;

  -- Create new active timeline (normalized: only store references)
  INSERT INTO "0008-ap-user-global-timelines" (
    user_id,
    global_cycle_id,
    status,
    week_start_day,
    activated_at
  ) VALUES (
    v_user_id,
    p_global_cycle_id,
    'active',
    p_week_start_day,
    now()
  )
  RETURNING id INTO v_new_timeline_id;

  -- Generate adjusted weeks based on the user's week_start_day preference
  PERFORM generate_adjusted_global_weeks(v_new_timeline_id);

  RAISE NOTICE 'Activated timeline % with week_start_day=%', v_new_timeline_id, p_week_start_day;

  RETURN v_new_timeline_id;
END;
$$;

-- Recreate grant (in case it was dropped)
GRANT EXECUTE ON FUNCTION fn_activate_user_global_timeline(uuid, text) TO authenticated;

-- =====================================================
-- Create Trigger for Automatic Week Generation
-- =====================================================

-- Trigger function to generate weeks when timeline is activated
CREATE OR REPLACE FUNCTION trigger_generate_global_weeks()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only generate weeks for new active timelines
  IF (TG_OP = 'INSERT' AND NEW.status = 'active') OR
     (TG_OP = 'UPDATE' AND OLD.status != 'active' AND NEW.status = 'active') THEN
    PERFORM generate_adjusted_global_weeks(NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger if it doesn't exist
DROP TRIGGER IF EXISTS trg_generate_global_weeks ON "0008-ap-user-global-timelines";

CREATE TRIGGER trg_generate_global_weeks
  AFTER INSERT OR UPDATE OF status ON "0008-ap-user-global-timelines"
  FOR EACH ROW
  EXECUTE FUNCTION trigger_generate_global_weeks();

-- =====================================================
-- Backfill Existing Timelines
-- =====================================================

-- Regenerate weeks for all existing active timelines with correct offsets
DO $$
DECLARE
  timeline_rec RECORD;
BEGIN
  FOR timeline_rec IN
    SELECT id, week_start_day
    FROM "0008-ap-user-global-timelines"
    WHERE status = 'active'
  LOOP
    BEGIN
      PERFORM generate_adjusted_global_weeks(timeline_rec.id);
      RAISE NOTICE 'Regenerated weeks for timeline % with week_start_day=%',
        timeline_rec.id,
        timeline_rec.week_start_day;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to generate weeks for timeline %: %', timeline_rec.id, SQLERRM;
    END;
  END LOOP;
END $$;

-- =====================================================
-- Add Helpful Comments
-- =====================================================

COMMENT ON FUNCTION generate_adjusted_global_weeks(uuid) IS
  'Generates 12 weeks for a global timeline with dates adjusted based on week_start_day preference. Monday adds +1 day offset to all week boundaries.';

COMMENT ON FUNCTION trigger_generate_global_weeks() IS
  'Automatically generates adjusted weeks when a timeline is activated or reactivated.';

COMMENT ON TRIGGER trg_generate_global_weeks ON "0008-ap-user-global-timelines" IS
  'Ensures weeks are generated immediately when timeline status becomes active.';
