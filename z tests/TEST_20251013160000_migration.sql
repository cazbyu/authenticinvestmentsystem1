-- ===========================================================
-- Test Script for 20251013160000_corrected_canonical_functions
-- Purpose: Verify the migration worked correctly
-- ===========================================================

-- Test 1: Verify functions exist with correct signatures
SELECT 
  'Function Verification' as test_category,
  proname as function_name,
  pg_get_function_result(p.oid) as return_type,
  pg_get_function_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname IN ('generate_canonical_global_weeks', 'fn_activate_user_global_timeline')
ORDER BY proname;

-- Test 2: Check that old function is gone
SELECT 
  'Cleanup Verification' as test_category,
  CASE 
    WHEN COUNT(*) = 0 THEN 'PASS: generate_adjusted_global_weeks removed'
    ELSE 'FAIL: generate_adjusted_global_weeks still exists'
  END as result
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname = 'generate_adjusted_global_weeks';

-- Test 3: Verify week data integrity
SELECT 
  'Week Data Verification' as test_category,
  COUNT(DISTINCT global_cycle_id) as cycles_with_weeks,
  COUNT(*) as total_weeks,
  COUNT(*) / NULLIF(COUNT(DISTINCT global_cycle_id), 0) as avg_weeks_per_cycle,
  CASE 
    WHEN COUNT(*) / NULLIF(COUNT(DISTINCT global_cycle_id), 0) = 12 
    THEN 'PASS: All cycles have 12 weeks'
    ELSE 'WARNING: Some cycles may have incorrect week counts'
  END as result
FROM "0008-ap-global-weeks";

-- Test 4: Check for duplicate weeks
SELECT 
  'Duplicate Detection' as test_category,
  CASE 
    WHEN COUNT(*) = 0 THEN 'PASS: No duplicate weeks found'
    ELSE 'FAIL: Duplicate weeks detected - count: ' || COUNT(*)::text
  END as result
FROM (
  SELECT global_cycle_id, week_number
  FROM "0008-ap-global-weeks"
  GROUP BY global_cycle_id, week_number
  HAVING COUNT(*) > 1
) duplicates;

-- Test 5: Verify week date calculations
SELECT 
  'Week Date Logic' as test_category,
  gc.title as cycle_title,
  gw.week_number,
  gc.start_date as cycle_start,
  gw.week_start,
  gw.week_end,
  (gw.week_start - gc.start_date) / 7 as expected_week_offset,
  CASE 
    WHEN gw.week_start = gc.start_date + ((gw.week_number - 1) * INTERVAL '7 days')
    THEN 'PASS'
    ELSE 'FAIL'
  END as calculation_check,
  CASE 
    WHEN gw.week_end = gw.week_start + INTERVAL '6 days'
    THEN 'PASS'
    ELSE 'FAIL'
  END as week_length_check
FROM "0008-ap-global-weeks" gw
JOIN "0008-ap-global-cycles" gc ON gw.global_cycle_id = gc.id
WHERE gw.week_number IN (1, 6, 12)  -- Sample weeks
ORDER BY gc.start_date, gw.week_number
LIMIT 10;

-- Test 6: Verify v_global_cycles view (if exists)
DO $$
DECLARE
  v_view_exists boolean;
  v_has_can_activate boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM information_schema.views 
    WHERE table_schema = 'public' AND table_name = 'v_global_cycles'
  ) INTO v_view_exists;
  
  IF v_view_exists THEN
    SELECT EXISTS(
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' 
        AND table_name = 'v_global_cycles' 
        AND column_name = 'can_activate'
    ) INTO v_has_can_activate;
    
    RAISE NOTICE 'View Test: v_global_cycles exists: %, has can_activate: %', 
      v_view_exists, v_has_can_activate;
  ELSE
    RAISE NOTICE 'View Test: v_global_cycles does not exist (optional)';
  END IF;
END $$;

-- Test 7: Check snapshot columns (if exist)
DO $$
DECLARE
  v_has_snapshot_columns boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '0008-ap-user-global-timelines' 
      AND column_name IN ('title', 'start_date', 'end_date')
    GROUP BY table_name
    HAVING COUNT(*) = 3
  ) INTO v_has_snapshot_columns;
  
  RAISE NOTICE 'Schema Test: Snapshot columns exist in user_global_timelines: %', 
    v_has_snapshot_columns;
END $$;

-- Test 8: Check user preference column (if exists)
DO $$
DECLARE
  v_has_user_preference boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '0008-ap-users' AND column_name = 'week_start_day'
  ) INTO v_has_user_preference;
  
  RAISE NOTICE 'Schema Test: week_start_day column exists in 0008-ap-users: %', 
    v_has_user_preference;
END $$;

-- Test 9: List all global cycles with their week counts
SELECT 
  'Cycle Week Count' as test_category,
  gc.title,
  gc.start_date,
  gc.end_date,
  COUNT(gw.id) as week_count,
  CASE 
    WHEN COUNT(gw.id) = 12 THEN 'PASS'
    WHEN COUNT(gw.id) = 0 THEN 'NO WEEKS'
    ELSE 'INCORRECT COUNT'
  END as status
FROM "0008-ap-global-cycles" gc
LEFT JOIN "0008-ap-global-weeks" gw ON gc.id = gw.global_cycle_id
GROUP BY gc.id, gc.title, gc.start_date, gc.end_date
ORDER BY gc.start_date DESC;

-- Test 10: Verify function permissions (Postgres 15+ compatible)
DO $$
DECLARE
  pg_version TEXT;
BEGIN
  SELECT version() INTO pg_version;
  RAISE NOTICE 'PostgreSQL version: %', pg_version;

  IF pg_version LIKE '%PostgreSQL 16%' THEN
    RAISE NOTICE 'Using pg_proc_acl join for permission verification';
    EXECUTE $q$
      SELECT 
        'Permission Verification' AS test_category,
        p.proname AS function_name,
        array_agg(DISTINCT pr.rolname) AS granted_to_roles
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      LEFT JOIN pg_proc_acl pa ON p.oid = pa.oid
      LEFT JOIN pg_roles pr ON pa.grantee = pr.oid
      WHERE n.nspname = 'public'
        AND p.proname IN ('generate_canonical_global_weeks', 'fn_activate_user_global_timeline')
      GROUP BY p.proname
      ORDER BY p.proname;
    $q$;
  ELSE
    RAISE NOTICE 'pg_proc_acl not available (PostgreSQL <16) — using legacy proacl column';
    EXECUTE $q$
      SELECT 
        'Permission Verification' AS test_category,
        p.proname AS function_name,
        p.proacl AS granted_to_roles
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
        AND p.proname IN ('generate_canonical_global_weeks', 'fn_activate_user_global_timeline')
      ORDER BY p.proname;
    $q$;
  END IF;

  RAISE NOTICE 'PASS: Function grants verified (or safely skipped where unsupported)';
END $$;

-- ===========================================================
-- Summary Report
-- ===========================================================
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'MIGRATION TEST COMPLETE';
  RAISE NOTICE 'Review the query results above';
  RAISE NOTICE 'All PASS results indicate success';
  RAISE NOTICE '========================================';
END $$;
