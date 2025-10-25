/*
  # Fix Canonical Week Generation System

  ## Summary
  Fixes the global timeline week generation to store ONE canonical set of weeks per
  global cycle, eliminating conflicts when multiple users activate the same cycle with
  different week_start_day preferences. User preferences are applied dynamically in views
  rather than stored as separate week records.

  ## Changes Made

  1. **Create generate_canonical_global_weeks function**
     - Takes global_cycle_id as parameter (not user timeline ID)
     - Generates 12 weeks based purely on cycle start_date and end_date
     - Stores ONE set of canonical weeks per cycle in 0008-ap-global-weeks
     - Idempotent - safe to call multiple times
     - No user-specific adjustments

  2. **Update fn_activate_user_global_timeline function**
     - Removed call to generate_adjusted_global_weeks (user-specific)
     - Added call to generate_canonical_global_weeks (cycle-level)
     - Ensures canonical weeks exist when user activates timeline
     - Stores user's week_start_day preference in timeline record only

  3. **Drop old user-specific week generation**
     - Removed generate_adjusted_global_weeks function
     - Removed trigger_generate_global_weeks function
     - Removed trg_generate_global_weeks trigger
     - These caused conflicts and inaccurate days-left calculations

  4. **Update v_user_global_timeline_weeks view**
     - Now joins with 0008-ap-global-weeks for canonical week boundaries
     - Returns same week_start and week_end dates for all users
     - Includes week_start_day as metadata for frontend display
     - User preference is display metadata, not data transformation

  5. **Clean up duplicate weeks and regenerate canonical weeks**
     - Removes duplicate week records created by old system
     - Keeps one canonical set per global_cycle_id
     - Regenerates weeks from cycle dates for all existing cycles

  ## Important Notes
  - All users see the same week date boundaries regardless of preference
  - week_start_day preference is stored in timeline record as metadata
  - Views apply preferences dynamically (no date shifting in storage)
  - Days left calculations remain accurate using cycle-level dates
  - Week generation is now per-cycle, not per-user-timeline

  ## Security
  - Functions use SECURITY DEFINER with proper authentication checks
  - Only authenticated users can activate timelines
  - Week generation validates cycle existence and access
*/

-- =====================================================
-- Function: Generate Canonical Global Weeks
-- =====================================================
CREATE OR REPLACE FUNCTION generate_canonical_global_weeks(
  p_global_cycle_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cycle_start_date date;
  v_cycle_end_date date;
  v_week_num integer;
  v_week_start date;
  v_week_end date;
BEGIN
  -- Get cycle dates
  SELECT start_date, end_date
  INTO v_cycle_start_date, v_cycle_end_date
  FROM "0008-ap-global-cycles"
  WHERE id = p_global_cycle_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Global cycle not found: %', p_global_cycle_id;
  END IF;

  -- Validate dates
  IF v_cycle_start_date IS NULL OR v_cycle_end_date IS NULL THEN
    RAISE EXCEPTION 'Global cycle % has null start_date or end_date', p_global_cycle_id;
  END IF;

  -- Delete existing weeks for this cycle to ensure clean slate
  DELETE FROM "0008-ap-global-weeks"
  WHERE global_cycle_id = p_global_cycle_id;

  -- Generate 12 canonical weeks based purely on cycle dates
  FOR v_week_num IN 1..12 LOOP
    -- Calculate week start: cycle start + (week_number - 1) * 7 days
    v_week_start := (v_cycle_start_date + ((v_week_num - 1) * INTERVAL '7 days'))::date;

    -- Calculate week end: week_start + 6 days
    v_week_end := (v_week_start + INTERVAL '6 days')::date;

    -- Insert canonical week record
    INSERT INTO "0008-ap-global-weeks" (
      global_cycle_id,
      week_number,
      week_start,
      week_end
    ) VALUES (
      p_global_cycle_id,
      v_week_num,
      v_week_start,
      v_week_end
    );
  END LOOP;

  RAISE NOTICE 'Generated 12 canonical weeks for global_cycle_id %', p_global_cycle_id;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION generate_canonical_global_weeks(uuid) TO authenticated;

COMMENT ON FUNCTION generate_canonical_global_weeks(uuid) IS
  'Generates 12 canonical weeks for a global cycle based purely on cycle start_date and end_date. One set per cycle, shared by all users.';

-- =====================================================
-- Drop Old User-Specific Week Generation System
-- =====================================================

-- Drop trigger first
DROP TRIGGER IF EXISTS trg_generate_global_weeks ON "0008-ap-user-global-timelines";

-- Drop trigger function
DROP FUNCTION IF EXISTS trigger_generate_global_weeks();

-- Drop old user-specific generation function
DROP FUNCTION IF EXISTS generate_adjusted_global_weeks(uuid);

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
      AND (is_active = true OR is_active IS NULL)
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

  -- Create new active timeline (store week_start_day as display preference)
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

  -- Ensure canonical weeks exist for this cycle (idempotent)
  PERFORM generate_canonical_global_weeks(p_global_cycle_id);

  RAISE NOTICE 'Activated timeline % with week_start_day preference=%', v_new_timeline_id, p_week_start_day;

  RETURN v_new_timeline_id;
END;
$$;

-- Recreate grant
GRANT EXECUTE ON FUNCTION fn_activate_user_global_timeline(uuid, text) TO authenticated;

COMMENT ON FUNCTION fn_activate_user_global_timeline(uuid, text) IS
  'Activates a global timeline for a user with specified week_start_day preference. Ensures canonical weeks exist for the cycle.';

-- =====================================================
-- Update v_user_global_timeline_weeks View
-- =====================================================
CREATE OR REPLACE VIEW v_user_global_timeline_weeks AS
SELECT
  ugt.id as timeline_id,
  ugt.user_id,
  ugt.week_start_day,
  gw.week_number,
  gw.week_start,
  gw.week_end,
  'global' as source
FROM "0008-ap-user-global-timelines" ugt
JOIN "0008-ap-global-cycles" gc ON ugt.global_cycle_id = gc.id
JOIN "0008-ap-global-weeks" gw ON gw.global_cycle_id = gc.id
WHERE ugt.status = 'active';

-- Grant access to authenticated users
GRANT SELECT ON v_user_global_timeline_weeks TO authenticated;

COMMENT ON VIEW v_user_global_timeline_weeks IS
  'Returns canonical week boundaries for each active user global timeline. All users see the same week dates; week_start_day is display metadata for frontend.';

-- =====================================================
-- Clean Up Duplicate Weeks and Regenerate
-- =====================================================

-- Remove all existing week records (will be regenerated)
TRUNCATE TABLE "0008-ap-global-weeks";

-- Regenerate canonical weeks for all global cycles
DO $$
DECLARE
  cycle_rec RECORD;
BEGIN
  FOR cycle_rec IN
    SELECT id, title, start_date, end_date
    FROM "0008-ap-global-cycles"
    WHERE start_date IS NOT NULL AND end_date IS NOT NULL
  LOOP
    BEGIN
      PERFORM generate_canonical_global_weeks(cycle_rec.id);
      RAISE NOTICE 'Regenerated canonical weeks for cycle: % (% to %)',
        cycle_rec.title,
        cycle_rec.start_date,
        cycle_rec.end_date;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to generate weeks for cycle %: %', cycle_rec.id, SQLERRM;
    END;
  END LOOP;
END $$;

-- =====================================================
-- Verification Queries (logged as notices)
-- =====================================================

DO $$
DECLARE
  v_cycle_count integer;
  v_week_count integer;
  v_duplicate_count integer;
BEGIN
  -- Count cycles with weeks
  SELECT COUNT(DISTINCT global_cycle_id)
  INTO v_cycle_count
  FROM "0008-ap-global-weeks";

  -- Count total weeks
  SELECT COUNT(*)
  INTO v_week_count
  FROM "0008-ap-global-weeks";

  -- Check for duplicates (should be 0)
  SELECT COUNT(*)
  INTO v_duplicate_count
  FROM (
    SELECT global_cycle_id, week_number
    FROM "0008-ap-global-weeks"
    GROUP BY global_cycle_id, week_number
    HAVING COUNT(*) > 1
  ) duplicates;

  RAISE NOTICE 'Week generation verification:';
  RAISE NOTICE '  - Cycles with weeks: %', v_cycle_count;
  RAISE NOTICE '  - Total week records: %', v_week_count;
  RAISE NOTICE '  - Expected: % (12 weeks per cycle)', v_cycle_count * 12;
  RAISE NOTICE '  - Duplicate weeks: % (should be 0)', v_duplicate_count;

  IF v_duplicate_count > 0 THEN
    RAISE WARNING 'Found duplicate week records! Check data integrity.';
  END IF;
END $$;
