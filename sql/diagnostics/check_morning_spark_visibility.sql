-- DIAGNOSTIC: Check why Morning Spark button is not showing
-- Run this script to see what's preventing the button from appearing

-- 1. Check current time
SELECT
  now() AS current_timestamp,
  now()::time AS current_time,
  '00:00:00'::time AS morning_spark_starts,
  '12:00:00'::time AS morning_spark_ends,
  CASE
    WHEN now()::time >= '00:00:00'::time AND now()::time <= '12:00:00'::time
    THEN 'YES - Within time window'
    ELSE 'NO - Outside time window (need to be between midnight and noon)'
  END AS is_within_time_window;

-- 2. Check if user has ritual settings
SELECT
  'User Ritual Settings' AS check_type,
  COUNT(*) AS settings_count,
  CASE
    WHEN COUNT(*) > 0 THEN 'Settings exist'
    ELSE 'NO SETTINGS - This could be the problem!'
  END AS status
FROM "0008-ap-user-ritual-settings"
WHERE ritual_type = 'morning_spark'
  AND user_id = auth.uid();

-- 3. Show current ritual settings (if any)
SELECT
  ritual_type,
  is_enabled,
  available_from,
  available_until,
  created_at
FROM "0008-ap-user-ritual-settings"
WHERE user_id = auth.uid()
  AND ritual_type = 'morning_spark';

-- 4. Check if Morning Spark was already completed today
SELECT
  'Morning Spark Completion' AS check_type,
  CASE
    WHEN COUNT(*) > 0 THEN 'ALREADY COMPLETED - Button will not show'
    ELSE 'Not completed yet - Button should show'
  END AS status,
  MAX(spark_date) AS last_spark_date,
  MAX(created_at) AS last_spark_time
FROM "0008-ap-daily-sparks"
WHERE user_id = auth.uid()
  AND spark_date = CURRENT_DATE;

-- 5. Show all Morning Sparks from last 7 days
SELECT
  spark_date,
  fuel_level,
  mode,
  created_at
FROM "0008-ap-daily-sparks"
WHERE user_id = auth.uid()
  AND spark_date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY spark_date DESC;

-- SUMMARY: The button will only show if ALL of these are true:
-- ✅ Current time is between 00:00 and 12:00
-- ✅ Ritual settings exist and is_enabled = true
-- ✅ You have NOT completed Morning Spark today
