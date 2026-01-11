/*
  # Create Date Range History Function

  1. New Function
    - `get_dates_with_items_by_range` - Returns items grouped by date for a date range

  2. Purpose
    - Supports Dashboard Reflect tab filtering by date range (today, week, month)
    - Uses same logic as `get_month_dates_with_items` but with flexible date parameters
    - Returns all dates in range, even those without items

  3. Behavior
    - Generates complete list of dates in range
    - Shows items based on note creation dates (consistent with daily view)
    - Returns item details with type and title for each item

  4. Security
    - SECURITY DEFINER function
    - Filters by authenticated user ID
    - Grants execute to authenticated users only
*/

CREATE OR REPLACE FUNCTION get_dates_with_items_by_range(
  p_start_date date,
  p_end_date date,
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
  WITH note_with_dates AS (
    -- Get all real notes with their creation dates and parent info
    SELECT
      j.parent_type,
      j.parent_id,
      j.note_id,
      n.created_at,
      (n.created_at AT TIME ZONE v_user_timezone)::date AS note_date
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
      AND (n.created_at AT TIME ZONE v_user_timezone)::date >= p_start_date
      AND (n.created_at AT TIME ZONE v_user_timezone)::date <= p_end_date
  ),

  daily_reflections AS (
    -- Reflections appear on their creation date
    SELECT
      (created_at AT TIME ZONE v_user_timezone)::date AS date_val,
      COUNT(DISTINCT id) AS count_val,
      STRING_AGG(
        '• ' || COALESCE(reflection_title, SUBSTRING(content, 1, 50)),
        E'\n'
      ) AS summary_val,
      jsonb_agg(
        jsonb_build_object(
          'type', CASE
            WHEN daily_rose = true THEN 'rose'
            WHEN daily_thorn = true THEN 'thorn'
            ELSE 'reflection'
          END,
          'title', COALESCE(reflection_title, SUBSTRING(content, 1, 50))
        )
      ) AS details_val
    FROM "0008-ap-reflections"
    WHERE user_id = v_user_id
      AND archived = false
      AND (created_at AT TIME ZONE v_user_timezone)::date >= p_start_date
      AND (created_at AT TIME ZONE v_user_timezone)::date <= p_end_date
    GROUP BY (created_at AT TIME ZONE v_user_timezone)::date
  ),

  daily_tasks AS (
    -- Tasks appear on the date their NOTE was created
    SELECT
      nwd.note_date AS date_val,
      COUNT(DISTINCT t.id) AS count_val,
      STRING_AGG(
        '• ' || t.title,
        E'\n' ORDER BY t.title
      ) AS summary_val,
      jsonb_agg(
        jsonb_build_object(
          'type', 'note',
          'title', t.title
        ) ORDER BY t.title
      ) AS details_val
    FROM "0008-ap-tasks" t
    JOIN note_with_dates nwd
      ON nwd.parent_type = 'task'
     AND nwd.parent_id = t.id
    WHERE t.user_id = v_user_id
      AND t.type = 'task'
      AND t.deleted_at IS NULL
    GROUP BY nwd.note_date
  ),

  daily_events AS (
    -- Events appear on the date their NOTE was created
    SELECT
      nwd.note_date AS date_val,
      COUNT(DISTINCT t.id) AS count_val,
      STRING_AGG(
        '• ' || t.title,
        E'\n' ORDER BY t.title
      ) AS summary_val,
      jsonb_agg(
        jsonb_build_object(
          'type', 'note',
          'title', t.title
        ) ORDER BY t.title
      ) AS details_val
    FROM "0008-ap-tasks" t
    JOIN note_with_dates nwd
      ON nwd.parent_type IN ('event', 'task')
     AND nwd.parent_id = t.id
    WHERE t.user_id = v_user_id
      AND t.type = 'event'
      AND t.deleted_at IS NULL
    GROUP BY nwd.note_date
  ),

  daily_deposit_ideas AS (
    -- Deposit ideas appear on the date their NOTE was created
    SELECT
      nwd.note_date AS date_val,
      COUNT(DISTINCT d.id) AS count_val,
      STRING_AGG(
        '• ' || d.title,
        E'\n' ORDER BY d.title
      ) AS summary_val,
      jsonb_agg(
        jsonb_build_object(
          'type', 'note',
          'title', d.title
        ) ORDER BY d.title
      ) AS details_val
    FROM "0008-ap-deposit-ideas" d
    JOIN note_with_dates nwd
      ON nwd.parent_type = 'depositIdea'
     AND nwd.parent_id = d.id
    WHERE d.user_id = v_user_id
      AND d.archived = false
      AND COALESCE(d.is_active, true) = true
    GROUP BY nwd.note_date
  ),

  daily_withdrawals AS (
    -- Withdrawals appear on the date their NOTE was created
    SELECT
      nwd.note_date AS date_val,
      COUNT(DISTINCT w.id) AS count_val,
      STRING_AGG(
        '• ' || COALESCE(w.title, 'Withdrawal'),
        E'\n' ORDER BY COALESCE(w.title, 'Withdrawal')
      ) AS summary_val,
      jsonb_agg(
        jsonb_build_object(
          'type', 'note',
          'title', COALESCE(w.title, 'Withdrawal')
        ) ORDER BY COALESCE(w.title, 'Withdrawal')
      ) AS details_val
    FROM "0008-ap-withdrawals" w
    JOIN note_with_dates nwd
      ON nwd.parent_type = 'withdrawal'
     AND nwd.parent_id = w.id
    WHERE w.user_id = v_user_id
    GROUP BY nwd.note_date
  ),

  -- Generate complete date range
  date_series AS (
    SELECT generate_series(p_start_date, p_end_date, '1 day'::interval)::date AS date_val
  ),

  items_by_date AS (
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
    ds.date_val AS item_date,
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
    ) AS content_summary,
    CASE
      WHEN ibd.date_val IS NULL THEN '[]'::jsonb
      ELSE (
        COALESCE(dr.details_val, '[]'::jsonb) ||
        COALESCE(dt.details_val, '[]'::jsonb) ||
        COALESCE(de.details_val, '[]'::jsonb) ||
        COALESCE(ddi.details_val, '[]'::jsonb) ||
        COALESCE(dw.details_val, '[]'::jsonb)
      )
    END AS item_details
  FROM date_series ds
  LEFT JOIN items_by_date ibd ON ibd.date_val = ds.date_val
  LEFT JOIN daily_reflections dr ON dr.date_val = ds.date_val
  LEFT JOIN daily_tasks dt ON dt.date_val = ds.date_val
  LEFT JOIN daily_events de ON de.date_val = ds.date_val
  LEFT JOIN daily_deposit_ideas ddi ON ddi.date_val = ds.date_val
  LEFT JOIN daily_withdrawals dw ON dw.date_val = ds.date_val
  ORDER BY ds.date_val DESC;
END;
$$;

COMMENT ON FUNCTION get_dates_with_items_by_range IS
  'Returns all dates in range with item counts based on note creation dates. Returns all dates even if empty.';

GRANT EXECUTE ON FUNCTION get_dates_with_items_by_range TO authenticated;
