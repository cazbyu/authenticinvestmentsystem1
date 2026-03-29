-- ============================================================
-- FIX: Remove duplicate insert_parent triggers
--
-- goals-12wk had 2 triggers calling insert_parent('goal') on INSERT
-- goals-custom had 3 triggers calling insert_parent('goal') on INSERT
--
-- These caused 34 duplicate rows in universal-goals-join (cleaned in Phase 2b).
-- After Phase 2b added a UNIQUE constraint, the duplicates would cause
-- 23505 unique_violation errors on every goal INSERT — blocking production.
--
-- Keep: trg_insert_parent_goal_12wk (canonical naming)
-- Keep: trg_insert_parent_goal_custom (canonical naming)
-- Drop: 3 duplicates with abbreviated/variant names
-- ============================================================

DROP TRIGGER trg_insert_parent_goal12 ON "0008-ap-goals-12wk";
DROP TRIGGER trg_insert_parent_goalcust ON "0008-ap-goals-custom";
DROP TRIGGER trg_insert_parent_goalcustom ON "0008-ap-goals-custom";

-- ============================================================
-- POST-MIGRATION VERIFICATION
-- ============================================================
-- Exactly 2 insert_parent triggers remain:
--   SELECT trigger_name, event_object_table
--   FROM information_schema.triggers
--   WHERE trigger_name ILIKE '%insert_parent%'
--   AND event_object_table IN ('0008-ap-goals-12wk', '0008-ap-goals-custom');
--   -- Expected: trg_insert_parent_goal_12wk, trg_insert_parent_goal_custom
--
-- Test INSERT completes without unique_violation:
--   BEGIN;
--   INSERT INTO "0008-ap-goals-12wk" (id, user_id, title, status, created_at, updated_at)
--   VALUES (gen_random_uuid(), '<existing_user_id>', 'Test goal', 'active', now(), now());
--   ROLLBACK;
-- ============================================================
