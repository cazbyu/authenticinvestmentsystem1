/*
  ============================================================================
  COMPLETE ACTIVATION FIX
  ============================================================================
  This script ensures everything is set up correctly for timeline activation
  Run this if DIAGNOSE_DATABASE.sql shows any issues
  ============================================================================
*/

-- =====================================================
-- STEP 1: Ensure activated_at column exists
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '0008-ap-user-global-timelines'
    AND column_name = 'activated_at'
  ) THEN
    ALTER TABLE "0008-ap-user-global-timelines"
    ADD COLUMN activated_at timestamptz;
    
    RAISE NOTICE 'Added activated_at column';
  ELSE
    RAISE NOTICE 'activated_at column already exists';
  END IF;
END $$;

-- =====================================================
-- STEP 2: Ensure status column exists and has default
-- =====================================================
DO $$
BEGIN
  -- Add status column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '0008-ap-user-global-timelines'
    AND column_name = 'status'
  ) THEN
    ALTER TABLE "0008-ap-user-global-timelines"
    ADD COLUMN status text DEFAULT 'active' 
    CHECK (status IN ('active', 'completed', 'archived'));
    
    RAISE NOTICE 'Added status column';
  ELSE
    RAISE NOTICE 'status column already exists';
  END IF;
END $$;

-- =====================================================
-- STEP 3: Check and fix global_cycles status column
-- =====================================================
DO $$
BEGIN
  -- Many migrations reference 'status' but table has 'is_active'
  -- Let's ensure both work
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '0008-ap-global-cycles'
    AND column_name = 'status'
  ) THEN
    ALTER TABLE "0008-ap-global-cycles"
    ADD COLUMN status text DEFAULT 'active';
    
    -- Set status based on is_active
    UPDATE "0008-ap-global-cycles"
    SET status = CASE WHEN is_active THEN 'active' ELSE 'inactive' END;
    
    RAISE NOTICE 'Added status column to global_cycles';
  ELSE
    RAISE NOTICE 'status column already exists in global_cycles';
  END IF;
END $$;

-- =====================================================
-- STEP 4: Drop and recreate activation function with better logging
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
  v_cycle_title text;
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
    EXISTS(
      SELECT 1 FROM "0008-ap-global-cycles"
      WHERE id = p_global_cycle_id
        AND (is_active = true OR status = 'active')
    ),
    title
  INTO v_cycle_exists, v_cycle_title
  FROM "0008-ap-global-cycles"
  WHERE id = p_global_cycle_id;

  RAISE NOTICE 'Cycle lookup - ID: %, Exists: %, Title: %', p_global_cycle_id, v_cycle_exists, v_cycle_title;

  IF NOT v_cycle_exists OR v_cycle_exists IS NULL THEN
    RAISE EXCEPTION 'Global cycle not found or not active: %', p_global_cycle_id;
  END IF;

  -- Check if user already has this cycle activated
  SELECT id INTO v_existing_timeline_id
  FROM "0008-ap-user-global-timelines"
  WHERE user_id = v_user_id
    AND global_cycle_id = p_global_cycle_id
    AND status = 'active';

  IF FOUND THEN
    RAISE EXCEPTION 'This global cycle is already activated for user';
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

GRANT EXECUTE ON FUNCTION fn_activate_user_global_timeline(uuid, text) TO authenticated;

COMMENT ON FUNCTION fn_activate_user_global_timeline(uuid, text) IS
  'Activates a global timeline for a user with specified week_start_day preference (sunday or monday). Enhanced with logging for debugging.';

-- =====================================================
-- STEP 5: Verify and test the function
-- =====================================================
DO $$
DECLARE
  v_function_exists boolean;
  v_cycle_count integer;
  v_timeline_count integer;
BEGIN
  -- Check function exists
  SELECT EXISTS(
    SELECT 1 FROM information_schema.routines
    WHERE routine_name = 'fn_activate_user_global_timeline'
    AND routine_schema = 'public'
  ) INTO v_function_exists;

  -- Count cycles
  SELECT COUNT(*) INTO v_cycle_count FROM "0008-ap-global-cycles";
  
  -- Count active timelines
  SELECT COUNT(*) INTO v_timeline_count 
  FROM "0008-ap-user-global-timelines" 
  WHERE status = 'active';

  RAISE NOTICE '========================================';
  RAISE NOTICE 'ACTIVATION SYSTEM STATUS:';
  RAISE NOTICE '  Function exists: %', v_function_exists;
  RAISE NOTICE '  Global cycles: %', v_cycle_count;
  RAISE NOTICE '  Active timelines: %', v_timeline_count;
  RAISE NOTICE '========================================';
  
  IF NOT v_function_exists THEN
    RAISE WARNING 'Activation function was not created successfully!';
  END IF;
  
  IF v_cycle_count = 0 THEN
    RAISE WARNING 'No global cycles found! Create a cycle first.';
  END IF;
END $$;
