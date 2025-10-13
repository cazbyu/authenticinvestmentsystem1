/*
================================================================================
  DIAGNOSTIC SCRIPT: Global Timeline Activation Failure Analysis
================================================================================

  Purpose: Identify why fn_activate_user_global_timeline fails silently

  Run each section in order and review the output to identify the failure point.

  INSTRUCTIONS:
  1. Copy this entire script to Supabase SQL Editor
  2. Run each section separately (sections marked with -- SECTION X)
  3. Review the output of each section
  4. Note any errors or unexpected results

================================================================================
*/

-- ==============================================================================
-- SECTION 1: CHECK FUNCTION EXISTS AND GET DEFINITION
-- ==============================================================================
-- This checks if the activation function exists and shows its current definition

SELECT
  p.proname AS function_name,
  pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'fn_activate_user_global_timeline';

-- If this returns no rows, the function doesn't exist!


-- ==============================================================================
-- SECTION 2: CHECK HELPER FUNCTION EXISTS
-- ==============================================================================
-- The activation function depends on generate_adjusted_global_weeks

SELECT
  p.proname AS function_name,
  pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'generate_adjusted_global_weeks';

-- If this returns no rows, the helper function doesn't exist!


-- ==============================================================================
-- SECTION 3: VERIFY TABLE STRUCTURE
-- ==============================================================================
-- Ensure all required columns exist in the target table

SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = '0008-ap-user-global-timelines'
ORDER BY ordinal_position;

-- Required columns: id, user_id, global_cycle_id, title, start_date, end_date,
--                   status, week_start_day, timezone, created_at, updated_at, activated_at


-- ==============================================================================
-- SECTION 4: CHECK CURRENT GLOBAL CYCLES
-- ==============================================================================
-- View available global cycles and their activation eligibility

SELECT
  gc.id,
  gc.title,
  gc.cycle_label,
  gc.start_date,
  gc.end_date,
  gc.reflection_start,
  gc.reflection_end,
  gc.week_start_day,
  gc.status,
  -- Check if today falls in activatable range
  CASE
    WHEN CURRENT_DATE BETWEEN gc.start_date AND gc.reflection_end
      THEN 'Currently Activatable'
    WHEN CURRENT_DATE BETWEEN LAG(gc.reflection_start) OVER (ORDER BY gc.start_date)
         AND LAG(gc.reflection_end) OVER (ORDER BY gc.start_date)
      THEN 'Previous Cycle - Activatable'
    ELSE 'Not Activatable'
  END AS activation_status
FROM "0008-ap-global-cycles" gc
ORDER BY gc.start_date DESC;


-- ==============================================================================
-- SECTION 5: CHECK USER'S CURRENT ACTIVATIONS
-- ==============================================================================
-- Replace 'YOUR_USER_ID_HERE' with an actual user UUID from your database

-- First, let's get a valid user ID to test with:
SELECT id, email, week_start_day
FROM "0008-ap-users"
LIMIT 5;

-- Then check their current timeline activations:
-- (Replace the UUID below with one from the query above)

DO $$
DECLARE
  test_user_id uuid := 'REPLACE_WITH_ACTUAL_USER_ID'; -- <<< REPLACE THIS
BEGIN
  RAISE NOTICE 'Checking activations for user: %', test_user_id;

  PERFORM * FROM "0008-ap-user-global-timelines"
  WHERE user_id = test_user_id;

  IF NOT FOUND THEN
    RAISE NOTICE 'User has NO activated timelines';
  ELSE
    RAISE NOTICE 'User has existing activations:';
  END IF;
END $$;

-- View the actual data:
SELECT
  ugt.id,
  ugt.user_id,
  ugt.global_cycle_id,
  ugt.title,
  ugt.start_date,
  ugt.end_date,
  ugt.status,
  ugt.week_start_day,
  ugt.activated_at,
  gc.title AS cycle_title
FROM "0008-ap-user-global-timelines" ugt
JOIN "0008-ap-global-cycles" gc ON ugt.global_cycle_id = gc.id
WHERE ugt.user_id = 'REPLACE_WITH_ACTUAL_USER_ID' -- <<< REPLACE THIS
ORDER BY ugt.activated_at DESC;


-- ==============================================================================
-- SECTION 6: MANUAL ACTIVATION TEST WITH DETAILED ERROR TRAPPING
-- ==============================================================================
-- Attempt to manually activate a timeline with verbose error reporting
-- Replace the UUIDs below with actual values from previous queries

DO $$
DECLARE
  test_user_id uuid := 'REPLACE_WITH_ACTUAL_USER_ID';      -- <<< REPLACE THIS
  test_cycle_id uuid := 'REPLACE_WITH_ACTUAL_CYCLE_ID';    -- <<< REPLACE THIS
  test_week_start text := 'monday';  -- or 'sunday' based on user preference
  v_result jsonb;
  v_error text;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'STARTING MANUAL ACTIVATION TEST';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'User ID: %', test_user_id;
  RAISE NOTICE 'Cycle ID: %', test_cycle_id;
  RAISE NOTICE 'Week Start Day: %', test_week_start;
  RAISE NOTICE '----------------------------------------';

  -- Check if function exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = 'fn_activate_user_global_timeline'
  ) THEN
    RAISE EXCEPTION 'CRITICAL: fn_activate_user_global_timeline does not exist!';
  END IF;

  RAISE NOTICE 'Function exists - attempting call...';

  -- Attempt the activation
  BEGIN
    SELECT fn_activate_user_global_timeline(
      test_user_id,
      test_cycle_id,
      test_week_start
    ) INTO v_result;

    RAISE NOTICE 'SUCCESS! Function returned: %', v_result;

    -- Verify the insertion
    IF EXISTS (
      SELECT 1 FROM "0008-ap-user-global-timelines"
      WHERE user_id = test_user_id
        AND global_cycle_id = test_cycle_id
    ) THEN
      RAISE NOTICE 'VERIFIED: Record was inserted into database';
    ELSE
      RAISE WARNING 'WARNING: Function succeeded but no record found in database!';
    END IF;

  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
    RAISE NOTICE 'FAILURE! Error occurred: %', v_error;
    RAISE NOTICE 'SQL State: %', SQLSTATE;
    RAISE NOTICE 'Error Detail: %', SQLERRM;
  END;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'TEST COMPLETE';
  RAISE NOTICE '========================================';
END $$;


-- ==============================================================================
-- SECTION 7: CHECK FOR CONSTRAINT VIOLATIONS
-- ==============================================================================
-- Identify potential constraint issues that might cause silent failures

-- Check for foreign key constraints
SELECT
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = '0008-ap-user-global-timelines'
  AND tc.constraint_type IN ('FOREIGN KEY', 'UNIQUE', 'CHECK');

-- Check for triggers that might interfere
SELECT
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = '0008-ap-user-global-timelines';


-- ==============================================================================
-- SECTION 8: TEST HELPER FUNCTION DIRECTLY
-- ==============================================================================
-- Test if generate_adjusted_global_weeks works independently

DO $$
DECLARE
  test_cycle_id uuid := 'REPLACE_WITH_ACTUAL_CYCLE_ID';  -- <<< REPLACE THIS
  test_week_start text := 'monday';
  v_result jsonb;
BEGIN
  RAISE NOTICE 'Testing generate_adjusted_global_weeks function...';

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = 'generate_adjusted_global_weeks'
  ) THEN
    RAISE EXCEPTION 'CRITICAL: generate_adjusted_global_weeks does not exist!';
  END IF;

  BEGIN
    SELECT generate_adjusted_global_weeks(test_cycle_id, test_week_start) INTO v_result;
    RAISE NOTICE 'Helper function returned: %', v_result;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Helper function failed: %', SQLERRM;
  END;
END $$;


-- ==============================================================================
-- SECTION 9: CHECK RLS POLICIES
-- ==============================================================================
-- Verify Row Level Security isn't blocking insertions

SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = '0008-ap-user-global-timelines';


-- ==============================================================================
-- SECTION 10: SIMPLE INSERT TEST
-- ==============================================================================
-- Try a direct INSERT to see if the table itself works
-- Replace the UUIDs with actual values

DO $$
DECLARE
  test_user_id uuid := 'REPLACE_WITH_ACTUAL_USER_ID';     -- <<< REPLACE THIS
  test_cycle_id uuid := 'REPLACE_WITH_ACTUAL_CYCLE_ID';   -- <<< REPLACE THIS
  v_cycle_title text;
  v_cycle_start date;
  v_cycle_end date;
  v_new_id uuid;
BEGIN
  RAISE NOTICE 'Testing direct INSERT into table...';

  -- Get cycle data
  SELECT title, start_date, end_date
  INTO v_cycle_title, v_cycle_start, v_cycle_end
  FROM "0008-ap-global-cycles"
  WHERE id = test_cycle_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cycle not found!';
  END IF;

  -- Try direct insert
  BEGIN
    INSERT INTO "0008-ap-user-global-timelines" (
      user_id,
      global_cycle_id,
      title,
      start_date,
      end_date,
      status,
      week_start_day,
      timezone,
      activated_at
    ) VALUES (
      test_user_id,
      test_cycle_id,
      v_cycle_title,
      v_cycle_start,
      v_cycle_end,
      'active',
      'monday',
      'UTC',
      now()
    )
    RETURNING id INTO v_new_id;

    RAISE NOTICE 'SUCCESS! Direct INSERT worked. New ID: %', v_new_id;

    -- Clean up test data
    DELETE FROM "0008-ap-user-global-timelines" WHERE id = v_new_id;
    RAISE NOTICE 'Test record cleaned up';

  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'FAILED! Direct INSERT error: %', SQLERRM;
  END;
END $$;


-- ==============================================================================
-- END OF DIAGNOSTIC SCRIPT
-- ==============================================================================

/*
  NEXT STEPS BASED ON RESULTS:

  1. If SECTION 1 returns no rows:
     - The function doesn't exist and needs to be created

  2. If SECTION 6 shows an error:
     - Note the exact error message - this is your root cause

  3. If SECTION 10 fails:
     - There's a table-level issue (constraints, RLS, triggers)

  4. If everything succeeds in isolation but the actual function fails:
     - There's a logic issue in the function itself
     - Check the function definition from SECTION 1

  5. If SECTION 2 returns no rows:
     - The helper function is missing
     - Week generation will fail
*/
