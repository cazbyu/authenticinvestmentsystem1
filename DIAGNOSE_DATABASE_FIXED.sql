/*
  ============================================================================
  DIAGNOSTIC SCRIPT (FIXED) - Run this in Supabase SQL Editor
  ============================================================================
  This will show us the current state of your database
  Copy the output and share it so we can troubleshoot
  ============================================================================
*/

-- =====================================================
-- 1. Check Global Cycles Table
-- =====================================================
SELECT 
  '=== GLOBAL CYCLES ===' AS info,
  id,
  title,
  cycle_label,
  start_date,
  end_date,
  is_active,
  created_at
FROM "0008-ap-global-cycles"
ORDER BY created_at DESC;

-- =====================================================
-- 2. Check Global Weeks Table
-- =====================================================
SELECT 
  '=== GLOBAL WEEKS ===' AS info,
  gw.id,
  gc.title AS cycle_title,
  gw.week_number,
  gw.week_start,
  gw.week_end
FROM "0008-ap-global-weeks" gw
JOIN "0008-ap-global-cycles" gc ON gw.global_cycle_id = gc.id
ORDER BY gc.title, gw.week_number
LIMIT 15;

-- Count of weeks per cycle
SELECT 
  '=== WEEKS COUNT PER CYCLE ===' AS info,
  gc.title AS cycle_title,
  gc.id AS cycle_id,
  COUNT(gw.id) AS week_count
FROM "0008-ap-global-cycles" gc
LEFT JOIN "0008-ap-global-weeks" gw ON gw.global_cycle_id = gc.id
GROUP BY gc.id, gc.title
ORDER BY gc.title;

-- =====================================================
-- 3. Check User Global Timelines Table
-- =====================================================
SELECT 
  '=== USER GLOBAL TIMELINES ===' AS info,
  ugt.id,
  ugt.user_id,
  gc.title AS cycle_title,
  ugt.status,
  ugt.week_start_day,
  ugt.created_at
FROM "0008-ap-user-global-timelines" ugt
JOIN "0008-ap-global-cycles" gc ON ugt.global_cycle_id = gc.id
ORDER BY ugt.created_at DESC;

-- =====================================================
-- 4. Check Table Structure for user_global_timelines
-- =====================================================
SELECT 
  '=== USER GLOBAL TIMELINES COLUMNS ===' AS info,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = '0008-ap-user-global-timelines'
ORDER BY ordinal_position;

-- =====================================================
-- 5. Check if Views Exist
-- =====================================================
SELECT 
  '=== VIEWS STATUS ===' AS info,
  schemaname,
  viewname,
  viewowner
FROM pg_views
WHERE viewname IN (
  'v_user_global_timeline_weeks',
  'v_user_global_timeline_days_left',
  'v_unified_timeline_weeks',
  'v_unified_timeline_days_left'
)
ORDER BY viewname;

-- =====================================================
-- 6. Check Functions Exist
-- =====================================================
SELECT 
  '=== FUNCTIONS STATUS ===' AS info,
  routine_name,
  routine_type,
  data_type AS return_type
FROM information_schema.routines
WHERE routine_name IN (
  'generate_canonical_global_weeks',
  'fn_activate_user_global_timeline'
)
AND routine_schema = 'public'
ORDER BY routine_name;

-- =====================================================
-- 7. Check RLS Policies
-- =====================================================
SELECT 
  '=== RLS POLICIES ===' AS info,
  schemaname,
  tablename,
  policyname,
  permissive,
  cmd
FROM pg_policies
WHERE tablename IN (
  '0008-ap-global-cycles',
  '0008-ap-global-weeks',
  '0008-ap-user-global-timelines'
)
ORDER BY tablename, policyname;

-- =====================================================
-- 8. Check Current User
-- =====================================================
SELECT 
  '=== CURRENT USER ===' AS info,
  auth.uid() AS current_user_id,
  auth.role() AS current_role;

-- =====================================================
-- 9. Check for status column in global_cycles
-- =====================================================
SELECT 
  '=== GLOBAL CYCLES COLUMNS ===' AS info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = '0008-ap-global-cycles'
  AND column_name IN ('status', 'is_active')
ORDER BY ordinal_position;

-- =====================================================
-- 10. Try to call the activation function (will show error if any)
-- =====================================================
SELECT 
  '=== FUNCTION SIGNATURE ===' AS info,
  routine_name,
  string_agg(parameter_name || ' ' || data_type, ', ') AS parameters
FROM information_schema.parameters
WHERE specific_schema = 'public'
  AND routine_name = 'fn_activate_user_global_timeline'
GROUP BY routine_name;
