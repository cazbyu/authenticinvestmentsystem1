-- ===========================================================
-- Migration: 20251013160000_corrected_canonical_functions.sql
-- Purpose : Fix conflicting functions with proper column names,
--           return types, and validation logic
-- Author  : Africa Thryves (Authentic Planning System)
-- Date    : 2025-10-13 16:00:00
-- 
-- This migration supersedes the previous attempt and fixes:
-- 1. Column name mismatch (start_date/end_date -> week_start/week_end)
-- 2. Incorrect date calculation (uses cycle dates, not current_date)
-- 3. Wrong return types (void and uuid, not jsonb)
-- 4. Missing snapshot column population
-- 5. Missing v_global_cycles validation
-- ===========================================================

-- ============================================================
-- PRE-MIGRATION VERIFICATION
-- ============================================================
DO $$
DECLARE
  v_function_count int;
  v_view_exists boolean;
BEGIN
  -- Check current state
  SELECT COUNT(*) INTO v_function_count
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public' 
    AND p.proname IN ('generate_canonical_global_weeks', 'generate_adjusted_global_weeks', 'fn_activate_user_global_timeline');
  
  SELECT EXISTS(
    SELECT 1 FROM information_schema.views 
    WHERE table_schema = 'public' AND table_name = 'v_global_cycles'
  ) INTO v_view_exists;
  
  RAISE NOTICE '====== PRE-MIGRATION STATE ======';
  RAISE NOTICE 'Functions found: %', v_function_count;
  RAISE NOTICE 'v_global_cycles view exists: %', v_view_exists;
  RAISE NOTICE '=================================';
END $$;

-- ============================================================
-- 1. DROP ALL CONFLICTING FUNCTIONS
-- ============================================================
DROP FUNCTION IF EXISTS public.generate_adjusted_global_weeks(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.generate_canonical_global_weeks(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.fn_activate_user_global_timeline(uuid, text) CASCADE;
DROP FUNCTION IF EXISTS public.fn_activate_user_global_timeline(uuid) CASCADE;

-- ============================================================
-- 2. CREATE CANONICAL WEEK GENERATOR (CORRECTED)
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_canonical_global_weeks(
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
  -- Fetch the actual cycle dates from the global cycles table
  SELECT start_date, end_date
  INTO v_cycle_start_date, v_cycle_end_date
  FROM "0008-ap-global-cycles"
  WHERE id = p_global_cycle_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Global cycle not found: %', p_global_cycle_id;
  END IF;

  -- Validate that dates exist
  IF v_cycle_start_date IS NULL OR v_cycle_end_date IS NULL THEN
    RAISE EXCEPTION 'Global cycle % has null start_date or end_date', p_global_cycle_id;
  END IF;

  -- Delete existing weeks for this cycle to ensure clean slate
  DELETE FROM "0008-ap-global-weeks"
  WHERE global_cycle_id = p_global_cycle_id;

  -- Generate 12 canonical weeks based on cycle dates
  FOR v_week_num IN 1..12 LOOP
    -- Calculate week start: cycle start + (week_number - 1) * 7 days
    v_week_start := (v_cycle_start_date + ((v_week_num - 1) * INTERVAL '7 days'))::date;
    
    -- Calculate week end: week_start + 6 days
    v_week_end := (v_week_start + INTERVAL '6 days')::date;

    -- Insert canonical week record with CORRECT column names
    INSERT INTO "0008-ap-global-weeks" (
      global_cycle_id,
      week_number,
      week_start,  -- NOT start_date
      week_end     -- NOT end_date
    ) VALUES (
      p_global_cycle_id,
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

  RAISE NOTICE 'Generated 12 canonical weeks for global_cycle_id %', p_global_cycle_id;
END;
$$;

COMMENT ON FUNCTION public.generate_canonical_global_weeks(uuid) IS
  'Generates 12 canonical weeks for a global cycle based on cycle start_date and end_date. Uses week_start/week_end columns. Idempotent.';

-- ============================================================
-- 3. CREATE ACTIVATION FUNCTION (CORRECTED & ENHANCED)
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_activate_user_global_timeline(
  p_global_cycle_id uuid,
  p_week_start_day text DEFAULT NULL
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
  v_user_preference text;
  v_final_preference text;
  v_can_activate boolean;
  v_cycle_title text;
  v_cycle_start_date date;
  v_cycle_end_date date;
  v_view_exists boolean;
  v_has_snapshot_columns boolean;
  v_has_user_preference_column boolean;
BEGIN
  -- Get authenticated user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Check if v_global_cycles view exists
  SELECT EXISTS(
    SELECT 1 FROM information_schema.views 
    WHERE table_schema = 'public' AND table_name = 'v_global_cycles'
  ) INTO v_view_exists;

  -- Check if snapshot columns exist
  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '0008-ap-user-global-timelines' 
      AND column_name IN ('title', 'start_date', 'end_date')
    GROUP BY table_name
    HAVING COUNT(*) = 3
  ) INTO v_has_snapshot_columns;

  -- Check if user preference column exists
  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '0008-ap-users' AND column_name = 'week_start_day'
  ) INTO v_has_user_preference_column;

  -- Get user's stored preference if column exists
  IF v_has_user_preference_column THEN
    SELECT week_start_day INTO v_user_preference
    FROM "0008-ap-users"
    WHERE id = v_user_id;
  END IF;

  -- Use provided preference or fall back to user's stored preference or default
  v_final_preference := COALESCE(p_week_start_day, v_user_preference, 'sunday');

  -- Validate week_start_day
  IF v_final_preference NOT IN ('sunday', 'monday') THEN
    RAISE EXCEPTION 'Invalid week_start_day. Must be sunday or monday';
  END IF;

  -- Fetch cycle data
  SELECT 
    title,
    start_date,
    end_date
  INTO 
    v_cycle_title,
    v_cycle_start_date,
    v_cycle_end_date
  FROM "0008-ap-global-cycles"
  WHERE id = p_global_cycle_id
    AND (status = 'active' OR status IS NULL);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Global cycle not found or not active';
  END IF;

  v_cycle_exists := true;

  -- Check can_activate from view if it exists
  IF v_view_exists THEN
    SELECT COALESCE(can_activate, false)
    INTO v_can_activate
    FROM v_global_cycles
    WHERE global_cycle_id = p_global_cycle_id;
    
    IF NOT v_can_activate THEN
      RAISE EXCEPTION 'This global cycle cannot be activated yet. Only the current cycle and the next cycle (during reflection window) can be activated.';
    END IF;
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

  -- Save preference to user's profile if column exists and preference differs
  IF v_has_user_preference_column AND p_week_start_day IS NOT NULL AND p_week_start_day != v_user_preference THEN
    UPDATE "0008-ap-users"
    SET week_start_day = v_final_preference
    WHERE id = v_user_id;

    RAISE NOTICE 'Updated user preference to: %', v_final_preference;
  END IF;

  -- Create new active timeline with conditional snapshot data
  IF v_has_snapshot_columns THEN
    INSERT INTO "0008-ap-user-global-timelines" (
      user_id,
      global_cycle_id,
      status,
      week_start_day,
      activated_at,
      title,
      start_date,
      end_date
    ) VALUES (
      v_user_id,
      p_global_cycle_id,
      'active',
      v_final_preference,
      now(),
      v_cycle_title,
      v_cycle_start_date,
      v_cycle_end_date
    )
    RETURNING id INTO v_new_timeline_id;
  ELSE
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
      v_final_preference,
      now()
    )
    RETURNING id INTO v_new_timeline_id;
  END IF;

  -- Generate canonical weeks
  PERFORM generate_canonical_global_weeks(p_global_cycle_id);

  RAISE NOTICE 'Activated timeline % with week_start_day=%', v_new_timeline_id, v_final_preference;

  RETURN v_new_timeline_id;
END;
$$;

COMMENT ON FUNCTION public.fn_activate_user_global_timeline(uuid, text) IS
  'Activates a global timeline for a user. Reads week_start_day preference from user profile or accepts override. Validates can_activate if v_global_cycles exists. Populates snapshot columns if they exist. Returns timeline UUID.';

-- ============================================================
-- 4. GRANT PERMISSIONS
-- ============================================================
GRANT EXECUTE ON FUNCTION public.generate_canonical_global_weeks(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_canonical_global_weeks(uuid) TO service_role;

GRANT EXECUTE ON FUNCTION public.fn_activate_user_global_timeline(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_activate_user_global_timeline(uuid, text) TO service_role;

-- ============================================================
-- 5. REGENERATE CANONICAL WEEKS FOR ALL CYCLES
-- ============================================================
DO $$
DECLARE
  cycle_rec RECORD;
  success_count int := 0;
  error_count int := 0;
BEGIN
  RAISE NOTICE '====== REGENERATING CANONICAL WEEKS ======';
  
  FOR cycle_rec IN
    SELECT id, title, start_date, end_date
    FROM "0008-ap-global-cycles"
    WHERE start_date IS NOT NULL AND end_date IS NOT NULL
    ORDER BY start_date
  LOOP
    BEGIN
      PERFORM generate_canonical_global_weeks(cycle_rec.id);
      success_count := success_count + 1;
      RAISE NOTICE 'SUCCESS: % (% to %)', 
        cycle_rec.title, cycle_rec.start_date, cycle_rec.end_date;
    EXCEPTION WHEN OTHERS THEN
      error_count := error_count + 1;
      RAISE WARNING 'FAILED: % - %', cycle_rec.title, SQLERRM;
    END;
  END LOOP;
  
  RAISE NOTICE '==========================================';
  RAISE NOTICE 'Regeneration complete: % success, % errors', success_count, error_count;
END $$;

-- ============================================================
-- POST-MIGRATION VERIFICATION
-- ============================================================
DO $$
DECLARE
  v_cycle_count integer;
  v_week_count integer;
  v_duplicate_count integer;
  v_function_count integer;
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

  -- Count functions
  SELECT COUNT(*) INTO v_function_count
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public' 
    AND p.proname IN ('generate_canonical_global_weeks', 'fn_activate_user_global_timeline');

  RAISE NOTICE '====== POST-MIGRATION VERIFICATION ======';
  RAISE NOTICE 'Functions created: % (expected: 2)', v_function_count;
  RAISE NOTICE 'Cycles with weeks: %', v_cycle_count;
  RAISE NOTICE 'Total week records: %', v_week_count;
  RAISE NOTICE 'Expected weeks: % (12 per cycle)', v_cycle_count * 12;
  RAISE NOTICE 'Duplicate weeks: % (should be 0)', v_duplicate_count;
  RAISE NOTICE '=========================================';

  IF v_duplicate_count > 0 THEN
    RAISE WARNING 'Found duplicate week records! Check data integrity.';
  END IF;
  
  IF v_function_count != 2 THEN
    RAISE WARNING 'Expected 2 functions but found %', v_function_count;
  END IF;
END $$;

-- ===========================================================
-- ✅ MIGRATION SUCCESS CRITERIA
-- - generate_adjusted_global_weeks() is removed
-- - generate_canonical_global_weeks() returns void
-- - fn_activate_user_global_timeline() returns uuid
-- - Correct column names: week_start/week_end (not start_date/end_date)
-- - Uses cycle dates (not current_date)
-- - Validates can_activate if v_global_cycles exists
-- - Populates snapshot columns if they exist
-- - Reads user preference if column exists
-- - No hardcoded test user IDs
-- ===========================================================
