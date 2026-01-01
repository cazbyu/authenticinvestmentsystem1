-- Check ritual settings table
SELECT
  id,
  user_id,
  ritual_type,
  is_enabled,
  available_from,
  available_until,
  created_at
FROM "0008-ap-user-ritual-settings"
ORDER BY created_at DESC
LIMIT 10;

-- Count users with ritual settings
SELECT
  COUNT(DISTINCT user_id) as users_with_settings,
  COUNT(*) as total_settings
FROM "0008-ap-user-ritual-settings";

-- Check which users have which ritual types
SELECT
  user_id,
  COUNT(*) as ritual_count,
  STRING_AGG(ritual_type::text, ', ') as ritual_types
FROM "0008-ap-user-ritual-settings"
GROUP BY user_id;

-- Check if there are any users without ritual settings
SELECT
  u.id as user_id,
  u.email,
  u.created_at
FROM "0008-ap-users" u
LEFT JOIN "0008-ap-user-ritual-settings" rs ON rs.user_id = u.id
WHERE rs.id IS NULL
LIMIT 10;
