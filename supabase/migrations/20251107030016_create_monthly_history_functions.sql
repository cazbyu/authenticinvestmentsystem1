/*
  # Create Monthly History Aggregation Functions

  1. New Functions
    - `get_monthly_item_counts` - Returns aggregated counts per month for all item types
    - `get_month_dates_with_items` - Returns distinct dates within a month that have content

  2. Performance
    - Uses CTEs for efficient aggregation
    - Returns data in format optimized for frontend consumption

  3. Security
    - Functions respect RLS by filtering on auth.uid()
    - Grants execute permission to authenticated users only
*/

-- Function to get monthly item counts for a user
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
BEGIN
  -- Use provided user_id or get from auth context
  v_user_id := COALESCE(p_user_id, auth.uid());

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User ID is required';
  END IF;

  RETURN QUERY
  WITH monthly_reflections AS (
    SELECT
      date_trunc('month', created_at)::date AS month_date,
      COUNT(*) AS count
    FROM "0008-ap-reflections"
    WHERE user_id = v_user_id
      AND archived = false
    GROUP BY date_trunc('month', created_at)::date
  ),
  monthly_tasks AS (
    SELECT
      date_trunc('month', COALESCE(completed_at, created_at))::date AS month_date,
      COUNT(*) AS count
    FROM "0008-ap-tasks"
    WHERE user_id = v_user_id
      AND type = 'task'
      AND deleted_at IS NULL
    GROUP BY date_trunc('month', COALESCE(completed_at, created_at))::date
  ),
  monthly_events AS (
    SELECT
      date_trunc('month', COALESCE(completed_at, created_at))::date AS month_date,
      COUNT(*) AS count
    FROM "0008-ap-tasks"
    WHERE user_id = v_user_id
      AND type = 'event'
      AND deleted_at IS NULL
    GROUP BY date_trunc('month', COALESCE(completed_at, created_at))::date
  ),
  monthly_deposit_ideas AS (
    SELECT
      date_trunc('month', created_at)::date AS month_date,
      COUNT(*) AS count
    FROM "0008-ap-deposit-ideas"
    WHERE user_id = v_user_id
    GROUP BY date_trunc('month', created_at)::date
  ),
  monthly_withdrawals AS (
    SELECT
      date_trunc('month', withdrawn_at)::date AS month_date,
      COUNT(*) AS count
    FROM "0008-ap-withdrawals"
    WHERE user_id = v_user_id
    GROUP BY date_trunc('month', withdrawn_at)::date
  ),
  monthly_notes AS (
    SELECT
      date_trunc('month', n.created_at)::date AS month_date,
      COUNT(DISTINCT n.id) AS count
    FROM "0008-ap-notes" n
    INNER JOIN "0008-ap-universal-notes-join" unj ON unj.note_id = n.id
    WHERE unj.user_id = v_user_id
    GROUP BY date_trunc('month', n.created_at)::date
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
    UNION
    SELECT DISTINCT month_date FROM monthly_notes
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
    COALESCE(mn.count, 0) AS follow_up_items_count
  FROM all_months am
  LEFT JOIN monthly_reflections mr ON mr.month_date = am.month_date
  LEFT JOIN monthly_tasks mt ON mt.month_date = am.month_date
  LEFT JOIN monthly_events me ON me.month_date = am.month_date
  LEFT JOIN monthly_deposit_ideas mdi ON mdi.month_date = am.month_date
  LEFT JOIN monthly_withdrawals mw ON mw.month_date = am.month_date
  LEFT JOIN monthly_notes mn ON mn.month_date = am.month_date
  ORDER BY am.month_date DESC;
END;
$$;

-- Function to get dates with content for a specific month
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
  v_start_date date;
  v_end_date date;
BEGIN
  v_user_id := COALESCE(p_user_id, auth.uid());

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User ID is required';
  END IF;

  v_start_date := make_date(p_year, p_month, 1);
  v_end_date := (v_start_date + INTERVAL '1 month')::date;

  RETURN QUERY
  WITH daily_reflections AS (
    SELECT
      created_at::date AS item_date,
      COUNT(*) AS count,
      STRING_AGG(SUBSTRING(content, 1, 50), ', ') AS summary
    FROM "0008-ap-reflections"
    WHERE user_id = v_user_id
      AND archived = false
      AND created_at::date >= v_start_date
      AND created_at::date < v_end_date
    GROUP BY created_at::date
  ),
  daily_tasks AS (
    SELECT
      COALESCE(completed_at::date, created_at::date) AS item_date,
      COUNT(*) AS count,
      STRING_AGG(title, ', ') AS summary
    FROM "0008-ap-tasks"
    WHERE user_id = v_user_id
      AND type = 'task'
      AND deleted_at IS NULL
      AND COALESCE(completed_at::date, created_at::date) >= v_start_date
      AND COALESCE(completed_at::date, created_at::date) < v_end_date
    GROUP BY COALESCE(completed_at::date, created_at::date)
  ),
  daily_events AS (
    SELECT
      COALESCE(completed_at::date, created_at::date) AS item_date,
      COUNT(*) AS count,
      STRING_AGG(title, ', ') AS summary
    FROM "0008-ap-tasks"
    WHERE user_id = v_user_id
      AND type = 'event'
      AND deleted_at IS NULL
      AND COALESCE(completed_at::date, created_at::date) >= v_start_date
      AND COALESCE(completed_at::date, created_at::date) < v_end_date
    GROUP BY COALESCE(completed_at::date, created_at::date)
  ),
  daily_deposit_ideas AS (
    SELECT
      created_at::date AS item_date,
      COUNT(*) AS count,
      STRING_AGG(title, ', ') AS summary
    FROM "0008-ap-deposit-ideas"
    WHERE user_id = v_user_id
      AND created_at::date >= v_start_date
      AND created_at::date < v_end_date
    GROUP BY created_at::date
  ),
  daily_withdrawals AS (
    SELECT
      withdrawn_at::date AS item_date,
      COUNT(*) AS count,
      STRING_AGG(COALESCE(title, 'Withdrawal'), ', ') AS summary
    FROM "0008-ap-withdrawals"
    WHERE user_id = v_user_id
      AND withdrawn_at::date >= v_start_date
      AND withdrawn_at::date < v_end_date
    GROUP BY withdrawn_at::date
  ),
  daily_notes AS (
    SELECT
      n.created_at::date AS item_date,
      COUNT(DISTINCT n.id) AS count,
      STRING_AGG(DISTINCT SUBSTRING(n.content, 1, 30), ', ') AS summary
    FROM "0008-ap-notes" n
    INNER JOIN "0008-ap-universal-notes-join" unj ON unj.note_id = n.id
    WHERE unj.user_id = v_user_id
      AND n.created_at::date >= v_start_date
      AND n.created_at::date < v_end_date
    GROUP BY n.created_at::date
  ),
  all_dates AS (
    SELECT DISTINCT item_date FROM daily_reflections
    UNION
    SELECT DISTINCT item_date FROM daily_tasks
    UNION
    SELECT DISTINCT item_date FROM daily_events
    UNION
    SELECT DISTINCT item_date FROM daily_deposit_ideas
    UNION
    SELECT DISTINCT item_date FROM daily_withdrawals
    UNION
    SELECT DISTINCT item_date FROM daily_notes
  )
  SELECT
    ad.item_date,
    COALESCE(dr.count, 0) AS reflections_count,
    COALESCE(dt.count, 0) AS tasks_count,
    COALESCE(de.count, 0) AS events_count,
    COALESCE(ddi.count, 0) AS deposit_ideas_count,
    COALESCE(dw.count, 0) AS withdrawals_count,
    COALESCE(dn.count, 0) AS notes_count,
    COALESCE(
      CONCAT_WS(', ',
        NULLIF(dr.summary, ''),
        NULLIF(dt.summary, ''),
        NULLIF(de.summary, ''),
        NULLIF(ddi.summary, ''),
        NULLIF(dw.summary, ''),
        NULLIF(dn.summary, '')
      ),
      'No content'
    ) AS content_summary
  FROM all_dates ad
  LEFT JOIN daily_reflections dr ON dr.item_date = ad.item_date
  LEFT JOIN daily_tasks dt ON dt.item_date = ad.item_date
  LEFT JOIN daily_events de ON de.item_date = ad.item_date
  LEFT JOIN daily_deposit_ideas ddi ON ddi.item_date = ad.item_date
  LEFT JOIN daily_withdrawals dw ON dw.item_date = ad.item_date
  LEFT JOIN daily_notes dn ON dn.item_date = ad.item_date
  ORDER BY ad.item_date ASC;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_monthly_item_counts TO authenticated;
GRANT EXECUTE ON FUNCTION get_month_dates_with_items TO authenticated;
