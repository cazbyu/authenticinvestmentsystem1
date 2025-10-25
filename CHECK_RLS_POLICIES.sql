-- Check RLS policies on the user_global_timelines table

-- 1. Check if RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename = '0008-ap-user-global-timelines';

-- 2. List all policies on the table
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
WHERE schemaname = 'public' 
  AND tablename = '0008-ap-user-global-timelines';

-- 3. Check function security
SELECT 
  p.proname,
  p.prosecdef as is_security_definer,
  pg_get_userbyid(p.proowner) as owner
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname = 'fn_activate_user_global_timeline';

-- 4. Test if you can manually insert (to verify INSERT policy works)
/*
INSERT INTO "0008-ap-user-global-timelines" (
  user_id,
  global_cycle_id,
  status,
  week_start_day,
  activated_at
) VALUES (
  auth.uid(),
  'PASTE_CYCLE_ID_HERE'::uuid,
  'active',
  'sunday',
  now()
);
*/
