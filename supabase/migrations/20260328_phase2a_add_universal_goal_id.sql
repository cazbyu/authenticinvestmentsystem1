-- ============================================================
-- PHASE 2a: Add universal goal_id to join table (non-destructive)
--
-- Adds goal_id column, populates from type-specific columns,
-- validates, and sets NOT NULL. Does NOT drop old columns yet —
-- Phase 0 (views/functions) runs next, then Phase 2b drops them.
--
-- Execution order: Phase 1 → Phase 2a → Phase 0 → Phase 2b → Phase 3
-- ============================================================

-- ============================================================
-- PRE-MIGRATION VERIFICATION (run before executing)
-- ============================================================
-- Verify row count and distribution:
--   SELECT COUNT(*) as total,
--     COUNT(twelve_wk_goal_id) as twelve_wk_rows,
--     COUNT(custom_goal_id) as custom_rows,
--     COUNT(*) FILTER (WHERE twelve_wk_goal_id IS NOT NULL AND custom_goal_id IS NOT NULL) as both_set
--   FROM "0008-ap-universal-goals-join";
--   -- Expected: total=806, twelve_wk=558, custom=248, both_set=0
--
-- Verify goal_type labels match FK columns:
--   SELECT COUNT(*) FROM "0008-ap-universal-goals-join"
--   WHERE (goal_type = 'twelve_wk_goal' AND twelve_wk_goal_id IS NULL)
--      OR (goal_type = 'custom_goal' AND custom_goal_id IS NULL);
--   -- Expected: 0 (no mismatches)
-- ============================================================

BEGIN;

-- Step 1: Add the universal goal_id column
ALTER TABLE "0008-ap-universal-goals-join"
  ADD COLUMN goal_id uuid;

-- Step 2: Populate goal_id from the type-specific columns
UPDATE "0008-ap-universal-goals-join"
SET goal_id = CASE
  WHEN goal_type = 'twelve_wk_goal' THEN twelve_wk_goal_id
  WHEN goal_type = 'custom_goal' THEN custom_goal_id
END;

-- Step 3: Verify all 806 rows got a goal_id (no nulls)
DO $$
DECLARE
  null_count integer;
BEGIN
  SELECT COUNT(*) INTO null_count
  FROM "0008-ap-universal-goals-join"
  WHERE goal_id IS NULL;

  IF null_count > 0 THEN
    RAISE EXCEPTION 'SAFETY CHECK FAILED: % rows have NULL goal_id after migration', null_count;
  END IF;
END $$;

-- Step 4: Make goal_id NOT NULL now that all rows are populated
ALTER TABLE "0008-ap-universal-goals-join"
  ALTER COLUMN goal_id SET NOT NULL;

COMMIT;

-- ============================================================
-- POST-MIGRATION VERIFICATION
-- ============================================================
-- goal_id populated for all rows:
--   SELECT COUNT(*) FROM "0008-ap-universal-goals-join" WHERE goal_id IS NOT NULL;
--   -- Expected: 806
--
-- Old columns still present (needed until Phase 0 updates views):
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = '0008-ap-universal-goals-join'
--   AND column_name IN ('twelve_wk_goal_id', 'custom_goal_id', 'goal_id');
--   -- Expected: all three present
--
-- goal_id matches the type-specific column for every row:
--   SELECT COUNT(*) FROM "0008-ap-universal-goals-join"
--   WHERE (goal_type = 'twelve_wk_goal' AND goal_id != twelve_wk_goal_id)
--      OR (goal_type = 'custom_goal' AND goal_id != custom_goal_id);
--   -- Expected: 0
-- ============================================================
