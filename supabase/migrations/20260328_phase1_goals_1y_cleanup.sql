-- ============================================================
-- PHASE 1: goals-1y cleanup
-- 1a. Delete duplicate "Bench 225lbs" row
-- 1b. Add nullable north_star_id FK
-- 1c. Populate north_star_id for users who have both
-- 1d. Fix timestamp columns to timestamptz
-- ============================================================

-- ============================================================
-- PRE-MIGRATION VERIFICATION (run before executing)
-- ============================================================
-- Verify row count is 8 and duplicate still exists:
--   SELECT COUNT(*) FROM "0008-ap-goals-1y";
--   SELECT id, title, created_at FROM "0008-ap-goals-1y" WHERE title ILIKE '%bench 225%';
--
-- Verify no children point to the duplicate:
--   SELECT COUNT(*) FROM "0008-ap-goals-12wk" WHERE parent_goal_id = '7d109f76-b69d-4b99-a449-f500f11d9ef4';
--   SELECT COUNT(*) FROM "0008-ap-goals-custom" WHERE parent_goal_id = '7d109f76-b69d-4b99-a449-f500f11d9ef4';
--
-- Verify timestamp types before conversion:
--   SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = '0008-ap-goals-1y' AND column_name IN ('created_at','updated_at','archived_at');
-- ============================================================

BEGIN;

-- 1a. Delete the duplicate "Bench 225lbs" (second row, created 11s after first, zero children)
DELETE FROM "0008-ap-goals-1y"
WHERE id = '7d109f76-b69d-4b99-a449-f500f11d9ef4';

-- 1b. Add nullable north_star_id FK to goals-1y
ALTER TABLE "0008-ap-goals-1y"
  ADD COLUMN north_star_id uuid REFERENCES "0008-ap-north-star"(id) ON DELETE SET NULL;

-- 1c. Populate north_star_id for users who have matching north-star records
-- (3 users: 991a4c4c, ba790ccc, 3ffc2a4e — the other 2 users have no north-star record)
UPDATE "0008-ap-goals-1y" g
SET north_star_id = ns.id
FROM "0008-ap-north-star" ns
WHERE ns.user_id = g.user_id;

-- 1d. Fix timestamp inconsistency — convert to timestamptz
-- (created_at, updated_at, archived_at are currently 'timestamp without time zone')
-- (follow_up_reminder and followed_up_at are already timestamptz — no change needed)
ALTER TABLE "0008-ap-goals-1y"
  ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC',
  ALTER COLUMN archived_at TYPE timestamptz USING archived_at AT TIME ZONE 'UTC';

COMMIT;

-- ============================================================
-- POST-MIGRATION VERIFICATION
-- ============================================================
-- Row count should be 7:
--   SELECT COUNT(*) FROM "0008-ap-goals-1y";
--
-- north_star_id populated for 5 rows (3 non-null, 2 null):
--   SELECT id, title, north_star_id,
--     CASE WHEN north_star_id IS NOT NULL THEN 'linked' ELSE 'orphan' END as ns_status
--   FROM "0008-ap-goals-1y";
--
-- Timestamp types confirmed:
--   SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = '0008-ap-goals-1y' AND column_name IN ('created_at','updated_at','archived_at');
--   -- All three should show 'timestamp with time zone'
-- ============================================================
