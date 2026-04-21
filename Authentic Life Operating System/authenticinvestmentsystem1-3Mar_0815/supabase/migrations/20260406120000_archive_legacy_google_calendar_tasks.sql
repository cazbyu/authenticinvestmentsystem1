-- ============================================================================
-- Migration: Archive legacy Google Calendar events from 0008-ap-tasks
-- Date:      2026-04-06
-- Branch:    20Mar_1115
-- Author:    Paul Cazier + Claude
-- ============================================================================
--
-- BACKGROUND
-- ----------
-- Before March 22, 2026, the Google Calendar sync wrote imported events into
-- `0008-ap-tasks` with type='event'. The March 27 migration (commit 555c111)
-- extracted the 6 external_* columns into `0008-ap-task-external-sync` and
-- the new sync now writes to `0008-ap-commitments` instead.
--
-- The 972 legacy type='event' rows in 0008-ap-tasks are orphaned:
--   - 824 pending, 140 completed, 8 cancelled
--   - Spread across 10 users
--   - 799 of them have a matching row in 0008-ap-task-external-sync
--   - 173 have NO external-sync row (earliest imports before that table existed)
--   - 22 are already soft-deleted (deleted_at IS NOT NULL)
--
-- Additionally, 4 user-created type='event' rows exist AFTER March 22
-- (titles: "Project Hail Mary" x2, "Drive to California to Get RAV4",
-- "Drive Home"). These are NOT Google imports — they are intentional user
-- events and MUST be preserved.
--
-- ORPHANED JOIN TABLE ROWS (will be cleaned up alongside)
-- -------------------------------------------------------
--   0008-ap-universal-roles-join:             246 rows
--   0008-ap-universal-domains-join:           306 rows
--   0008-ap-universal-goals-join:               4 rows
--   0008-ap-universal-notes-join:              67 rows
--   0008-ap-universal-key-relationships-join: 216 rows
--   0008-ap-universal-delegates-join:           1 row
--   0008-ap-task-external-sync:               799 rows
--                                        Total: 1,639 join/sync rows
--
-- STRATEGY
-- --------
-- 1. Soft-archive: SET status='archived', deleted_at=NOW() on all 972 legacy
--    event rows. This preserves the data for auditing while hiding them from
--    all app queries (which filter on status != 'archived' or deleted_at IS NULL).
-- 2. Delete orphaned join table rows whose parent_id no longer points to an
--    active task.
-- 3. Delete orphaned external-sync rows.
--
-- The 4 post-March-22 user-created events are excluded by the created_at
-- cutoff and will not be touched.
--
-- ============================================================================

-- Wrap everything in a transaction so it's all-or-nothing
BEGIN;

-- ============================================================================
-- STEP 0: DRY-RUN COUNTS (run these SELECT statements first to verify)
-- ============================================================================
-- Uncomment this block and run it BEFORE the migration to confirm counts.

-- -- Legacy event tasks that will be archived
-- SELECT 'legacy_events_to_archive' AS label,
--        COUNT(*) AS cnt,
--        COUNT(*) FILTER (WHERE status = 'pending')   AS pending,
--        COUNT(*) FILTER (WHERE status = 'completed')  AS completed,
--        COUNT(*) FILTER (WHERE status = 'cancelled')  AS cancelled,
--        COUNT(*) FILTER (WHERE deleted_at IS NOT NULL) AS already_soft_deleted
-- FROM "0008-ap-tasks"
-- WHERE type = 'event'
--   AND created_at < '2026-03-22T00:00:00Z';
--
-- -- Post-March-22 events that will be PRESERVED (sanity check — should be 4)
-- SELECT 'post_cutoff_events_preserved' AS label,
--        COUNT(*) AS cnt
-- FROM "0008-ap-tasks"
-- WHERE type = 'event'
--   AND created_at >= '2026-03-22T00:00:00Z';
--
-- -- Orphaned join table rows that will be deleted
-- SELECT 'roles_join_orphans' AS label, COUNT(*) AS cnt
-- FROM "0008-ap-universal-roles-join" j
-- JOIN "0008-ap-tasks" t ON j.parent_id = t.id
-- WHERE t.type = 'event' AND t.created_at < '2026-03-22T00:00:00Z'
-- UNION ALL
-- SELECT 'domains_join_orphans', COUNT(*)
-- FROM "0008-ap-universal-domains-join" j
-- JOIN "0008-ap-tasks" t ON j.parent_id = t.id
-- WHERE t.type = 'event' AND t.created_at < '2026-03-22T00:00:00Z'
-- UNION ALL
-- SELECT 'goals_join_orphans', COUNT(*)
-- FROM "0008-ap-universal-goals-join" j
-- JOIN "0008-ap-tasks" t ON j.parent_id = t.id
-- WHERE t.type = 'event' AND t.created_at < '2026-03-22T00:00:00Z'
-- UNION ALL
-- SELECT 'notes_join_orphans', COUNT(*)
-- FROM "0008-ap-universal-notes-join" j
-- JOIN "0008-ap-tasks" t ON j.parent_id = t.id
-- WHERE t.type = 'event' AND t.created_at < '2026-03-22T00:00:00Z'
-- UNION ALL
-- SELECT 'key_relationships_join_orphans', COUNT(*)
-- FROM "0008-ap-universal-key-relationships-join" j
-- JOIN "0008-ap-tasks" t ON j.parent_id = t.id
-- WHERE t.type = 'event' AND t.created_at < '2026-03-22T00:00:00Z'
-- UNION ALL
-- SELECT 'delegates_join_orphans', COUNT(*)
-- FROM "0008-ap-universal-delegates-join" j
-- JOIN "0008-ap-tasks" t ON j.parent_id = t.id
-- WHERE t.type = 'event' AND t.created_at < '2026-03-22T00:00:00Z'
-- UNION ALL
-- SELECT 'external_sync_orphans', COUNT(*)
-- FROM "0008-ap-task-external-sync" s
-- JOIN "0008-ap-tasks" t ON s.task_id = t.id
-- WHERE t.type = 'event' AND t.created_at < '2026-03-22T00:00:00Z';


-- ============================================================================
-- STEP 1: Collect target task IDs into a temp table for safe referencing
-- ============================================================================
CREATE TEMP TABLE _legacy_google_event_ids AS
SELECT id
FROM "0008-ap-tasks"
WHERE type = 'event'
  AND created_at < '2026-03-22T00:00:00Z';

-- Sanity gate: abort if count is wildly different from expected 972
DO $$
DECLARE
  row_count integer;
BEGIN
  SELECT COUNT(*) INTO row_count FROM _legacy_google_event_ids;
  IF row_count < 900 OR row_count > 1100 THEN
    RAISE EXCEPTION 'SAFETY ABORT: Expected ~972 legacy event rows, found %. Investigate before proceeding.', row_count;
  END IF;
  RAISE NOTICE 'Legacy Google event rows targeted: %', row_count;
END $$;


-- ============================================================================
-- STEP 2: Delete orphaned join table rows (BEFORE archiving the parent)
-- ============================================================================

-- 2a. Roles join (~246 rows)
DELETE FROM "0008-ap-universal-roles-join"
WHERE parent_id IN (SELECT id FROM _legacy_google_event_ids);

-- 2b. Domains join (~306 rows)
DELETE FROM "0008-ap-universal-domains-join"
WHERE parent_id IN (SELECT id FROM _legacy_google_event_ids);

-- 2c. Goals join (~4 rows)
DELETE FROM "0008-ap-universal-goals-join"
WHERE parent_id IN (SELECT id FROM _legacy_google_event_ids);

-- 2d. Notes join (~67 rows)
DELETE FROM "0008-ap-universal-notes-join"
WHERE parent_id IN (SELECT id FROM _legacy_google_event_ids);

-- 2e. Key relationships join (~216 rows)
DELETE FROM "0008-ap-universal-key-relationships-join"
WHERE parent_id IN (SELECT id FROM _legacy_google_event_ids);

-- 2f. Delegates join (~1 row)
DELETE FROM "0008-ap-universal-delegates-join"
WHERE parent_id IN (SELECT id FROM _legacy_google_event_ids);


-- ============================================================================
-- STEP 3: Delete orphaned external-sync rows (~799 rows)
-- ============================================================================
DELETE FROM "0008-ap-task-external-sync"
WHERE task_id IN (SELECT id FROM _legacy_google_event_ids);


-- ============================================================================
-- STEP 4: Soft-archive the legacy event tasks (972 rows)
-- ============================================================================
UPDATE "0008-ap-tasks"
SET status     = 'archived',
    deleted_at = NOW(),
    updated_at = NOW()
WHERE id IN (SELECT id FROM _legacy_google_event_ids);


-- ============================================================================
-- STEP 5: Cleanup
-- ============================================================================
DROP TABLE _legacy_google_event_ids;

COMMIT;
