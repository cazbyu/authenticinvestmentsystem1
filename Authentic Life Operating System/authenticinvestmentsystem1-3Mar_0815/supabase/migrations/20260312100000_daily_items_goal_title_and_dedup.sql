/*
  # Add goal_title to daily history items and deduplicate recurring tasks

  Changes:
  1. Adds goal_title column (from 12wk or custom goals via universal-goals-join)
  2. Deduplicates recurring tasks/events completed on the same day
     (batch-completion creates multiple records with the same title)
  3. Keeps RETURNS TABLE compatible with DailyHistoryItemRow interface
     plus the new goal_title field
*/

CREATE OR REPLACE FUNCTION get_daily_history_items(
  p_target_date date,
  p_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
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
LANGUAGE plpgsql
SECURITY DEFINER
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

  -- 1. REFLECTIONS (no goal association, no dedup needed)
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
        LEFT JOIN "0008-ap-goals-12wk" g12 ON g12.id = gj.twelve_wk_goal_id
        LEFT JOIN "0008-ap-goals-custom" gc ON gc.id = gj.custom_goal_id
        WHERE gj.parent_id = t.id AND gj.parent_type = 'task'
        LIMIT 1
      ) AS goal_title
    FROM "0008-ap-tasks" t
    WHERE t.user_id = v_user_id
      AND t.type = 'task'
      AND t.deleted_at IS NULL
      AND t.status = 'completed'
      AND t.completed_at IS NOT NULL
      AND date(t.completed_at AT TIME ZONE v_timezone) = p_target_date
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
        LEFT JOIN "0008-ap-goals-12wk" g12 ON g12.id = gj.twelve_wk_goal_id
        LEFT JOIN "0008-ap-goals-custom" gc ON gc.id = gj.custom_goal_id
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
      LEFT JOIN "0008-ap-goals-12wk" g12 ON g12.id = gj.twelve_wk_goal_id
      LEFT JOIN "0008-ap-goals-custom" gc ON gc.id = gj.custom_goal_id
      WHERE gj.parent_id = di.id AND gj.parent_type = 'depositIdea'
      LIMIT 1
    ) AS goal_title
  FROM "0008-ap-deposit-ideas" di
  WHERE di.user_id = v_user_id
    AND di.archived = false
    AND date(di.created_at AT TIME ZONE v_timezone) = p_target_date

  UNION ALL

  -- 5. ALL WITHDRAWALS (no goal association)
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

GRANT EXECUTE ON FUNCTION get_daily_history_items(date, uuid) TO authenticated;
