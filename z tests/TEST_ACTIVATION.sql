/*
  ============================================================================
  TEST TIMELINE ACTIVATION
  ============================================================================
  This script will manually test the timeline activation process
  Run this AFTER running DIAGNOSE_DATABASE.sql
  ============================================================================
*/

-- =====================================================
-- Get current user ID
-- =====================================================
SELECT 
  '=== CURRENT USER ===' AS info,
  auth.uid() AS user_id,
  auth.role() AS role;

-- =====================================================
-- Get available cycles
-- =====================================================
SELECT 
  '=== AVAILABLE CYCLES ===' AS info,
  id,
  title,
  cycle_label,
  start_date,
  end_date,
  is_active
FROM "0008-ap-global-cycles"
WHERE is_active = true
ORDER BY start_date;

-- =====================================================
-- Try to activate a timeline manually (REPLACE THE UUID)
-- =====================================================
-- IMPORTANT: Replace '<YOUR_CYCLE_ID>' with actual cycle ID from above
-- Example: SELECT fn_activate_user_global_timeline('a1b2c3d4-...', 'monday');

-- Uncomment and modify this line after getting cycle ID:
-- SELECT fn_activate_user_global_timeline('<YOUR_CYCLE_ID>'::uuid, 'monday');

-- =====================================================
-- Check if activation worked
-- =====================================================
SELECT 
  '=== CHECK ACTIVATION RESULT ===' AS info,
  ugt.id,
  ugt.user_id,
  ugt.global_cycle_id,
  ugt.status,
  ugt.week_start_day,
  gc.title AS cycle_title
FROM "0008-ap-user-global-timelines" ugt
JOIN "0008-ap-global-cycles" gc ON ugt.global_cycle_id = gc.id
WHERE ugt.user_id = auth.uid()
ORDER BY ugt.created_at DESC;

-- =====================================================
-- Check if weeks were generated
-- =====================================================
SELECT 
  '=== WEEKS FOR MY TIMELINE ===' AS info,
  gw.week_number,
  gw.week_start,
  gw.week_end
FROM "0008-ap-user-global-timelines" ugt
JOIN "0008-ap-global-weeks" gw ON gw.global_cycle_id = ugt.global_cycle_id
WHERE ugt.user_id = auth.uid()
  AND ugt.status = 'active'
ORDER BY gw.week_number
LIMIT 12;
