-- ============================================================
-- PHASE 2b: Drop old type-specific columns and add new indexes
--
-- Runs AFTER Phase 0 has updated all views/functions to use goal_id.
-- Safe to drop twelve_wk_goal_id and custom_goal_id now.
--
-- Execution order: Phase 1 → Phase 2a → Phase 0 → Phase 2b → Phase 3
-- ============================================================

-- ============================================================
-- PRE-MIGRATION VERIFICATION (run before executing)
-- ============================================================
-- Verify views are already using goal_id (not old columns):
--   SELECT view_definition FROM information_schema.views
--   WHERE table_name = 'v_goal_detail_actions'
--   AND view_definition ILIKE '%twelve_wk_goal_id%';
--   -- Expected: 0 rows (view no longer references old column)
--
-- Verify goal_id is populated and NOT NULL:
--   SELECT COUNT(*) FROM "0008-ap-universal-goals-join" WHERE goal_id IS NULL;
--   -- Expected: 0
--
-- Verify old columns still exist (about to drop):
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = '0008-ap-universal-goals-join'
--   AND column_name IN ('twelve_wk_goal_id', 'custom_goal_id');
--   -- Expected: 2 rows
-- ============================================================

BEGIN;

-- Step 1: Drop old type-specific FK columns
ALTER TABLE "0008-ap-universal-goals-join"
  DROP COLUMN twelve_wk_goal_id,
  DROP COLUMN custom_goal_id;

-- Step 2: Drop old indexes that referenced removed columns
DROP INDEX IF EXISTS "0008-ap-universal-goals-join_goal_id_idx";    -- was on twelve_wk_goal_id
DROP INDEX IF EXISTS "universal_goals_join_unique";                  -- was on (parent_id, parent_type, twelve_wk_goal_id)
DROP INDEX IF EXISTS "ux_univ_goals_parent_goal";                   -- duplicate of above

-- Step 3: Drop duplicate parent indexes (keep one)
DROP INDEX IF EXISTS "goals_join_ptype_pid_idx";                    -- duplicate of goals_join_parent_type_id_idx

-- Step 4: Create new indexes for the universal structure
CREATE INDEX idx_goals_join_goal_id
  ON "0008-ap-universal-goals-join" (goal_id);

CREATE INDEX idx_goals_join_goal_type_goal_id
  ON "0008-ap-universal-goals-join" (goal_type, goal_id);

CREATE UNIQUE INDEX ux_goals_join_parent_goal
  ON "0008-ap-universal-goals-join" (parent_id, parent_type, goal_id, goal_type);

-- Step 5: Add CHECK constraint for valid goal_type values
ALTER TABLE "0008-ap-universal-goals-join"
  ADD CONSTRAINT chk_goal_type CHECK (goal_type IN ('twelve_wk_goal', 'custom_goal'));

-- Step 6: Add CHECK constraint for valid parent_type values
ALTER TABLE "0008-ap-universal-goals-join"
  ADD CONSTRAINT chk_parent_type CHECK (parent_type IN ('task', 'reflection', 'note', 'deposit_idea'));

COMMIT;

-- ============================================================
-- POST-MIGRATION VERIFICATION
-- ============================================================
-- Row count preserved:
--   SELECT COUNT(*) FROM "0008-ap-universal-goals-join";
--   -- Expected: 806
--
-- Final column list (old columns gone):
--   SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = '0008-ap-universal-goals-join' ORDER BY ordinal_position;
--   -- Expected: id, user_id, parent_type, parent_id, created_at, goal_type, goal_id
--
-- Distribution preserved:
--   SELECT goal_type, COUNT(*) FROM "0008-ap-universal-goals-join" GROUP BY goal_type;
--   -- Expected: twelve_wk_goal=558, custom_goal=248
--
-- No duplicate indexes:
--   SELECT indexname FROM pg_indexes
--   WHERE tablename = '0008-ap-universal-goals-join' ORDER BY indexname;
-- ============================================================
