-- ============================================================
-- PHASE 3: Index optimization for goal tables
--
-- goals-1y: Add composite indexes for new north_star_id column
-- goals-12wk: Already well-indexed (user_id, status, archived, global_cycle, unique title)
-- goals-custom: Already well-indexed (user_id, status, archived, dates, parent, timeline)
-- universal-goals-join: New indexes created in Phase 2
-- ============================================================

-- ============================================================
-- PRE-MIGRATION VERIFICATION (run before executing)
-- ============================================================
-- Current index count per table:
--   SELECT tablename, COUNT(*) as idx_count
--   FROM pg_indexes
--   WHERE tablename IN (
--     '0008-ap-goals-12wk', '0008-ap-goals-1y',
--     '0008-ap-goals-custom', '0008-ap-universal-goals-join'
--   )
--   GROUP BY tablename ORDER BY tablename;
-- ============================================================

BEGIN;

-- -------------------------------------------------------
-- goals-1y: Add index for north_star_id lookups
-- Supports: "show all 1y goals linked to this north star"
-- -------------------------------------------------------
CREATE INDEX idx_goals_1y_user_north_star
  ON "0008-ap-goals-1y" (user_id, north_star_id)
  WHERE north_star_id IS NOT NULL;

-- -------------------------------------------------------
-- goals-1y: The existing idx_goals_1y_user_status already
-- covers (user_id, status) WHERE archived_at IS NULL.
-- No changes needed there.
-- -------------------------------------------------------

-- -------------------------------------------------------
-- goals-12wk: Audit of existing indexes — all healthy
--
--   0008-ap-goals-12wk_pkey          -> (id)                    PK
--   0008-ap-goals-12wk_user_id_idx   -> (user_id)              base lookup
--   ap_goals_archived_idx            -> (archived)              filter
--   ap_goals_global_cycle_idx        -> (global_cycle_id)       cycle lookup
--   ap_goals_unique_title_per_cycle  -> (user_id, timeline, lower(title))  unique
--   ap_goals_user_cycle_idx          -> (user_global_timeline_id)  timeline
--   ap_goals_user_status_idx         -> (user_id, status)       common query
--
-- No changes needed.
-- -------------------------------------------------------

-- -------------------------------------------------------
-- goals-custom: Audit of existing indexes — all healthy
--
--   0008-ap-goals-custom_pkey           -> (id)                 PK
--   idx_custom_goals_archived           -> (archived)           filter
--   idx_custom_goals_dates              -> (start_date, end_date)  date range
--   idx_custom_goals_parent             -> (parent_goal_id) WHERE NOT NULL
--   idx_custom_goals_status             -> (status)             filter
--   idx_custom_goals_user_id            -> (user_id)            base lookup
--   idx_goals_custom_custom_timeline    -> (custom_timeline_id) timeline
--
-- No changes needed.
-- -------------------------------------------------------

-- -------------------------------------------------------
-- universal-goals-join: Phase 2 already created:
--   idx_goals_join_goal_id              -> (goal_id)
--   idx_goals_join_goal_type_goal_id    -> (goal_type, goal_id)
--   ux_goals_join_parent_goal           -> (parent_id, parent_type, goal_id, goal_type) UNIQUE
--
-- Surviving from original:
--   0008-ap-universal-goals-join_pkey                    -> (id)
--   0008-ap-universal-goals-join_user_id_idx             -> (user_id)
--   0008-ap-universal-goals-join_parent_id_parent_type_idx -> (parent_id, parent_type)
--   goals_join_parent_type_id_idx                        -> (parent_type, parent_id)
--
-- The last two are similar but column order differs (useful for different query patterns).
-- No changes needed.
-- -------------------------------------------------------

COMMIT;

-- ============================================================
-- POST-MIGRATION VERIFICATION
-- ============================================================
-- Final index inventory:
--   SELECT tablename, indexname, indexdef
--   FROM pg_indexes
--   WHERE tablename IN (
--     '0008-ap-goals-12wk', '0008-ap-goals-1y',
--     '0008-ap-goals-custom', '0008-ap-universal-goals-join'
--   )
--   ORDER BY tablename, indexname;
--
-- Expected index counts:
--   goals-12wk:            7 (unchanged)
--   goals-1y:              3 (pkey + user_status + NEW user_north_star)
--   goals-custom:          7 (unchanged)
--   universal-goals-join:  7 (pkey + user_id + parent_id_type + parent_type_id
--                              + NEW goal_id + NEW goal_type_goal_id + NEW unique)
-- ============================================================
