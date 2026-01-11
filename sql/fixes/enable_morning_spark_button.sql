-- FIX: Enable Morning Spark Button
-- This script will ensure your ritual settings are created and enabled

-- 1. Create/Update Morning Spark settings to be available 24 hours for testing
INSERT INTO "0008-ap-user-ritual-settings" (
  user_id,
  ritual_type,
  is_enabled,
  available_from,
  available_until
)
VALUES (
  auth.uid(),
  'morning_spark',
  true,
  '00:00:00'::time,  -- Change to '00:00:00' for 24-hour availability
  '23:59:59'::time   -- Change to '12:00:00' to restore normal noon cutoff
)
ON CONFLICT (user_id, ritual_type)
DO UPDATE SET
  is_enabled = true,
  available_from = '00:00:00'::time,
  available_until = '23:59:59'::time,
  updated_at = now();

-- 2. Create Evening Review settings
INSERT INTO "0008-ap-user-ritual-settings" (
  user_id,
  ritual_type,
  is_enabled,
  available_from,
  available_until
)
VALUES (
  auth.uid(),
  'evening_review',
  true,
  '17:00:00'::time,
  '23:59:59'::time
)
ON CONFLICT (user_id, ritual_type)
DO UPDATE SET
  is_enabled = true,
  available_from = '17:00:00'::time,
  available_until = '23:59:59'::time,
  updated_at = now();

-- 3. Create Weekly Alignment settings
INSERT INTO "0008-ap-user-ritual-settings" (
  user_id,
  ritual_type,
  is_enabled,
  available_from,
  available_until
)
VALUES (
  auth.uid(),
  'weekly_alignment',
  true,
  '00:00:00'::time,
  '23:59:59'::time
)
ON CONFLICT (user_id, ritual_type)
DO UPDATE SET
  is_enabled = true,
  available_from = '00:00:00'::time,
  available_until = '23:59:59'::time,
  updated_at = now();

-- Verify the settings were created
SELECT
  ritual_type,
  is_enabled,
  available_from,
  available_until,
  'Settings updated successfully!' AS status
FROM "0008-ap-user-ritual-settings"
WHERE user_id = auth.uid()
ORDER BY ritual_type;
