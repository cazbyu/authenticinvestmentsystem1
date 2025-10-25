/*
  ============================================================================
  DIAGNOSTIC SCRIPT - Run this in Supabase SQL Editor
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
  gw.week_end,
  gw.created_at
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
  ugt.activated_at,
  ugt.created_at
FROM "0008-ap-user-global-timelines" ugt
JOIN "0008-ap-global-cycles" gc ON ugt.global_cycle_id = gc.id
ORDER BY ugt.created_at DESC;

-- =====================================================
-- 4. Check if Views Exist
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
-- 5. Test v_user_global_timeline_weeks View
-- =====================================================
SELECT 
  '=== VIEW: v_user_global_timeline_weeks ===' AS info,
  timeline_id,
  user_id,
  week_start_day,
  week_number,
  week_start,
  week_end,
  source
FROM v_user_global_timeline_weeks
ORDER BY week_number
LIMIT 5;

-- =====================================================
-- 6. Check Functions Exist
-- =====================================================
SELECT 
  '=== FUNCTIONS STATUS ===' AS info,
  routine_name,
  routine_type,
  data_type
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
  roles,
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
-- 9. Check for any errors in recent function calls
-- =====================================================
-- This will show if there are any constraint violations or errors
SELECT 
  '=== TABLE STRUCTURE CHECK ===' AS info,
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = '0008-ap-user-global-timelines'
ORDER BY ordinal_position;
