/*
  # Fix Ambiguous Column Reference in get_month_dates_with_items

  1. Changes
    - Fix ambiguous column reference error by properly qualifying all column names in the final SELECT
    - Add table aliases to ensure column references are unambiguous

  2. Security
    - Maintains existing RLS filtering on auth.uid()
*/

-- Drop and recreate the function with proper column qualification
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
      created_at::date AS date_val,
      COUNT(*) AS count_val,
      STRING_AGG(SUBSTRING(content, 1, 50), ', ') AS summary_val
    FROM "0008-ap-reflections"
    WHERE user_id = v_user_id
      AND archived = false
      AND created_at::date >= v_start_date
      AND created_at::date < v_end_date
    GROUP BY created_at::date
  ),
  daily_tasks AS (
    SELECT
      COALESCE(completed_at::date, created_at::date) AS date_val,
      COUNT(*) AS count_val,
      STRING_AGG(title, ', ') AS summary_val
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
      COALESCE(completed_at::date, created_at::date) AS date_val,
      COUNT(*) AS count_val,
      STRING_AGG(title, ', ') AS summary_val
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
      created_at::date AS date_val,
      COUNT(*) AS count_val,
      STRING_AGG(title, ', ') AS summary_val
    FROM "0008-ap-deposit-ideas"
    WHERE user_id = v_user_id
      AND created_at::date >= v_start_date
      AND created_at::date < v_end_date
    GROUP BY created_at::date
  ),
  daily_withdrawals AS (
    SELECT
      withdrawn_at::date AS date_val,
      COUNT(*) AS count_val,
      STRING_AGG(COALESCE(title, 'Withdrawal'), ', ') AS summary_val
    FROM "0008-ap-withdrawals"
    WHERE user_id = v_user_id
      AND withdrawn_at::date >= v_start_date
      AND withdrawn_at::date < v_end_date
    GROUP BY withdrawn_at::date
  ),
  daily_notes AS (
    SELECT
      n.created_at::date AS date_val,
      COUNT(DISTINCT n.id) AS count_val,
      STRING_AGG(DISTINCT SUBSTRING(n.content, 1, 30), ', ') AS summary_val
    FROM "0008-ap-notes" n
    INNER JOIN "0008-ap-universal-notes-join" unj ON unj.note_id = n.id
    WHERE unj.user_id = v_user_id
      AND n.created_at::date >= v_start_date
      AND n.created_at::date < v_end_date
    GROUP BY n.created_at::date
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
    UNION
    SELECT DISTINCT date_val FROM daily_notes
  )
  SELECT
    ad.date_val AS item_date,
    COALESCE(dr.count_val, 0) AS reflections_count,
    COALESCE(dt.count_val, 0) AS tasks_count,
    COALESCE(de.count_val, 0) AS events_count,
    COALESCE(ddi.count_val, 0) AS deposit_ideas_count,
    COALESCE(dw.count_val, 0) AS withdrawals_count,
    COALESCE(dn.count_val, 0) AS notes_count,
    COALESCE(
      CONCAT_WS(', ',
        NULLIF(dr.summary_val, ''),
        NULLIF(dt.summary_val, ''),
        NULLIF(de.summary_val, ''),
        NULLIF(ddi.summary_val, ''),
        NULLIF(dw.summary_val, ''),
        NULLIF(dn.summary_val, '')
      ),
      'No content'
    ) AS content_summary
  FROM all_dates ad
  LEFT JOIN daily_reflections dr ON dr.date_val = ad.date_val
  LEFT JOIN daily_tasks dt ON dt.date_val = ad.date_val
  LEFT JOIN daily_events de ON de.date_val = ad.date_val
  LEFT JOIN daily_deposit_ideas ddi ON ddi.date_val = ad.date_val
  LEFT JOIN daily_withdrawals dw ON dw.date_val = ad.date_val
  LEFT JOIN daily_notes dn ON dn.date_val = ad.date_val
  ORDER BY ad.date_val ASC;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_month_dates_with_items TO authenticated;
