CREATE OR REPLACE FUNCTION get_monthly_item_counts(
  p_year integer,
  p_month integer,
  p_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  month_start date,
  reflections_count bigint,
  tasks_count bigint,
  events_count bigint,
  deposit_ideas_count bigint,
  withdrawals_count bigint,
  total_items bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_start_date date;
BEGIN
  v_user_id := COALESCE(p_user_id, auth.uid());
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User ID is required';
  END IF;

  v_start_date := make_date(p_year, p_month, 1);

  RETURN QUERY
  WITH per_day AS (
    SELECT *
    FROM get_month_dates_with_items(p_year, p_month, v_user_id)
  )
  SELECT
    v_start_date AS month_start,
    COALESCE(SUM(reflections_count), 0)   AS reflections_count,
    COALESCE(SUM(tasks_count), 0)         AS tasks_count,
    COALESCE(SUM(events_count), 0)        AS events_count,
    COALESCE(SUM(deposit_ideas_count), 0) AS deposit_ideas_count,
    COALESCE(SUM(withdrawals_count), 0)   AS withdrawals_count,
    COALESCE(
      SUM(
        reflections_count
        + tasks_count
        + events_count
        + deposit_ideas_count
        + withdrawals_count
      ),
      0
    ) AS total_items;

  RETURN;
END;
$$;

COMMENT ON FUNCTION get_monthly_item_counts(integer, integer, uuid) IS
  'Aggregates month-level item counts by summing get_month_dates_with_items results.';

CREATE OR REPLACE FUNCTION get_history_month_summaries(p_user_id uuid DEFAULT NULL)
RETURNS TABLE (
  month_start date,
  year integer,
  month integer,
  reflections_count bigint,
  tasks_count bigint,
  events_count bigint,
  deposit_ideas_count bigint,
  withdrawals_count bigint,
  total_items bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_user_timezone text;
  v_min_date date;
  v_max_date date;
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

  SELECT
    MIN(item_date),
    MAX(item_date)
  INTO v_min_date, v_max_date
  FROM (
    SELECT (created_at AT TIME ZONE v_user_timezone)::date AS item_date
    FROM "0008-ap-reflections"
    WHERE user_id = v_user_id
      AND archived = false

    UNION ALL

    SELECT (n.created_at AT TIME ZONE v_user_timezone)::date AS item_date
    FROM "0008-ap-universal-notes-join" unj
    INNER JOIN "0008-ap-notes" n ON n.id = unj.note_id
    WHERE unj.user_id = v_user_id
      AND n.user_id = v_user_id
  ) all_dates;

  IF v_min_date IS NULL OR v_max_date IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH month_series AS (
    SELECT DATE_TRUNC('month', gs)::date AS month_start
    FROM generate_series(
      DATE_TRUNC('month', v_min_date),
      DATE_TRUNC('month', v_max_date),
      INTERVAL '1 month'
    ) AS gs
  ),
  totals AS (
    SELECT
      ms.month_start,
      counts.reflections_count,
      counts.tasks_count,
      counts.events_count,
      counts.deposit_ideas_count,
      counts.withdrawals_count,
      counts.total_items
    FROM month_series ms
    CROSS JOIN LATERAL get_monthly_item_counts(
      EXTRACT(YEAR FROM ms.month_start)::integer,
      EXTRACT(MONTH FROM ms.month_start)::integer,
      v_user_id
    ) counts
  )
  SELECT
    month_start,
    EXTRACT(YEAR FROM month_start)::integer AS year,
    EXTRACT(MONTH FROM month_start)::integer AS month,
    reflections_count,
    tasks_count,
    events_count,
    deposit_ideas_count,
    withdrawals_count,
    total_items
  FROM totals
  WHERE total_items > 0
  ORDER BY month_start DESC;

  RETURN;
END;
$$;

COMMENT ON FUNCTION get_history_month_summaries IS
  'Lists months with history data by reusing get_monthly_item_counts for each month.';

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
  WITH daily_reflections AS (
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
  daily_tasks AS (
    SELECT
      (n.created_at AT TIME ZONE v_user_timezone)::date AS date_val,
      COUNT(DISTINCT t.id) AS count_val,
      STRING_AGG(
        DISTINCT '• ' || t.title,
        E'\n'
      ) AS summary_val
    FROM "0008-ap-universal-notes-join" unj
    INNER JOIN "0008-ap-notes" n ON n.id = unj.note_id
    INNER JOIN "0008-ap-tasks" t ON t.id = unj.parent_id
    WHERE unj.user_id = v_user_id
      AND unj.parent_type = 'task'
      AND t.user_id = v_user_id
      AND t.type = 'task'
      AND t.deleted_at IS NULL
      AND (n.created_at AT TIME ZONE v_user_timezone)::date >= v_start_date
      AND (n.created_at AT TIME ZONE v_user_timezone)::date < v_end_date
    GROUP BY (n.created_at AT TIME ZONE v_user_timezone)::date
  ),
  daily_events AS (
    SELECT
      (n.created_at AT TIME ZONE v_user_timezone)::date AS date_val,
      COUNT(DISTINCT t.id) AS count_val,
      STRING_AGG(
        DISTINCT '• ' || t.title,
        E'\n'
      ) AS summary_val
    FROM "0008-ap-universal-notes-join" unj
    INNER JOIN "0008-ap-notes" n ON n.id = unj.note_id
    INNER JOIN "0008-ap-tasks" t ON t.id = unj.parent_id
    WHERE unj.user_id = v_user_id
      AND unj.parent_type = 'task'
      AND t.user_id = v_user_id
      AND t.type = 'event'
      AND t.deleted_at IS NULL
      AND (n.created_at AT TIME ZONE v_user_timezone)::date >= v_start_date
      AND (n.created_at AT TIME ZONE v_user_timezone)::date < v_end_date
    GROUP BY (n.created_at AT TIME ZONE v_user_timezone)::date
  ),
  daily_deposit_ideas AS (
    SELECT
      (n.created_at AT TIME ZONE v_user_timezone)::date AS date_val,
      COUNT(DISTINCT d.id) AS count_val,
      STRING_AGG(
        DISTINCT '• ' || d.title,
        E'\n'
      ) AS summary_val
    FROM "0008-ap-universal-notes-join" unj
    INNER JOIN "0008-ap-notes" n ON n.id = unj.note_id
    INNER JOIN "0008-ap-deposit-ideas" d ON d.id = unj.parent_id
    WHERE unj.user_id = v_user_id
      AND unj.parent_type = 'depositIdea'
      AND d.user_id = v_user_id
      AND d.archived = false
      AND COALESCE(d.is_active, true) = true
      AND (n.created_at AT TIME ZONE v_user_timezone)::date >= v_start_date
      AND (n.created_at AT TIME ZONE v_user_timezone)::date < v_end_date
    GROUP BY (n.created_at AT TIME ZONE v_user_timezone)::date
  ),
  daily_withdrawals AS (
    SELECT
      (n.created_at AT TIME ZONE v_user_timezone)::date AS date_val,
      COUNT(DISTINCT w.id) AS count_val,
      STRING_AGG(
        DISTINCT '• ' || COALESCE(w.title, 'Withdrawal'),
        E'\n'
      ) AS summary_val
    FROM "0008-ap-universal-notes-join" unj
    INNER JOIN "0008-ap-notes" n ON n.id = unj.note_id
    INNER JOIN "0008-ap-withdrawals" w ON w.id = unj.parent_id
    WHERE unj.user_id = v_user_id
      AND unj.parent_type = 'withdrawal'
      AND w.user_id = v_user_id
      AND (n.created_at AT TIME ZONE v_user_timezone)::date >= v_start_date
      AND (n.created_at AT TIME ZONE v_user_timezone)::date < v_end_date
    GROUP BY (n.created_at AT TIME ZONE v_user_timezone)::date
  ),
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

GRANT EXECUTE ON FUNCTION get_monthly_item_counts(integer, integer, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_history_month_summaries(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_month_dates_with_items(integer, integer, uuid) TO authenticated;
