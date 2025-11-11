-- Ensure monthly history views only include items with associated notes
CREATE OR REPLACE FUNCTION get_monthly_item_counts(p_user_id uuid DEFAULT NULL)
RETURNS TABLE (
  month_year text,
  year integer,
  month integer,
  reflections_count bigint,
  tasks_count bigint,
  events_count bigint,
  deposit_ideas_count bigint,
  withdrawals_count bigint,
  follow_up_items_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_user_timezone text;
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

  RETURN QUERY
  WITH monthly_reflections AS (
    SELECT
      date_trunc('month', (created_at AT TIME ZONE v_user_timezone))::date AS month_date,
      COUNT(DISTINCT id) AS count
    FROM "0008-ap-reflections"
    WHERE user_id = v_user_id
      AND archived = false
    GROUP BY date_trunc('month', (created_at AT TIME ZONE v_user_timezone))::date
  ),
  monthly_tasks AS (
    SELECT
      date_trunc('month', (n.created_at AT TIME ZONE v_user_timezone))::date AS month_date,
      COUNT(DISTINCT t.id) AS count
    FROM "0008-ap-universal-notes-join" unj
    INNER JOIN "0008-ap-notes" n ON n.id = unj.note_id
    INNER JOIN "0008-ap-tasks" t ON t.id = unj.parent_id
    WHERE unj.user_id = v_user_id
      AND unj.parent_type = 'task'
      AND t.user_id = v_user_id
      AND t.type = 'task'
      AND t.deleted_at IS NULL
    GROUP BY date_trunc('month', (n.created_at AT TIME ZONE v_user_timezone))::date
  ),
  monthly_events AS (
    SELECT
      date_trunc('month', (n.created_at AT TIME ZONE v_user_timezone))::date AS month_date,
      COUNT(DISTINCT t.id) AS count
    FROM "0008-ap-universal-notes-join" unj
    INNER JOIN "0008-ap-notes" n ON n.id = unj.note_id
    INNER JOIN "0008-ap-tasks" t ON t.id = unj.parent_id
    WHERE unj.user_id = v_user_id
      AND unj.parent_type = 'task'
      AND t.user_id = v_user_id
      AND t.type = 'event'
      AND t.deleted_at IS NULL
    GROUP BY date_trunc('month', (n.created_at AT TIME ZONE v_user_timezone))::date
  ),
  monthly_deposit_ideas AS (
    SELECT
      date_trunc('month', (n.created_at AT TIME ZONE v_user_timezone))::date AS month_date,
      COUNT(DISTINCT d.id) AS count
    FROM "0008-ap-universal-notes-join" unj
    INNER JOIN "0008-ap-notes" n ON n.id = unj.note_id
    INNER JOIN "0008-ap-deposit-ideas" d ON d.id = unj.parent_id
    WHERE unj.user_id = v_user_id
      AND unj.parent_type = 'depositIdea'
      AND d.user_id = v_user_id
      AND d.archived = false
      AND COALESCE(d.is_active, true) = true
    GROUP BY date_trunc('month', (n.created_at AT TIME ZONE v_user_timezone))::date
  ),
  monthly_withdrawals AS (
    SELECT
      date_trunc('month', (n.created_at AT TIME ZONE v_user_timezone))::date AS month_date,
      COUNT(DISTINCT w.id) AS count
    FROM "0008-ap-universal-notes-join" unj
    INNER JOIN "0008-ap-notes" n ON n.id = unj.note_id
    INNER JOIN "0008-ap-withdrawals" w ON w.id = unj.parent_id
    WHERE unj.user_id = v_user_id
      AND unj.parent_type = 'withdrawal'
      AND w.user_id = v_user_id
    GROUP BY date_trunc('month', (n.created_at AT TIME ZONE v_user_timezone))::date
  ),
  all_months AS (
    SELECT DISTINCT month_date FROM monthly_reflections
    UNION
    SELECT DISTINCT month_date FROM monthly_tasks
    UNION
    SELECT DISTINCT month_date FROM monthly_events
    UNION
    SELECT DISTINCT month_date FROM monthly_deposit_ideas
    UNION
    SELECT DISTINCT month_date FROM monthly_withdrawals
  )
  SELECT
    TO_CHAR(am.month_date, 'Month YYYY') AS month_year,
    EXTRACT(YEAR FROM am.month_date)::integer AS year,
    EXTRACT(MONTH FROM am.month_date)::integer AS month,
    COALESCE(mr.count, 0) AS reflections_count,
    COALESCE(mt.count, 0) AS tasks_count,
    COALESCE(me.count, 0) AS events_count,
    COALESCE(mdi.count, 0) AS deposit_ideas_count,
    COALESCE(mw.count, 0) AS withdrawals_count,
    0::bigint AS follow_up_items_count
  FROM all_months am
  LEFT JOIN monthly_reflections mr ON mr.month_date = am.month_date
  LEFT JOIN monthly_tasks mt ON mt.month_date = am.month_date
  LEFT JOIN monthly_events me ON me.month_date = am.month_date
  LEFT JOIN monthly_deposit_ideas mdi ON mdi.month_date = am.month_date
  LEFT JOIN monthly_withdrawals mw ON mw.month_date = am.month_date
  ORDER BY am.month_date DESC;
END;
$$;

COMMENT ON FUNCTION get_monthly_item_counts IS
  'Returns month-level item counts limited to reflections and items with associated notes.';

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

GRANT EXECUTE ON FUNCTION get_monthly_item_counts TO authenticated;
GRANT EXECUTE ON FUNCTION get_month_dates_with_items TO authenticated;
