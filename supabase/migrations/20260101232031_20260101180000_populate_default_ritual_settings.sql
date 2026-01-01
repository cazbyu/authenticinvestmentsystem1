/*
  # Populate Default Ritual Settings for Existing Users

  1. Purpose
    - Ensures all users have default ritual settings created
    - Fixes issue where ritual buttons don't show on dashboard

  2. Changes
    - Inserts default settings for morning_spark, evening_review, and weekly_alignment
    - Only creates settings for users who don't have them yet
    - Uses ON CONFLICT to handle duplicates gracefully

  3. Default Settings
    - Morning Spark: Enabled, 00:00 - 12:00
    - Evening Review: Enabled, 17:00 - 23:59:59
    - Weekly Alignment: Enabled, 00:00 - 23:59:59

  4. Notes
    - Safe to run multiple times (idempotent)
    - Will not overwrite existing user settings
*/

-- Insert default ritual settings for all users who don't have them
INSERT INTO "0008-ap-user-ritual-settings" (
  user_id,
  ritual_type,
  is_enabled,
  available_from,
  available_until,
  created_at,
  updated_at
)
SELECT
  u.id as user_id,
  ritual_type,
  true as is_enabled,
  CASE 
    WHEN ritual_type = 'morning_spark' THEN '00:00:00'::time
    WHEN ritual_type = 'evening_review' THEN '17:00:00'::time
    WHEN ritual_type = 'weekly_alignment' THEN '00:00:00'::time
  END as available_from,
  CASE 
    WHEN ritual_type = 'morning_spark' THEN '12:00:00'::time
    WHEN ritual_type = 'evening_review' THEN '23:59:59'::time
    WHEN ritual_type = 'weekly_alignment' THEN '23:59:59'::time
  END as available_until,
  now() as created_at,
  now() as updated_at
FROM "0008-ap-users" u
CROSS JOIN (
  VALUES 
    ('morning_spark'::text),
    ('evening_review'::text),
    ('weekly_alignment'::text)
) AS ritual_types(ritual_type)
WHERE NOT EXISTS (
  SELECT 1
  FROM "0008-ap-user-ritual-settings" rs
  WHERE rs.user_id = u.id
    AND rs.ritual_type = ritual_types.ritual_type
)
ON CONFLICT (user_id, ritual_type) DO NOTHING;

-- Verify the settings were created
DO $$
DECLARE
  total_users INTEGER;
  users_with_settings INTEGER;
  total_settings INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_users FROM "0008-ap-users";
  
  SELECT COUNT(DISTINCT user_id) INTO users_with_settings 
  FROM "0008-ap-user-ritual-settings";
  
  SELECT COUNT(*) INTO total_settings 
  FROM "0008-ap-user-ritual-settings";
  
  RAISE NOTICE 'Total users: %', total_users;
  RAISE NOTICE 'Users with ritual settings: %', users_with_settings;
  RAISE NOTICE 'Total ritual settings: %', total_settings;
  RAISE NOTICE 'Expected settings per user: 3 (morning_spark, evening_review, weekly_alignment)';
END $$;
