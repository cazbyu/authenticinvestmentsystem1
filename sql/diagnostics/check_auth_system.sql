-- Database Authentication System Diagnostic Script
-- Run this in Supabase SQL Editor to check the current state of your auth system

-- =============================================================================
-- 1. CHECK TABLE SCHEMA
-- =============================================================================
SELECT
  '1. TABLE SCHEMA CHECK' as diagnostic_section,
  '===================' as separator;

SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = '0008-ap-users'
ORDER BY ordinal_position;

-- =============================================================================
-- 2. CHECK TRIGGERS
-- =============================================================================
SELECT
  '2. TRIGGER CHECK' as diagnostic_section,
  '================' as separator;

SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_timing
FROM information_schema.triggers
WHERE event_object_table = 'users'
  AND event_object_schema = 'auth'
  AND trigger_name LIKE '%profile%';

-- =============================================================================
-- 3. CHECK TRIGGER FUNCTION
-- =============================================================================
SELECT
  '3. TRIGGER FUNCTION CHECK' as diagnostic_section,
  '=========================' as separator;

SELECT
  proname as function_name,
  prosecdef as is_security_definer,
  prorettype::regtype as return_type
FROM pg_proc
WHERE proname IN ('handle_new_user_profile', 'create_user_profile_for_new_user');

-- =============================================================================
-- 4. CHECK RLS POLICIES
-- =============================================================================
SELECT
  '4. RLS POLICIES CHECK' as diagnostic_section,
  '=====================' as separator;

SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual as using_expression,
  with_check as check_expression
FROM pg_policies
WHERE tablename = '0008-ap-users'
ORDER BY policyname;

-- =============================================================================
-- 5. CHECK TABLE STATUS
-- =============================================================================
SELECT
  '5. TABLE STATUS CHECK' as diagnostic_section,
  '=====================' as separator;

SELECT
  relname as table_name,
  relrowsecurity as rls_enabled,
  relforcerowsecurity as rls_forced
FROM pg_class
WHERE relname = '0008-ap-users';

-- =============================================================================
-- 6. CHECK INDEXES
-- =============================================================================
SELECT
  '6. INDEXES CHECK' as diagnostic_section,
  '=================' as separator;

SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = '0008-ap-users'
ORDER BY indexname;

-- =============================================================================
-- 7. COUNT EXISTING PROFILES
-- =============================================================================
SELECT
  '7. PROFILE COUNT CHECK' as diagnostic_section,
  '======================' as separator;

SELECT
  COUNT(*) as total_profiles,
  COUNT(DISTINCT oauth_provider) as distinct_providers,
  oauth_provider,
  COUNT(*) as count_by_provider
FROM "0008-ap-users"
GROUP BY oauth_provider
ORDER BY count_by_provider DESC;

-- =============================================================================
-- 8. CHECK FOR ORPHANED AUTH USERS (users without profiles)
-- =============================================================================
SELECT
  '8. ORPHANED USERS CHECK' as diagnostic_section,
  '=======================' as separator;

SELECT
  COUNT(*) as users_without_profiles
FROM auth.users au
LEFT JOIN "0008-ap-users" ap ON au.id = ap.user_id
WHERE ap.id IS NULL;

-- =============================================================================
-- 9. SAMPLE RECENT PROFILES
-- =============================================================================
SELECT
  '9. RECENT PROFILES CHECK' as diagnostic_section,
  '========================' as separator;

SELECT
  id,
  user_id,
  first_name,
  last_name,
  oauth_provider,
  profile_image_source,
  created_at
FROM "0008-ap-users"
ORDER BY created_at DESC
LIMIT 5;

-- =============================================================================
-- 10. CHECK STORAGE POLICIES
-- =============================================================================
SELECT
  '10. STORAGE POLICIES CHECK' as diagnostic_section,
  '==========================' as separator;

SELECT
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname LIKE '%profile%'
ORDER BY policyname;

-- =============================================================================
-- SUMMARY
-- =============================================================================
SELECT
  'DIAGNOSTIC COMPLETE' as status,
  'Review results above' as next_step;
