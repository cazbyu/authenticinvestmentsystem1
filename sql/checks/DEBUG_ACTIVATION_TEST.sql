-- Test the activation function directly
-- Run this in Supabase SQL Editor

-- 1. Check if function exists and get its signature
SELECT 
  p.proname as function_name,
  pg_get_function_result(p.oid) as return_type,
  pg_get_function_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname = 'fn_activate_user_global_timeline';

-- 2. Check available cycles that can be activated
SELECT 
  global_cycle_id,
  title,
  start_date,
  end_date,
  can_activate,
  cycle_position
FROM v_global_cycles
WHERE can_activate = true
ORDER BY start_date;

-- 3. Check if there are any existing active timelines for current user
SELECT 
  ugt.id,
  ugt.global_cycle_id,
  ugt.status,
  ugt.week_start_day,
  gc.title
FROM "0008-ap-user-global-timelines" ugt
JOIN "0008-ap-global-cycles" gc ON ugt.global_cycle_id = gc.id
WHERE ugt.user_id = auth.uid()
  AND ugt.status = 'active';

-- 4. Test activation (REPLACE WITH ACTUAL CYCLE ID)
-- Get a cycle ID first from step 2 above, then uncomment and run:
/*
SELECT fn_activate_user_global_timeline(
  'PASTE_CYCLE_ID_HERE'::uuid,
  'sunday'
);
*/

-- 5. Check if row was created after activation
SELECT 
  ugt.id,
  ugt.global_cycle_id,
  ugt.status,
  ugt.week_start_day,
  ugt.activated_at,
  gc.title
FROM "0008-ap-user-global-timelines" ugt
JOIN "0008-ap-global-cycles" gc ON ugt.global_cycle_id = gc.id
WHERE ugt.user_id = auth.uid()
ORDER BY ugt.created_at DESC
LIMIT 5;

-- 6. Check for any errors in recent logs (if you have access)
-- This would be in Supabase Dashboard > Logs
