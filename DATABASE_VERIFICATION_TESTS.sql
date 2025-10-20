-- ============================================================================
-- DATABASE VERIFICATION AND TEST QUERIES
-- ============================================================================
-- Purpose: Comprehensive tests to verify your database setup and diagnose issues
-- Usage: Copy sections as needed and run in Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- SECTION 1: AUTHENTICATION CHECK
-- ============================================================================

-- Check if you're logged in
SELECT
  auth.uid() as your_user_id,
  auth.role() as your_role,
  CASE
    WHEN auth.uid() IS NOT NULL THEN '✓ Authenticated'
    ELSE '✗ NOT AUTHENTICATED - Please log in first!'
  END as status;

-- ============================================================================
-- SECTION 2: TABLE EXISTENCE CHECK
-- ============================================================================

-- List all your application tables
SELECT
  table_name,
  CASE
    WHEN table_name LIKE '0008-ap-%' THEN '✓ App Table'
    ELSE 'System Table'
  END as table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE '0008-ap-%'
ORDER BY table_name;

-- Count total app tables (should be ~20+)
SELECT
  COUNT(*) as total_app_tables,
  CASE
    WHEN COUNT(*) >= 20 THEN '✓ All tables present'
    WHEN COUNT(*) >= 10 THEN '⚠ Some tables missing'
    ELSE '✗ Many tables missing'
  END as status
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE '0008-ap-%';

-- ============================================================================
-- SECTION 3: CORE FUNCTIONS CHECK
-- ============================================================================

-- Check if key functions exist
SELECT
  proname as function_name,
  pg_get_function_arguments(p.oid) as parameters,
  pg_get_function_result(p.oid) as return_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND proname IN (
    'fn_expand_recurrence_dates',
    'generate_canonical_global_weeks',
    'fn_activate_user_global_timeline',
    'handle_new_user_profile'
  )
ORDER BY proname;

-- Count total functions (should have several)
SELECT
  COUNT(*) as total_functions,
  CASE
    WHEN COUNT(*) >= 5 THEN '✓ Functions present'
    ELSE '✗ Functions missing'
  END as status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND proname LIKE 'fn_%' OR proname LIKE 'generate_%';

-- ============================================================================
-- SECTION 4: VIEWS CHECK
-- ============================================================================

-- List all views
SELECT
  table_name as view_name,
  '✓' as exists
FROM information_schema.views
WHERE table_schema = 'public'
ORDER BY table_name;

-- Check critical views
SELECT
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'v_tasks_with_recurrence_expanded')
      THEN '✓ v_tasks_with_recurrence_expanded'
    ELSE '✗ v_tasks_with_recurrence_expanded MISSING'
  END as recurrence_view,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'v_dashboard_next_occurrences')
      THEN '✓ v_dashboard_next_occurrences'
    ELSE '✗ v_dashboard_next_occurrences MISSING'
  END as dashboard_view,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'v_global_cycles')
      THEN '✓ v_global_cycles'
    ELSE '⚠ v_global_cycles (optional)'
  END as cycles_view;

-- ============================================================================
-- SECTION 5: DATA EXISTENCE CHECK
-- ============================================================================

-- Check if wellness domains exist (should be 8)
SELECT
  COUNT(*) as wellness_domain_count,
  CASE
    WHEN COUNT(*) = 8 THEN '✓ All 8 wellness domains present'
    WHEN COUNT(*) > 0 THEN '⚠ Some wellness domains present'
    ELSE '✗ No wellness domains - run seed script'
  END as status
FROM "0008-ap-domains";

-- List wellness domains
SELECT name, description
FROM "0008-ap-domains"
ORDER BY name;

-- Check if global cycles exist
SELECT
  COUNT(*) as global_cycle_count,
  CASE
    WHEN COUNT(*) > 0 THEN '✓ Global cycles present'
    ELSE '✗ No global cycles - create some first'
  END as status
FROM "0008-ap-global-cycles";

-- List global cycles (fixed: uses status instead of is_active)
SELECT
  title,
  start_date,
  end_date,
  status,
  CASE
    WHEN status = 'active' THEN '✓ Active'
    WHEN status = 'draft' THEN '○ Draft'
    WHEN status = 'completed' THEN '⚙ Completed'
    WHEN status = 'archived' THEN '□ Archived'
    ELSE 'Unknown'
  END as display_status
FROM "0008-ap-global-cycles"
ORDER BY start_date DESC;

-- ============================================================================
-- ============================================================================
-- SECTION 6: USER DATA CHECK (FIXED)
-- ============================================================================

-- Check your user profile
SELECT
  id as user_id,  -- maps directly to auth.users.id
  email,
  first_name,
  last_name,
  profile_image,
  theme_color,
  accent_color,
  CASE
    WHEN mission_text IS NOT NULL THEN '✓ Has mission'
    ELSE '○ No mission'
  END as mission_status,
  CASE
    WHEN vision_text IS NOT NULL THEN '✓ Has vision'
    ELSE '○ No vision'
  END as vision_status,
  created_at,
  updated_at,
  access_level,
  plan_type,
  onboarded
FROM "0008-ap-users"
WHERE id = auth.uid();

-- Check your roles
SELECT
  COUNT(*) as role_count,
  CASE
    WHEN COUNT(*) > 0 THEN '✓ You have roles'
    ELSE '○ No roles created yet'
  END as status
FROM "0008-ap-roles"
WHERE user_id = auth.uid();

-- ============================================================================
-- FIXED SECTION: List your roles
-- ============================================================================
SELECT
  label,
  category,
  color,
  icon,
  is_active,
  created_at,
  source
FROM "0008-ap-roles"
WHERE user_id = auth.uid()
ORDER BY
  sort_order NULLS LAST,
  created_at;

-- Check your tasks/events
SELECT
  COUNT(*) as task_count,
  COUNT(*) FILTER (WHERE type = 'task') as tasks,
  COUNT(*) FILTER (WHERE type = 'event') as events,
  COUNT(*) FILTER (WHERE recurrence_rule IS NOT NULL) as recurring,
  CASE
    WHEN COUNT(*) > 0 THEN '✓ You have tasks/events'
    ELSE '○ No tasks/events yet'
  END as status
FROM "0008-ap-tasks"
WHERE user_id = auth.uid()
  AND deleted_at IS NULL;

-- ============================================================================
-- SECTION 7: TIMELINE ACTIVATION CHECK
-- ============================================================================

-- Check if you have any activated timelines
SELECT
  ugt.id,
  gc.title as cycle_title,
  ugt.status,
  ugt.week_start_day,
  ugt.activated_at,
  CASE
    WHEN ugt.status = 'active' THEN '✓ Active'
    WHEN ugt.status = 'archived' THEN '○ Archived'
    ELSE 'Other'
  END as timeline_status
FROM "0008-ap-user-global-timelines" ugt
JOIN "0008-ap-global-cycles" gc ON gc.id = ugt.global_cycle_id
WHERE ugt.user_id = auth.uid()
ORDER BY ugt.activated_at DESC;

-- Count activated timelines
SELECT
  COUNT(*) as activated_timeline_count,
  COUNT(*) FILTER (WHERE status = 'active') as active_count,
  CASE
    WHEN COUNT(*) FILTER (WHERE status = 'active') > 0 THEN '✓ You have active timelines'
    WHEN COUNT(*) > 0 THEN '⚠ You have timelines but none are active'
    ELSE '○ No timelines activated yet'
  END as status
FROM "0008-ap-user-global-timelines"
WHERE user_id = auth.uid();

-- ============================================================================
-- SECTION 8: WEEK GENERATION CHECK
-- ============================================================================

-- Check if weeks were generated for global cycles
SELECT
  gc.title as cycle_title,
  COUNT(gw.id) as week_count,
  CASE
    WHEN COUNT(gw.id) = 12 THEN '✓ Complete (12 weeks)'
    WHEN COUNT(gw.id) > 0 THEN '⚠ Incomplete'
    ELSE '✗ No weeks generated'
  END as status
FROM "0008-ap-global-cycles" gc
LEFT JOIN "0008-ap-global-weeks" gw ON gc.id = gw.global_cycle_id
GROUP BY gc.id, gc.title
ORDER BY gc.start_date DESC;

-- Check for duplicate weeks (should be 0)
SELECT
  global_cycle_id,
  week_number,
  COUNT(*) as duplicate_count
FROM "0008-ap-global-weeks"
GROUP BY global_cycle_id, week_number
HAVING COUNT(*) > 1;

-- Summary of week generation
SELECT
  COUNT(DISTINCT global_cycle_id) as cycles_with_weeks,
  COUNT(*) as total_week_records,
  CASE
    WHEN COUNT(*) = COUNT(DISTINCT global_cycle_id) * 12 THEN '✓ All cycles have 12 weeks'
    ELSE '⚠ Some cycles missing weeks'
  END as status
FROM "0008-ap-global-weeks";

-- ============================================================================
-- SECTION 9: CALENDAR VIEW CHECK
-- ============================================================================

-- Test recurrence expansion view (should return data)
SELECT
  title,
  occurrence_date,
  is_virtual_occurrence,
  recurrence_rule IS NOT NULL as is_recurring,
  status
FROM v_tasks_with_recurrence_expanded
WHERE user_id = auth.uid()
  AND occurrence_date >= CURRENT_DATE - INTERVAL '7 days'
  AND occurrence_date <= CURRENT_DATE + INTERVAL '7 days'
ORDER BY occurrence_date
LIMIT 20;

-- Count tasks in calendar view
SELECT
  COUNT(*) as total_occurrences,
  COUNT(*) FILTER (WHERE is_virtual_occurrence) as virtual_occurrences,
  COUNT(*) FILTER (WHERE NOT is_virtual_occurrence) as actual_tasks,
  COUNT(*) FILTER (WHERE occurrence_date < CURRENT_DATE) as past_dates,
  COUNT(*) FILTER (WHERE occurrence_date >= CURRENT_DATE) as future_dates
FROM v_tasks_with_recurrence_expanded
WHERE user_id = auth.uid();

-- ============================================================================
-- SECTION 10: RLS POLICY CHECK
-- ============================================================================

-- List all RLS policies for tasks table
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = '0008-ap-tasks'
ORDER BY policyname;

-- Check if RLS is enabled on key tables
SELECT
  schemaname,
  tablename,
  CASE
    WHEN rowsecurity THEN '✓ RLS Enabled'
    ELSE '✗ RLS NOT Enabled'
  END as rls_status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename LIKE '0008-ap-%'
ORDER BY tablename;

-- ============================================================================
-- SECTION 11: STORAGE BUCKETS CHECK
-- ============================================================================

-- Check if storage buckets exist
SELECT
  name as bucket_name,
  public,
  CASE
    WHEN public THEN 'Public'
    ELSE 'Private'
  END as access_level,
  created_at
FROM storage.buckets
ORDER BY created_at;

-- ============================================================================
-- SECTION 12: TEST RECURRENCE EXPANSION FUNCTION
-- ============================================================================

-- Test daily recurrence (next 7 days)
SELECT
  occurrence_date,
  EXTRACT(DOW FROM occurrence_date) as day_of_week
FROM fn_expand_recurrence_dates(
  CURRENT_DATE::date,  -- explicit date cast
  'FREQ=DAILY;INTERVAL=1',
  NULL,
  '[]'::jsonb,
  7,
  0
)
ORDER BY occurrence_date;

-- Test weekly recurrence (Mon-Fri)
SELECT
  occurrence_date,
  TO_CHAR(occurrence_date, 'Dy') as day_name
FROM fn_expand_recurrence_dates(
  CURRENT_DATE::date,  -- explicit date cast
  'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR',
  NULL,
  '[]'::jsonb,
  14,
  0
)
ORDER BY occurrence_date;

-- Test past date expansion (should return dates from the past)
SELECT
  occurrence_date,
  CASE
    WHEN occurrence_date < CURRENT_DATE THEN 'Past'
    WHEN occurrence_date = CURRENT_DATE THEN 'Today'
    ELSE 'Future'
  END as date_category
FROM fn_expand_recurrence_dates(
  (CURRENT_DATE - INTERVAL '30 days')::date,  -- explicit date cast
  'FREQ=DAILY;INTERVAL=1',
  NULL,
  '[]'::jsonb,
  7,
  30
)
ORDER BY occurrence_date;

-- ============================================================================
-- SECTION 13: EMERGENCY DIAGNOSTIC
-- ============================================================================

-- If timeline activation is failing, run this:
DO $$
DECLARE
  v_user_id uuid;
  v_cycle_id uuid;
BEGIN
  v_user_id := auth.uid();

  RAISE NOTICE '====== TIMELINE ACTIVATION DIAGNOSTIC ======';
  RAISE NOTICE 'Your user ID: %', v_user_id;

  -- Check if user exists
  IF v_user_id IS NULL THEN
    RAISE NOTICE '✗ NOT AUTHENTICATED - Log in first!';
    RETURN;
  END IF;

  -- Get first active cycle
  SELECT id INTO v_cycle_id
  FROM "0008-ap-global-cycles"
  WHERE is_active = true
  ORDER BY start_date
  LIMIT 1;

  IF v_cycle_id IS NULL THEN
    RAISE NOTICE '✗ No active global cycles found';
    RETURN;
  END IF;

  RAISE NOTICE '✓ Found active cycle: %', v_cycle_id;

  -- Check if already activated
  IF EXISTS (
    SELECT 1 FROM "0008-ap-user-global-timelines"
    WHERE user_id = v_user_id AND global_cycle_id = v_cycle_id
  ) THEN
    RAISE NOTICE '✓ You already have this cycle activated';
  ELSE
    RAISE NOTICE '○ This cycle is not yet activated for you';
  END IF;

  -- Check if weeks exist
  IF EXISTS (
    SELECT 1 FROM "0008-ap-global-weeks"
    WHERE global_cycle_id = v_cycle_id
    LIMIT 1
  ) THEN
    RAISE NOTICE '✓ Weeks exist for this cycle';
  ELSE
    RAISE NOTICE '✗ No weeks generated for this cycle';
  END IF;

  RAISE NOTICE '=============================================';
END $$;

-- ============================================================================
-- SUMMARY
-- ============================================================================

-- Quick health check
SELECT
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name LIKE '0008-ap-%') as tables,
  (SELECT COUNT(*) FROM pg_proc WHERE proname LIKE 'fn_%') as functions,
  (SELECT COUNT(*) FROM information_schema.views WHERE table_schema = 'public') as views,
  (SELECT COUNT(*) FROM "0008-ap-domains") as wellness_domains,
  (SELECT COUNT(*) FROM "0008-ap-global-cycles") as global_cycles,
  (SELECT COUNT(*) FROM "0008-ap-tasks" WHERE user_id = auth.uid()) as your_tasks,
  CASE
    WHEN auth.uid() IS NOT NULL THEN '✓'
    ELSE '✗'
  END as authenticated;
