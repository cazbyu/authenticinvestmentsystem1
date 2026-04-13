-- ============================================================
-- PHASE 0: Update views and functions BEFORE column changes
--
-- 5 views and 3 functions reference twelve_wk_goal_id / custom_goal_id
-- on universal-goals-join. These must be rewritten to use the new
-- universal goal_id column BEFORE Phase 2 drops the old columns.
--
-- Strategy: Phase 2 adds goal_id and populates it BEFORE dropping
-- old columns. So Phase 0 runs AFTER Phase 2 Step 4 (goal_id exists
-- and is NOT NULL) but BEFORE Phase 2 Step 5 (old columns dropped).
--
-- HOWEVER — to keep phases atomic and independently executable,
-- we rewrite these to use goal_id (which Phase 2 creates).
-- Therefore: Phase 0 must run AFTER Phase 2 Steps 1-4 but BEFORE
-- Phase 2 Step 5.
--
-- REVISED APPROACH: We update Phase 2 to be a 2-part migration:
--   Phase 2a: Add goal_id, populate, set NOT NULL (steps 1-4)
--   Phase 0:  Update views/functions to use goal_id
--   Phase 2b: Drop old columns, indexes, add constraints (steps 5-10)
--
-- This file assumes goal_id column EXISTS and is populated on
-- universal-goals-join, but twelve_wk_goal_id and custom_goal_id
-- ALSO still exist (transitional state).
-- ============================================================

-- ============================================================
-- PRE-MIGRATION VERIFICATION
-- ============================================================
-- Verify goal_id column exists and is populated:
--   SELECT COUNT(*) FROM "0008-ap-universal-goals-join" WHERE goal_id IS NOT NULL;
--   -- Expected: 806
--
-- Verify old columns still exist (they should — Phase 2b hasn't run):
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = '0008-ap-universal-goals-join'
--   AND column_name IN ('twelve_wk_goal_id', 'custom_goal_id', 'goal_id');
--   -- Expected: all three present
-- ============================================================

BEGIN;

-- ============================================================
-- VIEW 1: v_goal_detail_actions
-- Purpose: Shows tasks linked to goals with role/domain/relationship metadata
-- Change: Replace twelve_wk_goal_id/custom_goal_id with goal_id
-- ============================================================
CREATE OR REPLACE VIEW v_goal_detail_actions AS
SELECT
  t.id AS task_id,
  t.user_id,
  t.title,
  t.description,
  t.status,
  t.type,
  t.due_date,
  t.start_date,
  t.end_date,
  t.start_time,
  t.end_time,
  t.recurrence_rule,
  t.input_kind,
  t.unit,
  t.is_urgent,
  t.is_important,
  t.completed_at,
  t.created_at,
  t.updated_at,
  t.is_all_day,
  t.is_anytime,
  t.parent_task_id,
  t.deleted_at,
  t.location,
  t.one_thing,
  t.times_rescheduled,
  gj.id AS goal_join_id,
  gj.goal_id,
  gj.goal_type AS goal_join_type,
  (SELECT COALESCE(json_agg(json_build_object('id', r.id, 'label', r.label, 'color', r.color)), '[]'::json)
   FROM "0008-ap-universal-roles-join" rj
   JOIN "0008-ap-roles" r ON rj.role_id = r.id
   WHERE rj.parent_id = t.id AND rj.parent_type = 'task') AS roles,
  (SELECT COALESCE(json_agg(json_build_object('id', d.id, 'name', d.name)), '[]'::json)
   FROM "0008-ap-universal-domains-join" dj
   JOIN "0008-ap-domains" d ON dj.domain_id = d.id
   WHERE dj.parent_id = t.id AND dj.parent_type = 'task') AS domains,
  (SELECT COALESCE(json_agg(json_build_object('id', kr.id, 'name', kr.name)), '[]'::json)
   FROM "0008-ap-universal-key-relationships-join" krj
   JOIN "0008-ap-key-relationships" kr ON krj.key_relationship_id = kr.id
   WHERE krj.parent_id = t.id AND krj.parent_type = 'task') AS key_relationships
FROM "0008-ap-tasks" t
JOIN "0008-ap-universal-goals-join" gj
  ON gj.parent_id = t.id AND gj.parent_type = 'task'
WHERE t.deleted_at IS NULL
  AND t.parent_task_id IS NULL;


-- ============================================================
-- VIEW 2: v_goal_detail_week_actions
-- Purpose: Weekly recurring goal task view with week plan data
-- Change: Replace COALESCE(twelve_wk_goal_id, custom_goal_id) with goal_id
-- ============================================================
CREATE OR REPLACE VIEW v_goal_detail_week_actions AS
SELECT
  t.id AS task_id,
  t.user_id,
  t.title,
  t.description,
  t.status,
  t.type,
  t.recurrence_rule,
  t.input_kind,
  t.unit,
  t.is_urgent,
  t.is_important,
  t.created_at,
  t.updated_at,
  t.one_thing,
  t.deleted_at,
  t.due_date,
  t.start_date,
  t.end_date,
  t.start_time,
  t.end_time,
  t.is_all_day,
  t.is_anytime,
  t.location,
  t.times_rescheduled,
  gj.goal_id,
  gj.goal_type AS goal_join_type,
  wp.week_number,
  wp.target_days,
  wp.user_global_timeline_id,
  wp.user_custom_timeline_id,
  COALESCE(wp.user_global_timeline_id, wp.user_custom_timeline_id) AS timeline_id,
  tw.week_start,
  tw.week_end,
  tw.source AS timeline_source,
  (SELECT (count(*))::integer
   FROM "0008-ap-tasks" occ
   WHERE occ.parent_task_id = t.id
     AND occ.deleted_at IS NULL
     AND occ.status = 'completed'
     AND occ.due_date >= tw.week_start
     AND occ.due_date <= tw.week_end) AS weekly_actual,
  (SELECT COALESCE(json_agg(occ.due_date ORDER BY occ.due_date), '[]'::json)
   FROM "0008-ap-tasks" occ
   WHERE occ.parent_task_id = t.id
     AND occ.deleted_at IS NULL
     AND occ.status = 'completed'
     AND occ.due_date >= tw.week_start
     AND occ.due_date <= tw.week_end) AS completed_dates,
  (SELECT COALESCE(json_agg(json_build_object(
     'id', occ.id, 'due_date', occ.due_date,
     'completed_at', occ.completed_at, 'status', occ.status
   ) ORDER BY occ.due_date), '[]'::json)
   FROM "0008-ap-tasks" occ
   WHERE occ.parent_task_id = t.id
     AND occ.deleted_at IS NULL
     AND occ.status = 'completed'
     AND occ.due_date >= tw.week_start
     AND occ.due_date <= tw.week_end) AS occurrences,
  (SELECT COALESCE(json_agg(awp.week_number ORDER BY awp.week_number), '[]'::json)
   FROM "0008-ap-task-week-plan" awp
   WHERE awp.task_id = t.id
     AND awp.deleted_at IS NULL
     AND ((wp.user_global_timeline_id IS NOT NULL
           AND awp.user_global_timeline_id = wp.user_global_timeline_id)
       OR (wp.user_custom_timeline_id IS NOT NULL
           AND awp.user_custom_timeline_id = wp.user_custom_timeline_id))) AS selected_weeks,
  (SELECT COALESCE(json_agg(json_build_object('id', r.id, 'label', r.label, 'color', r.color)), '[]'::json)
   FROM "0008-ap-universal-roles-join" rj
   JOIN "0008-ap-roles" r ON rj.role_id = r.id
   WHERE rj.parent_id = t.id AND rj.parent_type = 'task') AS roles,
  (SELECT COALESCE(json_agg(json_build_object('id', d.id, 'name', d.name)), '[]'::json)
   FROM "0008-ap-universal-domains-join" dj
   JOIN "0008-ap-domains" d ON dj.domain_id = d.id
   WHERE dj.parent_id = t.id AND dj.parent_type = 'task') AS domains,
  (SELECT COALESCE(json_agg(json_build_object('id', kr.id, 'name', kr.name)), '[]'::json)
   FROM "0008-ap-universal-key-relationships-join" krj
   JOIN "0008-ap-key-relationships" kr ON krj.key_relationship_id = kr.id
   WHERE krj.parent_id = t.id AND krj.parent_type = 'task') AS key_relationships,
  t.tracking_template,
  t.data_schema
FROM "0008-ap-tasks" t
JOIN "0008-ap-universal-goals-join" gj
  ON gj.parent_id = t.id AND gj.parent_type = 'task'
JOIN "0008-ap-task-week-plan" wp
  ON wp.task_id = t.id AND wp.deleted_at IS NULL
JOIN v_unified_timeline_weeks tw
  ON tw.week_number = wp.week_number
  AND ((wp.user_global_timeline_id IS NOT NULL
        AND tw.timeline_id = wp.user_global_timeline_id
        AND tw.source = 'global')
    OR (wp.user_custom_timeline_id IS NOT NULL
        AND tw.timeline_id = wp.user_custom_timeline_id
        AND tw.source = 'custom'))
WHERE t.deleted_at IS NULL
  AND t.parent_task_id IS NULL
  AND t.input_kind = 'count'
  AND t.status NOT IN ('completed', 'cancelled');


-- ============================================================
-- VIEW 3: 0008_v_journal
-- Purpose: Journal view combining completed tasks + withdrawals with goals
-- Change: Replace type-specific goal joins with universal goal_id join
-- ============================================================
CREATE OR REPLACE VIEW "0008_v_journal" AS
SELECT
  t.id,
  'task'::text AS entry_type,
  t.user_id,
  t.title,
  t.completed_at AS action_date,
  COALESCE(jsonb_agg(DISTINCT r.*) FILTER (WHERE r.id IS NOT NULL), '[]'::jsonb) AS roles,
  COALESCE(jsonb_agg(DISTINCT d.*) FILTER (WHERE d.id IS NOT NULL), '[]'::jsonb) AS domains,
  COALESCE(
    jsonb_agg(DISTINCT
      CASE
        WHEN ug.goal_type = 'twelve_wk_goal' THEN to_jsonb(g12.*)
        WHEN ug.goal_type = 'custom_goal' THEN to_jsonb(gc.*)
      END
    ) FILTER (WHERE COALESCE(g12.id, gc.id) IS NOT NULL),
    '[]'::jsonb
  ) AS goals,
  COALESCE(jsonb_agg(DISTINCT n.*) FILTER (WHERE n.id IS NOT NULL), '[]'::jsonb) AS notes
FROM "0008-ap-tasks" t
LEFT JOIN "0008-ap-universal-roles-join" ur
  ON ur.parent_id = t.id AND ur.parent_type = 'task'
LEFT JOIN "0008-ap-roles" r ON r.id = ur.role_id
LEFT JOIN "0008-ap-universal-domains-join" ud
  ON ud.parent_id = t.id AND ud.parent_type = 'task'
LEFT JOIN "0008-ap-domains" d ON d.id = ud.domain_id
LEFT JOIN "0008-ap-universal-goals-join" ug
  ON ug.parent_id = t.id AND ug.parent_type = 'task'
LEFT JOIN "0008-ap-goals-12wk" g12
  ON g12.id = ug.goal_id AND ug.goal_type = 'twelve_wk_goal'
LEFT JOIN "0008-ap-goals-custom" gc
  ON gc.id = ug.goal_id AND ug.goal_type = 'custom_goal'
LEFT JOIN "0008-ap-universal-notes-join" un
  ON un.parent_id = t.id AND un.parent_type = 'task'
LEFT JOIN "0008-ap-notes" n ON n.id = un.note_id
WHERE t.status = 'completed' AND t.completed_at IS NOT NULL
GROUP BY t.id, t.user_id, t.title, t.completed_at

UNION ALL

SELECT
  w.id,
  'withdrawal'::text AS entry_type,
  w.user_id,
  w.title,
  w.withdrawn_at AS action_date,
  COALESCE(jsonb_agg(DISTINCT r.*) FILTER (WHERE r.id IS NOT NULL), '[]'::jsonb) AS roles,
  COALESCE(jsonb_agg(DISTINCT d.*) FILTER (WHERE d.id IS NOT NULL), '[]'::jsonb) AS domains,
  COALESCE(
    jsonb_agg(DISTINCT
      CASE
        WHEN ug.goal_type = 'twelve_wk_goal' THEN to_jsonb(g12.*)
        WHEN ug.goal_type = 'custom_goal' THEN to_jsonb(gc.*)
      END
    ) FILTER (WHERE COALESCE(g12.id, gc.id) IS NOT NULL),
    '[]'::jsonb
  ) AS goals,
  COALESCE(jsonb_agg(DISTINCT n.*) FILTER (WHERE n.id IS NOT NULL), '[]'::jsonb) AS notes
FROM "0008-ap-withdrawals" w
LEFT JOIN "0008-ap-universal-roles-join" ur
  ON ur.parent_id = w.id AND ur.parent_type = 'withdrawal'
LEFT JOIN "0008-ap-roles" r ON r.id = ur.role_id
LEFT JOIN "0008-ap-universal-domains-join" ud
  ON ud.parent_id = w.id AND ud.parent_type = 'withdrawal'
LEFT JOIN "0008-ap-domains" d ON d.id = ud.domain_id
LEFT JOIN "0008-ap-universal-goals-join" ug
  ON ug.parent_id = w.id AND ug.parent_type = 'withdrawal'
LEFT JOIN "0008-ap-goals-12wk" g12
  ON g12.id = ug.goal_id AND ug.goal_type = 'twelve_wk_goal'
LEFT JOIN "0008-ap-goals-custom" gc
  ON gc.id = ug.goal_id AND ug.goal_type = 'custom_goal'
LEFT JOIN "0008-ap-universal-notes-join" un
  ON un.parent_id = w.id AND un.parent_type = 'withdrawal'
LEFT JOIN "0008-ap-notes" n ON n.id = un.note_id
GROUP BY w.id, w.user_id, w.title, w.withdrawn_at;


-- ============================================================
-- VIEW 4: v_daily_goal_actions
-- Purpose: Daily completed task counts per goal
-- Change: Replace COALESCE pattern with goal_id, fix joins
-- ============================================================
CREATE OR REPLACE VIEW v_daily_goal_actions AS
SELECT
  t.user_id,
  gj.goal_id,
  gj.goal_type,
  CASE
    WHEN t.parent_task_id IS NOT NULL AND t.due_date IS NOT NULL THEN t.due_date
    ELSE (t.completed_at AT TIME ZONE COALESCE(u.timezone, 'UTC'))::date
  END AS completion_date,
  count(DISTINCT t.id) AS action_count,
  CASE
    WHEN gj.goal_type = 'twelve_wk_goal' THEN tw.title
    WHEN gj.goal_type = 'custom_goal' THEN cg.title
    ELSE NULL
  END AS goal_title,
  CASE
    WHEN gj.goal_type = 'twelve_wk_goal' THEN tw.status
    WHEN gj.goal_type = 'custom_goal' THEN cg.status
    ELSE NULL
  END AS goal_status
FROM "0008-ap-tasks" t
JOIN "0008-ap-users" u ON u.id = t.user_id
JOIN "0008-ap-universal-goals-join" gj
  ON gj.parent_id = t.id AND gj.parent_type = 'task'
LEFT JOIN "0008-ap-goals-12wk" tw
  ON gj.goal_id = tw.id AND gj.goal_type = 'twelve_wk_goal'
LEFT JOIN "0008-ap-goals-custom" cg
  ON gj.goal_id = cg.id AND gj.goal_type = 'custom_goal'
WHERE t.deleted_at IS NULL
  AND t.status = 'completed'
  AND t.completed_at IS NOT NULL
GROUP BY t.user_id, gj.goal_id, gj.goal_type,
  CASE
    WHEN t.parent_task_id IS NOT NULL AND t.due_date IS NOT NULL THEN t.due_date
    ELSE (t.completed_at AT TIME ZONE COALESCE(u.timezone, 'UTC'))::date
  END,
  CASE
    WHEN gj.goal_type = 'twelve_wk_goal' THEN tw.title
    WHEN gj.goal_type = 'custom_goal' THEN cg.title
    ELSE NULL
  END,
  CASE
    WHEN gj.goal_type = 'twelve_wk_goal' THEN tw.status
    WHEN gj.goal_type = 'custom_goal' THEN cg.status
    ELSE NULL
  END;


-- ============================================================
-- VIEW 5: v_weekly_goal_actions
-- Purpose: Weekly completed task counts per goal with targets
-- Change: Replace COALESCE pattern with goal_id, fix joins
-- ============================================================
CREATE OR REPLACE VIEW v_weekly_goal_actions AS
SELECT
  t.user_id,
  gj.goal_id,
  gj.goal_type,
  get_week_start(t.user_id, t.completed_at) AS week_start_date,
  count(*) AS action_count,
  CASE
    WHEN gj.goal_type = 'twelve_wk_goal' THEN tw.title
    WHEN gj.goal_type = 'custom_goal' THEN cg.title
    ELSE NULL
  END AS goal_title,
  CASE
    WHEN gj.goal_type = 'twelve_wk_goal' THEN tw.status
    WHEN gj.goal_type = 'custom_goal' THEN cg.status
    ELSE NULL
  END AS goal_status,
  CASE
    WHEN gj.goal_type = 'twelve_wk_goal' THEN tw.weekly_target
    WHEN gj.goal_type = 'custom_goal' THEN cg.weekly_target
    ELSE NULL
  END AS weekly_target
FROM "0008-ap-tasks" t
JOIN "0008-ap-universal-goals-join" gj
  ON gj.parent_id = t.id AND gj.parent_type = 'task'
LEFT JOIN "0008-ap-goals-12wk" tw
  ON gj.goal_id = tw.id AND gj.goal_type = 'twelve_wk_goal'
LEFT JOIN "0008-ap-goals-custom" cg
  ON gj.goal_id = cg.id AND gj.goal_type = 'custom_goal'
WHERE t.completed_at IS NOT NULL
GROUP BY t.user_id, gj.goal_id, gj.goal_type,
  get_week_start(t.user_id, t.completed_at),
  CASE
    WHEN gj.goal_type = 'twelve_wk_goal' THEN tw.title
    WHEN gj.goal_type = 'custom_goal' THEN cg.title
    ELSE NULL
  END,
  CASE
    WHEN gj.goal_type = 'twelve_wk_goal' THEN tw.status
    WHEN gj.goal_type = 'custom_goal' THEN cg.status
    ELSE NULL
  END,
  CASE
    WHEN gj.goal_type = 'twelve_wk_goal' THEN tw.weekly_target
    WHEN gj.goal_type = 'custom_goal' THEN cg.weekly_target
    ELSE NULL
  END;


-- ============================================================
-- FUNCTION 1: get_daily_history_items
-- Change: Replace goal_title subquery from type-specific to universal
-- The subquery pattern changes from:
--   LEFT JOIN g12 ON g12.id = gj.twelve_wk_goal_id
--   LEFT JOIN gc  ON gc.id  = gj.custom_goal_id
-- To:
--   LEFT JOIN g12 ON g12.id = gj.goal_id AND gj.goal_type = 'twelve_wk_goal'
--   LEFT JOIN gc  ON gc.id  = gj.goal_id AND gj.goal_type = 'custom_goal'
-- ============================================================
CREATE OR REPLACE FUNCTION get_daily_history_items(
  p_user_id uuid DEFAULT NULL,
  p_target_date date DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  title text,
  type text,
  status text,
  priority text,
  points numeric,
  completed_at timestamptz,
  created_at timestamptz,
  start_time time,
  is_all_day boolean,
  parent_id uuid,
  parent_type text,
  goal_title text
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_timezone text;
BEGIN
  v_user_id := COALESCE(p_user_id, auth.uid());

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User ID is required';
  END IF;

  IF p_target_date IS NULL THEN
    RAISE EXCEPTION 'Target date is required';
  END IF;

  SELECT COALESCE(timezone, 'America/Denver')
  INTO v_timezone
  FROM "0008-ap-users"
  WHERE "0008-ap-users".id = v_user_id;

  v_timezone := COALESCE(v_timezone, 'America/Denver');

  RETURN QUERY

  -- 1. REFLECTIONS
  SELECT
    r.id,
    COALESCE(r.reflection_title,
      CASE
        WHEN r.daily_rose THEN 'Daily Rose'
        WHEN r.daily_thorn THEN 'Daily Thorn'
        ELSE 'Reflection'
      END
    ) AS title,
    CASE
      WHEN r.daily_rose THEN 'rose'
      WHEN r.daily_thorn THEN 'thorn'
      ELSE 'reflection'
    END AS type,
    'completed'::text AS status,
    'Normal'::text AS priority,
    0::numeric AS points,
    r.created_at AS completed_at,
    r.created_at,
    NULL::time AS start_time,
    FALSE AS is_all_day,
    r.parent_id,
    r.parent_type,
    NULL::text AS goal_title
  FROM "0008-ap-reflections" r
  WHERE r.user_id = v_user_id
    AND r.archived = false
    AND (
      r.date = p_target_date
      OR date(r.created_at AT TIME ZONE v_timezone) = p_target_date
    )

  UNION ALL

  -- 2. ALL COMPLETED TASKS (deduplicated by title, with goal info)
  SELECT * FROM (
    SELECT DISTINCT ON (t.title)
      t.id,
      t.title,
      'task'::text AS type,
      t.status::text,
      CASE
        WHEN t.is_urgent AND t.is_important THEN 'Do First'
        WHEN t.is_urgent AND NOT t.is_important THEN 'Delegate'
        WHEN NOT t.is_urgent AND t.is_important THEN 'Schedule'
        ELSE 'Eliminate'
      END AS priority,
      0::numeric AS points,
      t.completed_at,
      t.created_at,
      NULL::time AS start_time,
      FALSE AS is_all_day,
      t.parent_id,
      t.parent_type,
      (
        SELECT COALESCE(g12.title, gc.title)
        FROM "0008-ap-universal-goals-join" gj
        LEFT JOIN "0008-ap-goals-12wk" g12
          ON g12.id = gj.goal_id AND gj.goal_type = 'twelve_wk_goal'
        LEFT JOIN "0008-ap-goals-custom" gc
          ON gc.id = gj.goal_id AND gj.goal_type = 'custom_goal'
        WHERE gj.parent_id = t.id AND gj.parent_type = 'task'
        LIMIT 1
      ) AS goal_title
    FROM "0008-ap-tasks" t
    WHERE t.user_id = v_user_id
      AND t.type = 'task'
      AND t.deleted_at IS NULL
      AND t.status = 'completed'
      AND t.completed_at IS NOT NULL
      AND (
        CASE
          WHEN t.parent_task_id IS NOT NULL AND t.due_date IS NOT NULL
          THEN t.due_date
          ELSE date(t.completed_at AT TIME ZONE v_timezone)
        END
      ) = p_target_date
    ORDER BY t.title, t.completed_at DESC
  ) AS deduped_tasks

  UNION ALL

  -- 3. ALL COMPLETED EVENTS (deduplicated by title, with goal info)
  SELECT * FROM (
    SELECT DISTINCT ON (t.title)
      t.id,
      t.title,
      'event'::text AS type,
      t.status::text,
      'Schedule'::text AS priority,
      0::numeric AS points,
      t.completed_at,
      t.created_at,
      t.start_time,
      t.is_all_day,
      t.parent_id,
      t.parent_type,
      (
        SELECT COALESCE(g12.title, gc.title)
        FROM "0008-ap-universal-goals-join" gj
        LEFT JOIN "0008-ap-goals-12wk" g12
          ON g12.id = gj.goal_id AND gj.goal_type = 'twelve_wk_goal'
        LEFT JOIN "0008-ap-goals-custom" gc
          ON gc.id = gj.goal_id AND gj.goal_type = 'custom_goal'
        WHERE gj.parent_id = t.id AND gj.parent_type IN ('task', 'event')
        LIMIT 1
      ) AS goal_title
    FROM "0008-ap-tasks" t
    WHERE t.user_id = v_user_id
      AND t.type = 'event'
      AND t.deleted_at IS NULL
      AND t.status = 'completed'
      AND (
        t.start_date = p_target_date
        OR t.end_date = p_target_date
        OR (t.completed_at IS NOT NULL AND date(t.completed_at AT TIME ZONE v_timezone) = p_target_date)
      )
    ORDER BY t.title, t.completed_at DESC
  ) AS deduped_events

  UNION ALL

  -- 4. ALL DEPOSIT IDEAS (with goal info)
  SELECT
    di.id,
    di.title,
    'depositIdea'::text AS type,
    CASE
      WHEN di.archived THEN 'archived'
      WHEN di.is_active THEN 'active'
      ELSE 'pending'
    END AS status,
    'Idea'::text AS priority,
    0::numeric AS points,
    di.activated_at AS completed_at,
    di.created_at,
    NULL::time AS start_time,
    FALSE AS is_all_day,
    di.parent_id,
    di.parent_type,
    (
      SELECT COALESCE(g12.title, gc.title)
      FROM "0008-ap-universal-goals-join" gj
      LEFT JOIN "0008-ap-goals-12wk" g12
        ON g12.id = gj.goal_id AND gj.goal_type = 'twelve_wk_goal'
      LEFT JOIN "0008-ap-goals-custom" gc
        ON gc.id = gj.goal_id AND gj.goal_type = 'custom_goal'
      WHERE gj.parent_id = di.id AND gj.parent_type = 'depositIdea'
      LIMIT 1
    ) AS goal_title
  FROM "0008-ap-deposit-ideas" di
  WHERE di.user_id = v_user_id
    AND di.archived = false
    AND date(di.created_at AT TIME ZONE v_timezone) = p_target_date

  UNION ALL

  -- 5. ALL WITHDRAWALS
  SELECT
    w.id,
    COALESCE(NULLIF(btrim(w.title), ''), 'Withdrawal') AS title,
    'withdrawal'::text AS type,
    'completed'::text AS status,
    'Normal'::text AS priority,
    0::numeric AS points,
    COALESCE(w.withdrawn_at, w.created_at) AS completed_at,
    w.created_at,
    NULL::time AS start_time,
    FALSE AS is_all_day,
    NULL::uuid AS parent_id,
    NULL::text AS parent_type,
    NULL::text AS goal_title
  FROM "0008-ap-withdrawals" w
  WHERE w.user_id = v_user_id
    AND date(COALESCE(w.withdrawn_at, w.created_at) AT TIME ZONE v_timezone) = p_target_date

  ORDER BY completed_at DESC NULLS LAST, created_at DESC;
END;
$$;


-- ============================================================
-- FUNCTION 2: ap_copy_universal_goals_to_task
-- Purpose: Copies goal associations from one parent to a new task
-- Change: Rewrite to use universal goal_id instead of type-specific columns
-- ============================================================
CREATE OR REPLACE FUNCTION ap_copy_universal_goals_to_task(
  from_parent_id uuid,
  to_task_id uuid
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  INSERT INTO "0008-ap-universal-goals-join" (
    parent_id,
    parent_type,
    goal_id,
    goal_type,
    user_id
  )
  SELECT
    to_task_id,
    'task',
    g.goal_id,
    g.goal_type,
    uid
  FROM "0008-ap-universal-goals-join" g
  WHERE g.parent_id = from_parent_id
    AND g.parent_type = 'task';
END;
$$;


-- ============================================================
-- FUNCTION 3: get_month_dates_with_items
-- Change: Same subquery pattern as get_daily_history_items
-- Replace twelve_wk_goal_id/custom_goal_id with goal_id + goal_type
-- NOTE: This function is very large. Only the goal_title subqueries
-- change — the pattern is identical to get_daily_history_items.
-- We recreate the entire function to ensure consistency.
-- ============================================================
CREATE OR REPLACE FUNCTION get_month_dates_with_items(
  p_user_id uuid DEFAULT NULL,
  p_year integer DEFAULT NULL,
  p_month integer DEFAULT NULL
)
RETURNS TABLE(
  item_date date,
  reflections_count bigint,
  tasks_count bigint,
  events_count bigint,
  deposit_ideas_count bigint,
  withdrawals_count bigint,
  notes_count bigint,
  content_summary text,
  item_details jsonb
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_user_timezone text;
  v_start_date date;
  v_end_date date;
BEGIN
  v_user_id := COALESCE(p_user_id, auth.uid());

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User ID is required';
  END IF;

  SELECT COALESCE(timezone, 'UTC')
  INTO v_user_timezone
  FROM "0008-ap-users"
  WHERE id = v_user_id;

  v_user_timezone := COALESCE(v_user_timezone, 'UTC');

  v_start_date := make_date(p_year, p_month, 1);
  v_end_date := (v_start_date + INTERVAL '1 month')::date;

  RETURN QUERY
  WITH
  items_with_notes AS (
    SELECT DISTINCT unj.parent_id, unj.parent_type
    FROM "0008-ap-universal-notes-join" unj
    JOIN "0008-ap-notes" n ON n.id = unj.note_id
    LEFT JOIN "0008-ap-note-attachments" na ON na.note_id = n.id
    WHERE unj.user_id = v_user_id
      AND n.user_id = v_user_id
      AND (
        (n.content IS NOT NULL AND btrim(n.content) <> '')
        OR na.id IS NOT NULL
      )
  ),

  daily_reflections AS (
    SELECT
      (r.created_at AT TIME ZONE v_user_timezone)::date AS date_val,
      COUNT(DISTINCT r.id) AS count_val,
      STRING_AGG(
        '• ' || COALESCE(r.reflection_title, SUBSTRING(r.content, 1, 50)),
        E'\n'
      ) AS summary_val,
      jsonb_agg(
        jsonb_build_object(
          'type', CASE
            WHEN r.daily_rose = true THEN 'rose'
            WHEN r.daily_thorn = true THEN 'thorn'
            ELSE 'reflection'
          END,
          'title', COALESCE(r.reflection_title, SUBSTRING(r.content, 1, 50)),
          'has_notes', CASE WHEN iwn.parent_id IS NOT NULL THEN true ELSE false END
        )
      ) AS details_val
    FROM "0008-ap-reflections" r
    LEFT JOIN items_with_notes iwn
      ON iwn.parent_id = r.id AND iwn.parent_type = 'reflection'
    WHERE r.user_id = v_user_id
      AND r.archived = false
      AND (r.created_at AT TIME ZONE v_user_timezone)::date >= v_start_date
      AND (r.created_at AT TIME ZONE v_user_timezone)::date < v_end_date
    GROUP BY (r.created_at AT TIME ZONE v_user_timezone)::date
  ),

  deduped_tasks AS (
    SELECT DISTINCT ON (
      CASE
        WHEN t.parent_task_id IS NOT NULL AND t.due_date IS NOT NULL
        THEN t.due_date
        ELSE (t.completed_at AT TIME ZONE v_user_timezone)::date
      END,
      t.title
    )
      t.id, t.title, t.completed_at,
      CASE
        WHEN t.parent_task_id IS NOT NULL AND t.due_date IS NOT NULL
        THEN t.due_date
        ELSE (t.completed_at AT TIME ZONE v_user_timezone)::date
      END AS date_val,
      CASE WHEN iwn.parent_id IS NOT NULL THEN true ELSE false END AS has_notes,
      (
        SELECT COALESCE(g12.title, gc.title)
        FROM "0008-ap-universal-goals-join" gj
        LEFT JOIN "0008-ap-goals-12wk" g12
          ON g12.id = gj.goal_id AND gj.goal_type = 'twelve_wk_goal'
        LEFT JOIN "0008-ap-goals-custom" gc
          ON gc.id = gj.goal_id AND gj.goal_type = 'custom_goal'
        WHERE gj.parent_id = t.id AND gj.parent_type = 'task'
        LIMIT 1
      ) AS goal_title
    FROM "0008-ap-tasks" t
    LEFT JOIN items_with_notes iwn
      ON iwn.parent_id = t.id AND iwn.parent_type = 'task'
    WHERE t.user_id = v_user_id
      AND t.type = 'task'
      AND t.status = 'completed'
      AND t.completed_at IS NOT NULL
      AND t.deleted_at IS NULL
      AND (
        CASE
          WHEN t.parent_task_id IS NOT NULL AND t.due_date IS NOT NULL
          THEN t.due_date
          ELSE (t.completed_at AT TIME ZONE v_user_timezone)::date
        END
      ) >= v_start_date
      AND (
        CASE
          WHEN t.parent_task_id IS NOT NULL AND t.due_date IS NOT NULL
          THEN t.due_date
          ELSE (t.completed_at AT TIME ZONE v_user_timezone)::date
        END
      ) < v_end_date
    ORDER BY
      CASE
        WHEN t.parent_task_id IS NOT NULL AND t.due_date IS NOT NULL
        THEN t.due_date
        ELSE (t.completed_at AT TIME ZONE v_user_timezone)::date
      END,
      t.title, t.completed_at DESC
  ),

  daily_tasks AS (
    SELECT
      dt.date_val,
      COUNT(*) AS count_val,
      STRING_AGG('• ' || dt.title, E'\n' ORDER BY dt.title) AS summary_val,
      jsonb_agg(
        jsonb_build_object(
          'type', 'task',
          'title', dt.title,
          'has_notes', dt.has_notes,
          'goal_title', dt.goal_title
        ) ORDER BY dt.title
      ) AS details_val
    FROM deduped_tasks dt
    GROUP BY dt.date_val
  ),

  deduped_events AS (
    SELECT DISTINCT ON (
      COALESCE(t.end_date, t.start_date, (t.completed_at AT TIME ZONE v_user_timezone)::date),
      t.title
    )
      t.id, t.title, t.completed_at,
      COALESCE(t.end_date, t.start_date, (t.completed_at AT TIME ZONE v_user_timezone)::date) AS date_val,
      CASE WHEN iwn.parent_id IS NOT NULL THEN true ELSE false END AS has_notes,
      (
        SELECT COALESCE(g12.title, gc.title)
        FROM "0008-ap-universal-goals-join" gj
        LEFT JOIN "0008-ap-goals-12wk" g12
          ON g12.id = gj.goal_id AND gj.goal_type = 'twelve_wk_goal'
        LEFT JOIN "0008-ap-goals-custom" gc
          ON gc.id = gj.goal_id AND gj.goal_type = 'custom_goal'
        WHERE gj.parent_id = t.id AND gj.parent_type = 'task'
        LIMIT 1
      ) AS goal_title
    FROM "0008-ap-tasks" t
    LEFT JOIN items_with_notes iwn
      ON iwn.parent_id = t.id AND iwn.parent_type IN ('event', 'task')
    WHERE t.user_id = v_user_id
      AND t.type = 'event'
      AND t.status = 'completed'
      AND t.completed_at IS NOT NULL
      AND t.deleted_at IS NULL
      AND COALESCE(t.end_date, t.start_date, (t.completed_at AT TIME ZONE v_user_timezone)::date) >= v_start_date
      AND COALESCE(t.end_date, t.start_date, (t.completed_at AT TIME ZONE v_user_timezone)::date) < v_end_date
    ORDER BY COALESCE(t.end_date, t.start_date, (t.completed_at AT TIME ZONE v_user_timezone)::date), t.title, t.completed_at DESC
  ),

  daily_events AS (
    SELECT
      de.date_val,
      COUNT(*) AS count_val,
      STRING_AGG('• ' || de.title, E'\n' ORDER BY de.title) AS summary_val,
      jsonb_agg(
        jsonb_build_object(
          'type', 'event',
          'title', de.title,
          'has_notes', de.has_notes,
          'goal_title', de.goal_title
        ) ORDER BY de.title
      ) AS details_val
    FROM deduped_events de
    GROUP BY de.date_val
  ),

  daily_deposit_ideas AS (
    SELECT
      (d.created_at AT TIME ZONE v_user_timezone)::date AS date_val,
      COUNT(DISTINCT d.id) AS count_val,
      STRING_AGG('• ' || d.title, E'\n' ORDER BY d.title) AS summary_val,
      jsonb_agg(
        jsonb_build_object(
          'type', 'depositIdea',
          'title', d.title,
          'has_notes', CASE WHEN iwn.parent_id IS NOT NULL THEN true ELSE false END
        ) ORDER BY d.title
      ) AS details_val
    FROM "0008-ap-deposit-ideas" d
    LEFT JOIN items_with_notes iwn
      ON iwn.parent_id = d.id AND iwn.parent_type = 'depositIdea'
    WHERE d.user_id = v_user_id
      AND d.archived = false
      AND COALESCE(d.is_active, true) = true
      AND (d.created_at AT TIME ZONE v_user_timezone)::date >= v_start_date
      AND (d.created_at AT TIME ZONE v_user_timezone)::date < v_end_date
    GROUP BY (d.created_at AT TIME ZONE v_user_timezone)::date
  ),

  daily_withdrawals AS (
    SELECT
      (w.withdrawn_at AT TIME ZONE v_user_timezone)::date AS date_val,
      COUNT(DISTINCT w.id) AS count_val,
      STRING_AGG('• ' || COALESCE(w.title, 'Withdrawal'), E'\n' ORDER BY COALESCE(w.title, 'Withdrawal')) AS summary_val,
      jsonb_agg(
        jsonb_build_object(
          'type', 'withdrawal',
          'title', COALESCE(w.title, 'Withdrawal'),
          'has_notes', CASE WHEN iwn.parent_id IS NOT NULL THEN true ELSE false END
        ) ORDER BY COALESCE(w.title, 'Withdrawal')
      ) AS details_val
    FROM "0008-ap-withdrawals" w
    LEFT JOIN items_with_notes iwn
      ON iwn.parent_id = w.id AND iwn.parent_type = 'withdrawal'
    WHERE w.user_id = v_user_id
      AND (w.withdrawn_at AT TIME ZONE v_user_timezone)::date >= v_start_date
      AND (w.withdrawn_at AT TIME ZONE v_user_timezone)::date < v_end_date
    GROUP BY (w.withdrawn_at AT TIME ZONE v_user_timezone)::date
  ),

  all_dates AS (
    SELECT DISTINCT date_val FROM daily_reflections
    UNION SELECT DISTINCT date_val FROM daily_tasks
    UNION SELECT DISTINCT date_val FROM daily_events
    UNION SELECT DISTINCT date_val FROM daily_deposit_ideas
    UNION SELECT DISTINCT date_val FROM daily_withdrawals
  )

  SELECT
    ad.date_val AS item_date,
    COALESCE(dr.count_val, 0) AS reflections_count,
    COALESCE(dt.count_val, 0) AS tasks_count,
    COALESCE(de.count_val, 0) AS events_count,
    COALESCE(ddi.count_val, 0) AS deposit_ideas_count,
    COALESCE(dw.count_val, 0) AS withdrawals_count,
    (COALESCE(dt.count_val, 0) + COALESCE(de.count_val, 0) +
     COALESCE(ddi.count_val, 0) + COALESCE(dw.count_val, 0)) AS notes_count,
    COALESCE(
      array_to_string(ARRAY_REMOVE(ARRAY[
        NULLIF(dr.summary_val, ''), NULLIF(dt.summary_val, ''),
        NULLIF(de.summary_val, ''), NULLIF(ddi.summary_val, ''),
        NULLIF(dw.summary_val, '')
      ], NULL), E'\n'), ''
    ) AS content_summary,
    (COALESCE(dr.details_val, '[]'::jsonb) || COALESCE(dt.details_val, '[]'::jsonb) ||
     COALESCE(de.details_val, '[]'::jsonb) || COALESCE(ddi.details_val, '[]'::jsonb) ||
     COALESCE(dw.details_val, '[]'::jsonb)) AS item_details
  FROM all_dates ad
  LEFT JOIN daily_reflections dr ON dr.date_val = ad.date_val
  LEFT JOIN daily_tasks dt ON dt.date_val = ad.date_val
  LEFT JOIN daily_events de ON de.date_val = ad.date_val
  LEFT JOIN daily_deposit_ideas ddi ON ddi.date_val = ad.date_val
  LEFT JOIN daily_withdrawals dw ON dw.date_val = ad.date_val
  ORDER BY ad.date_val ASC;
END;
$$;

COMMIT;

-- ============================================================
-- POST-MIGRATION VERIFICATION
-- ============================================================
-- Verify all 5 views exist and return data:
--   SELECT COUNT(*) FROM v_goal_detail_actions;
--   SELECT COUNT(*) FROM v_goal_detail_week_actions;
--   SELECT COUNT(*) FROM "0008_v_journal";
--   SELECT COUNT(*) FROM v_daily_goal_actions;
--   SELECT COUNT(*) FROM v_weekly_goal_actions;
--
-- Verify functions exist:
--   SELECT routine_name FROM information_schema.routines
--   WHERE routine_schema = 'public'
--   AND routine_name IN ('get_daily_history_items', 'get_month_dates_with_items', 'ap_copy_universal_goals_to_task');
--   -- Expected: 3 rows
-- ============================================================
