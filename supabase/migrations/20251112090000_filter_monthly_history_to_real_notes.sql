/*
  # Filter Monthly History Daily Items to Real Notes

  - Ensure tasks/events/deposit ideas/withdrawals only appear in history when they have an actual note
  - Notes must either contain non-empty content or at least one attachment
  - Prevents blank task rows from appearing under "Reflections & Daily Items" in the History tab
*/

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
  content_summary text
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
  WITH note_filter AS (
    -- Parents that have at least one "real" note this month
    SELECT DISTINCT
      j.parent_type,
      j.parent_id,
      j.note_id
    FROM "0008-ap-universal-notes-join" j
    JOIN "0008-ap-notes" n ON n.id = j.note_id
    LEFT JOIN "0008-ap-note-attachments" na ON na.note_id = n.id
    WHERE
      j.user_id = v_user_id
      AND n.user_id = v_user_id
      AND (
        (n.content IS NOT NULL AND btrim(n.content) <> '')
        OR na.id IS NOT NULL
      )
      AND (n.created_at AT TIME ZONE v_user_timezone)::date >= v_start_date
      AND (n.created_at AT TIME ZONE v_user_timezone)::date < v_end_date
  ),

  -- Reflections are always included (no note requirement)
  daily_reflections AS (
    SELECT
      (created_at AT TIME ZONE v_user_timezone)::date AS date_val,
      COUNT(DISTINCT id) AS count_val,
      STRING_AGG(
        DISTINCT '• ' || COALESCE(reflection_title, SUBSTRING(content, 1, 50)),
        E'\n'
      ) AS summary_val
    FROM "0008-ap-reflections"
    WHERE user_id = v_user_id
      AND archived = false
      AND (created_at AT TIME ZONE v_user_timezone)::date >= v_start_date
      AND (created_at AT TIME ZONE v_user_timezone)::date < v_end_date
    GROUP BY (created_at AT TIME ZONE v_user_timezone)::date
  ),

  -- Tasks (including "event-style" tasks live in 0008-ap-tasks, type = 'task')
  daily_tasks AS (
    SELECT
      t.task_date AS date_val,
      COUNT(DISTINCT t.id) AS count_val,
      STRING_AGG(
        DISTINCT '• ' || t.title,
        E'\n' ORDER BY t.title
      ) AS summary_val
    FROM (
      SELECT
        t.id,
        t.user_id,
        t.title,
        t.type,
        t.deleted_at,
        COALESCE(
          (t.completed_at AT TIME ZONE v_user_timezone)::date,
          t.due_date,
          (t.created_at AT TIME ZONE v_user_timezone)::date
        ) AS task_date
      FROM "0008-ap-tasks" t
    ) t
    JOIN note_filter nf
      ON nf.parent_type = 'task'
     AND nf.parent_id = t.id
    WHERE t.user_id = v_user_id
      AND t.type = 'task'
      AND t.deleted_at IS NULL
      AND t.task_date IS NOT NULL
      AND t.task_date >= v_start_date
      AND t.task_date < v_end_date
    GROUP BY t.task_date
  ),

  -- Events (also stored in 0008-ap-tasks, type = 'event')
  daily_events AS (
    SELECT
      t.event_date AS date_val,
      COUNT(DISTINCT t.id) AS count_val,
      STRING_AGG(
        DISTINCT '• ' || t.title,
        E'\n' ORDER BY t.title
      ) AS summary_val
    FROM (
      SELECT
        t.id,
        t.user_id,
        t.title,
        t.type,
        t.deleted_at,
        COALESCE(
          t.start_date,
          t.due_date,
          (t.created_at AT TIME ZONE v_user_timezone)::date
        ) AS event_date
      FROM "0008-ap-tasks" t
    ) t
    JOIN note_filter nf
      ON nf.parent_type = 'event'
     AND nf.parent_id = t.id
    WHERE t.user_id = v_user_id
      AND t.type = 'event'
      AND t.deleted_at IS NULL
      AND t.event_date IS NOT NULL
      AND t.event_date >= v_start_date
      AND t.event_date < v_end_date
    GROUP BY t.event_date
  ),

  -- Deposit Ideas
  daily_deposit_ideas AS (
    SELECT
      d.idea_date AS date_val,
      COUNT(DISTINCT d.id) AS count_val,
      STRING_AGG(
        DISTINCT '• ' || d.title,
        E'\n' ORDER BY d.title
      ) AS summary_val
    FROM (
      SELECT
        d.id,
        d.user_id,
        d.title,
        d.archived,
        COALESCE(d.is_active, true) AS is_active,
        COALESCE(
          (d.activated_at AT TIME ZONE v_user_timezone)::date,
          (d.created_at AT TIME ZONE v_user_timezone)::date
        ) AS idea_date
      FROM "0008-ap-deposit-ideas" d
    ) d
    JOIN note_filter nf
      ON nf.parent_type = 'depositIdea'
     AND nf.parent_id = d.id
    WHERE d.user_id = v_user_id
      AND d.archived = false
      AND d.is_active = true
      AND d.idea_date IS NOT NULL
      AND d.idea_date >= v_start_date
      AND d.idea_date < v_end_date
    GROUP BY d.idea_date
  ),

  -- Withdrawals
  daily_withdrawals AS (
    SELECT
      w.withdrawal_date AS date_val,
      COUNT(DISTINCT w.id) AS count_val,
      STRING_AGG(
        DISTINCT '• ' || COALESCE(w.title, 'Withdrawal'),
        E'\n' ORDER BY COALESCE(w.title, 'Withdrawal')
      ) AS summary_val
    FROM (
      SELECT
        w.id,
        w.user_id,
        w.title,
        COALESCE(
          (w.withdrawn_at AT TIME ZONE v_user_timezone)::date,
          (w.created_at AT TIME ZONE v_user_timezone)::date
        ) AS withdrawal_date
      FROM "0008-ap-withdrawals" w
    ) w
    JOIN note_filter nf
      ON nf.parent_type = 'withdrawal'
     AND nf.parent_id = w.id
    WHERE w.user_id = v_user_id
      AND w.withdrawal_date IS NOT NULL
      AND w.withdrawal_date >= v_start_date
      AND w.withdrawal_date < v_end_date
    GROUP BY w.withdrawal_date
  ),

  -- All dates that have at least one relevant item
  all_dates AS (
    SELECT DISTINCT date_val FROM daily_reflections
    UNION
    SELECT DISTINCT date_val FROM daily_tasks
    UNION
    SELECT DISTINCT date_val FROM daily_events
    UNION
    SELECT DISTINCT date_val FROM daily_deposit_ideas
    UNION
    SELECT DISTINCT date_val FROM daily_withdrawals
  )

  SELECT
    ad.date_val AS item_date,
    COALESCE(dr.count_val, 0) AS reflections_count,
    COALESCE(dt.count_val, 0) AS tasks_count,
    COALESCE(de.count_val, 0) AS events_count,
    COALESCE(ddi.count_val, 0) AS deposit_ideas_count,
    COALESCE(dw.count_val, 0) AS withdrawals_count,
    (
      COALESCE(dt.count_val, 0) +
      COALESCE(de.count_val, 0) +
      COALESCE(ddi.count_val, 0) +
      COALESCE(dw.count_val, 0)
    ) AS notes_count,
    COALESCE(
      array_to_string(
        ARRAY_REMOVE(ARRAY[
          NULLIF(dr.summary_val, ''),
          NULLIF(dt.summary_val, ''),
          NULLIF(de.summary_val, ''),
          NULLIF(ddi.summary_val, ''),
          NULLIF(dw.summary_val, '')
        ], NULL),
        E'\n'
      ),
      ''
    ) AS content_summary
  FROM all_dates ad
  LEFT JOIN daily_reflections dr ON dr.date_val = ad.date_val
  LEFT JOIN daily_tasks dt ON dt.date_val = ad.date_val
  LEFT JOIN daily_events de ON de.date_val = ad.date_val
  LEFT JOIN daily_deposit_ideas ddi ON ddi.date_val = ad.date_val
  LEFT JOIN daily_withdrawals dw ON dw.date_val = ad.date_val
  ORDER BY ad.date_val ASC;
END;
$$;

COMMENT ON FUNCTION get_month_dates_with_items IS
  'Returns dates with item counts limited to reflections and note-backed daily items.';

GRANT EXECUTE ON FUNCTION get_month_dates_with_items TO authenticated;
