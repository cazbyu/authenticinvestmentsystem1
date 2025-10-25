/*
  ============================================================================
  FINAL FIX FOR TIMELINE ACTIVATION
  ============================================================================
  
  Based on diagnosis:
  - activated_at column EXISTS in user_global_timelines ✓
  - All required columns exist ✓
  - Issue: Function is checking global_cycles.status which might not exist
  - Issue: Function might have wrong logic for checking active cycles
  
  This script:
  1. Adds status column to global_cycles if missing
  2. Recreates activation function with correct logic
  3. Tests the function
  ============================================================================
*/

-- =====================================================
-- STEP 1: Add status column to global_cycles if missing
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '0008-ap-global-cycles'
    AND column_name = 'status'
  ) THEN
    ALTER TABLE "0008-ap-global-cycles"
    ADD COLUMN status text DEFAULT 'active';
    
    -- Set status based on is_active
    UPDATE "0008-ap-global-cycles"
    SET status = CASE 
      WHEN is_active = true THEN 'active' 
      ELSE 'inactive' 
    END;
    
    RAISE NOTICE 'Added status column to global_cycles';
  ELSE
    RAISE NOTICE 'status column already exists in global_cycles';
  END IF;
END $$;

-- =====================================================
-- STEP 2: Recreate activation function with correct logic
-- =====================================================
DROP FUNCTION IF EXISTS fn_activate_user_global_timeline(uuid, text);

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
  v_cycle_record RECORD;
BEGIN
  -- Get authenticated user
  v_user_id := auth.uid();
  
  RAISE NOTICE 'Activation attempt - User ID: %', v_user_id;
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Validate week_start_day
  IF p_week_start_day NOT IN ('sunday', 'monday') THEN
    RAISE EXCEPTION 'Invalid week_start_day: %. Must be sunday or monday', p_week_start_day;
  END IF;
  
  RAISE NOTICE 'Week start day: %', p_week_start_day;

  -- Verify global cycle exists and is active
  SELECT 
    id,
    title,
    is_active,
    start_date,
    end_date
  INTO v_cycle_record
  FROM "0008-ap-global-cycles"
  WHERE id = p_global_cycle_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Global cycle not found: %', p_global_cycle_id;
  END IF;

  RAISE NOTICE 'Found cycle: % (active: %)', v_cycle_record.title, v_cycle_record.is_active;

  -- Check if cycle is active (using is_active boolean, not status text)
  IF v_cycle_record.is_active IS NOT true THEN
    RAISE EXCEPTION 'Global cycle is not active: %', v_cycle_record.title;
  END IF;

  -- Check if user already has this cycle activated
  SELECT id INTO v_existing_timeline_id
  FROM "0008-ap-user-global-timelines"
  WHERE user_id = v_user_id
    AND global_cycle_id = p_global_cycle_id
    AND status = 'active';

  IF FOUND THEN
    RAISE EXCEPTION 'This global cycle is already activated';
  END IF;
  
  RAISE NOTICE 'No existing activation found. Creating new timeline...';

  -- Create new active timeline
  INSERT INTO "0008-ap-user-global-timelines" (
    user_id,
    global_cycle_id,
    status,
    week_start_day,
    activated_at,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,
    p_global_cycle_id,
    'active',
    p_week_start_day,
    now(),
    now(),
    now()
  )
  RETURNING id INTO v_new_timeline_id;

  RAISE NOTICE 'Created timeline ID: %', v_new_timeline_id;

  -- Ensure canonical weeks exist for this cycle (idempotent)
  BEGIN
    PERFORM generate_canonical_global_weeks(p_global_cycle_id);
    RAISE NOTICE 'Generated canonical weeks for cycle: %', p_global_cycle_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to generate weeks: %', SQLERRM;
  END;

  RAISE NOTICE 'Activation complete. Returning timeline ID: %', v_new_timeline_id;
  
  RETURN v_new_timeline_id;
END;
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION fn_activate_user_global_timeline(uuid, text) TO authenticated;

COMMENT ON FUNCTION fn_activate_user_global_timeline(uuid, text) IS
  'Activates a global timeline for a user with specified week_start_day preference (sunday or monday). Checks is_active boolean instead of status text.';

-- =====================================================
-- STEP 3: Verify everything is set up
-- =====================================================
DO $$
DECLARE
  v_function_exists boolean;
  v_cycle_count integer;
  v_active_cycle_count integer;
  v_timeline_count integer;
  v_week_count integer;
BEGIN
  -- Check function exists
  SELECT EXISTS(
    SELECT 1 FROM information_schema.routines
    WHERE routine_name = 'fn_activate_user_global_timeline'
    AND routine_schema = 'public'
  ) INTO v_function_exists;

  -- Count cycles
  SELECT COUNT(*) INTO v_cycle_count FROM "0008-ap-global-cycles";
  SELECT COUNT(*) INTO v_active_cycle_count FROM "0008-ap-global-cycles" WHERE is_active = true;
  
  -- Count active timelines
  SELECT COUNT(*) INTO v_timeline_count 
  FROM "0008-ap-user-global-timelines" 
  WHERE status = 'active';

  -- Count weeks
  SELECT COUNT(*) INTO v_week_count FROM "0008-ap-global-weeks";

  RAISE NOTICE '========================================';
  RAISE NOTICE 'FINAL STATUS CHECK:';
  RAISE NOTICE '  Activation function exists: %', v_function_exists;
  RAISE NOTICE '  Total global cycles: %', v_cycle_count;
  RAISE NOTICE '  Active global cycles: %', v_active_cycle_count;
  RAISE NOTICE '  Active user timelines: %', v_timeline_count;
  RAISE NOTICE '  Generated weeks: %', v_week_count;
  RAISE NOTICE '  Expected weeks: % (12 per cycle)', v_cycle_count * 12;
  RAISE NOTICE '========================================';
  RAISE NOTICE 'READY TO TEST ACTIVATION!';
  RAISE NOTICE 'Try activating a timeline from your app now.';
  RAISE NOTICE '========================================';
  
  IF NOT v_function_exists THEN
    RAISE WARNING 'ERROR: Activation function was not created!';
  END IF;
  
  IF v_active_cycle_count = 0 THEN
    RAISE WARNING 'WARNING: No active cycles found! Set is_active = true on a cycle.';
  END IF;
END $$;
