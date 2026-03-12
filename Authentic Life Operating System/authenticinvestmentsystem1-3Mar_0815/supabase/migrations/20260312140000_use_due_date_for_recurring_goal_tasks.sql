-- ============================================================
-- Use due_date (intended day) instead of completed_at (click time)
-- for recurring goal-linked task occurrences (parent_task_id IS NOT NULL).
--
-- When a user marks a recurring goal task for Tuesday via the weekly
-- checkmark grid on Thursday, the task should appear in Tuesday's
-- journal, not Thursday's. The due_date column stores the intended
-- day; completed_at stores when the user clicked.
--
-- Regular/boost tasks (parent_task_id IS NULL) continue using
-- completed_at for date attribution.
--
-- Updates: v_daily_goal_actions, v_daily_role_investments,
--          v_daily_domain_balance, get_daily_history_items,
--          get_month_dates_with_items
-- ============================================================

-- 1. Fix v_daily_goal_actions
CREATE OR REPLACE VIEW v_daily_goal_actions AS
SELECT
  t.user_id,
  COALESCE(gj.twelve_wk_goal_id, gj.custom_goal_id) AS goal_id,
  gj.goal_type,
  CASE
    WHEN t.parent_task_id IS NOT NULL AND t.due_date IS NOT NULL
    THEN t.due_date
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
LEFT JOIN "0008-ap-goals-12wk" tw ON gj.twelve_wk_goal_id = tw.id
LEFT JOIN "0008-ap-goals-custom" cg ON gj.custom_goal_id = cg.id
WHERE t.deleted_at IS NULL
  AND t.status = 'completed'
  AND t.completed_at IS NOT NULL
GROUP BY
  t.user_id,
  COALESCE(gj.twelve_wk_goal_id, gj.custom_goal_id),
  gj.goal_type,
  CASE
    WHEN t.parent_task_id IS NOT NULL AND t.due_date IS NOT NULL
    THEN t.due_date
    ELSE (t.completed_at AT TIME ZONE COALESCE(u.timezone, 'UTC'))::date
  END,
  CASE WHEN gj.goal_type = 'twelve_wk_goal' THEN tw.title
       WHEN gj.goal_type = 'custom_goal' THEN cg.title ELSE NULL END,
  CASE WHEN gj.goal_type = 'twelve_wk_goal' THEN tw.status
       WHEN gj.goal_type = 'custom_goal' THEN cg.status ELSE NULL END;

-- 2. Fix v_daily_role_investments
CREATE OR REPLACE VIEW v_daily_role_investments AS
WITH task_activities AS (
  SELECT
    t.user_id,
    rj.role_id,
    CASE
      WHEN t.parent_task_id IS NOT NULL AND t.due_date IS NOT NULL
      THEN t.due_date
      ELSE (t.completed_at AT TIME ZONE COALESCE(u.timezone, 'UTC'))::date
    END AS activity_date,
    count(DISTINCT t.id) AS task_count
  FROM "0008-ap-tasks" t
  JOIN "0008-ap-users" u ON u.id = t.user_id
  JOIN "0008-ap-universal-roles-join" rj
    ON rj.parent_id = t.id AND rj.parent_type = 'task'
  WHERE t.deleted_at IS NULL
    AND t.status = 'completed'
    AND t.completed_at IS NOT NULL
  GROUP BY t.user_id, rj.role_id,
    CASE
      WHEN t.parent_task_id IS NOT NULL AND t.due_date IS NOT NULL
      THEN t.due_date
      ELSE (t.completed_at AT TIME ZONE COALESCE(u.timezone, 'UTC'))::date
    END
),
deposit_activities AS (
  SELECT
    di.user_id,
    rj.role_id,
    (di.created_at AT TIME ZONE COALESCE(u.timezone, 'UTC'))::date AS activity_date,
    count(DISTINCT di.id) AS deposit_idea_count
  FROM "0008-ap-deposit-ideas" di
  JOIN "0008-ap-users" u ON u.id = di.user_id
  JOIN "0008-ap-universal-roles-join" rj
    ON rj.parent_id = di.id AND rj.parent_type = 'depositIdea'
  WHERE di.archived = false
  GROUP BY di.user_id, rj.role_id, (di.created_at AT TIME ZONE COALESCE(u.timezone, 'UTC'))::date
)
SELECT
  COALESCE(ta.user_id, da.user_id) AS user_id,
  COALESCE(ta.role_id, da.role_id) AS role_id,
  COALESCE(ta.activity_date, da.activity_date) AS activity_date,
  COALESCE(ta.task_count, 0::bigint) AS task_count,
  COALESCE(da.deposit_idea_count, 0::bigint) AS deposit_idea_count,
  COALESCE(ta.task_count, 0::bigint) + COALESCE(da.deposit_idea_count, 0::bigint) AS total_activities,
  r.label AS role_label,
  r.color AS role_color
FROM task_activities ta
FULL JOIN deposit_activities da
  ON ta.user_id = da.user_id AND ta.role_id = da.role_id AND ta.activity_date = da.activity_date
JOIN "0008-ap-roles" r ON r.id = COALESCE(ta.role_id, da.role_id);

-- 3. Fix v_daily_domain_balance
CREATE OR REPLACE VIEW v_daily_domain_balance AS
SELECT
  t.user_id,
  dj.domain_id,
  CASE
    WHEN t.parent_task_id IS NOT NULL AND t.due_date IS NOT NULL
    THEN t.due_date
    ELSE (t.completed_at AT TIME ZONE COALESCE(u.timezone, 'UTC'))::date
  END AS activity_date,
  count(DISTINCT t.id) AS activity_count,
  d.name AS domain_name,
  NULL::text AS domain_color
FROM "0008-ap-tasks" t
JOIN "0008-ap-users" u ON u.id = t.user_id
JOIN "0008-ap-universal-domains-join" dj
  ON dj.parent_id = t.id AND dj.parent_type = 'task'
JOIN "0008-ap-domains" d ON d.id = dj.domain_id
WHERE t.deleted_at IS NULL
  AND t.status = 'completed'
  AND t.completed_at IS NOT NULL
GROUP BY t.user_id, dj.domain_id,
  CASE
    WHEN t.parent_task_id IS NOT NULL AND t.due_date IS NOT NULL
    THEN t.due_date
    ELSE (t.completed_at AT TIME ZONE COALESCE(u.timezone, 'UTC'))::date
  END,
  d.name;

-- 4. Fix get_daily_history_items
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
  -- Uses due_date for recurring goal tasks, completed_at for regular tasks
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

-- 5. Fix get_month_dates_with_items
CREATE OR REPLACE FUNCTION get_month_dates_with_items(
  p_year integer,
  p_month integer,
  p_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
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
LANGUAGE plpgsql
SECURITY DEFINER
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

  -- Deduplicated tasks with goal_title
  -- Uses due_date for recurring goal tasks, completed_at for regular tasks
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
        LEFT JOIN "0008-ap-goals-12wk" g12 ON g12.id = gj.twelve_wk_goal_id
        LEFT JOIN "0008-ap-goals-custom" gc ON gc.id = gj.custom_goal_id
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

  -- Deduplicated events with goal_title
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
        LEFT JOIN "0008-ap-goals-12wk" g12 ON g12.id = gj.twelve_wk_goal_id
        LEFT JOIN "0008-ap-goals-custom" gc ON gc.id = gj.custom_goal_id
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
