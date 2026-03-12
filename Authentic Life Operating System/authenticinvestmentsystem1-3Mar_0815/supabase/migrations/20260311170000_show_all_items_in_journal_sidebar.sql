/*
  # Show ALL Items in Journal Sidebar (Not Just Items With Notes)

  ## Problem
  The get_month_dates_with_items, get_dates_with_items_by_range, and
  get_monthly_item_counts(year,month,user) functions only show tasks, events,
  deposit ideas, and withdrawals that have notes attached (via note_filter /
  note_with_dates CTEs). This causes the Journal sidebar page to be missing
  most entries that DO appear in the Journal tab on the dashboard.

  ## Solution
  - Fetch ALL completed tasks, completed events, active deposit ideas, and
    withdrawals directly (matching the Journal tab's query logic)
  - Add a has_notes boolean to each item in item_details JSONB
  - Reflections already fetched directly (no change needed)

  ## Impact
  - Journal sidebar page will now show ALL the same activities as the Journal tab
  - Items with notes will have has_notes: true in their JSONB for the frontend
    to display a note icon
  - MonthlyCardsView counts will now be accurate
*/

-- ============================================================
-- 1. Rewrite get_month_dates_with_items
-- ============================================================
DROP FUNCTION IF EXISTS get_month_dates_with_items(integer, integer, uuid);

CREATE FUNCTION get_month_dates_with_items(
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
  -- Subquery: which item IDs have notes with content or attachments
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

  -- Reflections: all non-archived (same as before)
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

  -- Completed tasks: ALL completed tasks (not just ones with notes)
  daily_tasks AS (
    SELECT
      (t.completed_at AT TIME ZONE v_user_timezone)::date AS date_val,
      COUNT(DISTINCT t.id) AS count_val,
      STRING_AGG(
        '• ' || t.title,
        E'\n' ORDER BY t.title
      ) AS summary_val,
      jsonb_agg(
        jsonb_build_object(
          'type', 'task',
          'title', t.title,
          'has_notes', CASE WHEN iwn.parent_id IS NOT NULL THEN true ELSE false END
        ) ORDER BY t.title
      ) AS details_val
    FROM "0008-ap-tasks" t
    LEFT JOIN items_with_notes iwn
      ON iwn.parent_id = t.id AND iwn.parent_type = 'task'
    WHERE t.user_id = v_user_id
      AND t.type = 'task'
      AND t.status = 'completed'
      AND t.completed_at IS NOT NULL
      AND t.deleted_at IS NULL
      AND (t.completed_at AT TIME ZONE v_user_timezone)::date >= v_start_date
      AND (t.completed_at AT TIME ZONE v_user_timezone)::date < v_end_date
    GROUP BY (t.completed_at AT TIME ZONE v_user_timezone)::date
  ),

  -- Completed events: ALL completed events
  daily_events AS (
    SELECT
      COALESCE(
        t.end_date,
        t.start_date,
        (t.completed_at AT TIME ZONE v_user_timezone)::date
      ) AS date_val,
      COUNT(DISTINCT t.id) AS count_val,
      STRING_AGG(
        '• ' || t.title,
        E'\n' ORDER BY t.title
      ) AS summary_val,
      jsonb_agg(
        jsonb_build_object(
          'type', 'event',
          'title', t.title,
          'has_notes', CASE WHEN iwn.parent_id IS NOT NULL THEN true ELSE false END
        ) ORDER BY t.title
      ) AS details_val
    FROM "0008-ap-tasks" t
    LEFT JOIN items_with_notes iwn
      ON iwn.parent_id = t.id AND iwn.parent_type IN ('event', 'task')
    WHERE t.user_id = v_user_id
      AND t.type = 'event'
      AND t.status = 'completed'
      AND t.completed_at IS NOT NULL
      AND t.deleted_at IS NULL
      AND COALESCE(
            t.end_date,
            t.start_date,
            (t.completed_at AT TIME ZONE v_user_timezone)::date
          ) >= v_start_date
      AND COALESCE(
            t.end_date,
            t.start_date,
            (t.completed_at AT TIME ZONE v_user_timezone)::date
          ) < v_end_date
    GROUP BY COALESCE(
      t.end_date,
      t.start_date,
      (t.completed_at AT TIME ZONE v_user_timezone)::date
    )
  ),

  -- Active deposit ideas: ALL non-archived active ones
  daily_deposit_ideas AS (
    SELECT
      (d.created_at AT TIME ZONE v_user_timezone)::date AS date_val,
      COUNT(DISTINCT d.id) AS count_val,
      STRING_AGG(
        '• ' || d.title,
        E'\n' ORDER BY d.title
      ) AS summary_val,
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

  -- Withdrawals: ALL withdrawals
  daily_withdrawals AS (
    SELECT
      (w.withdrawn_at AT TIME ZONE v_user_timezone)::date AS date_val,
      COUNT(DISTINCT w.id) AS count_val,
      STRING_AGG(
        '• ' || COALESCE(w.title, 'Withdrawal'),
        E'\n' ORDER BY COALESCE(w.title, 'Withdrawal')
      ) AS summary_val,
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
    ) AS content_summary,
    (
      COALESCE(dr.details_val, '[]'::jsonb) ||
      COALESCE(dt.details_val, '[]'::jsonb) ||
      COALESCE(de.details_val, '[]'::jsonb) ||
      COALESCE(ddi.details_val, '[]'::jsonb) ||
      COALESCE(dw.details_val, '[]'::jsonb)
    ) AS item_details
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
  'Returns dates with ALL item types for a given month. Items include has_notes flag for frontend note icon display.';

GRANT EXECUTE ON FUNCTION get_month_dates_with_items TO authenticated;


-- ============================================================
-- 2. Rewrite get_dates_with_items_by_range
-- ============================================================
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
      AND (r.created_at AT TIME ZONE v_user_timezone)::date >= p_start_date
      AND (r.created_at AT TIME ZONE v_user_timezone)::date <= p_end_date
    GROUP BY (r.created_at AT TIME ZONE v_user_timezone)::date
  ),

  daily_tasks AS (
    SELECT
      (t.completed_at AT TIME ZONE v_user_timezone)::date AS date_val,
      COUNT(DISTINCT t.id) AS count_val,
      STRING_AGG(
        '• ' || t.title,
        E'\n' ORDER BY t.title
      ) AS summary_val,
      jsonb_agg(
        jsonb_build_object(
          'type', 'task',
          'title', t.title,
          'has_notes', CASE WHEN iwn.parent_id IS NOT NULL THEN true ELSE false END
        ) ORDER BY t.title
      ) AS details_val
    FROM "0008-ap-tasks" t
    LEFT JOIN items_with_notes iwn
      ON iwn.parent_id = t.id AND iwn.parent_type = 'task'
    WHERE t.user_id = v_user_id
      AND t.type = 'task'
      AND t.status = 'completed'
      AND t.completed_at IS NOT NULL
      AND t.deleted_at IS NULL
      AND (t.completed_at AT TIME ZONE v_user_timezone)::date >= p_start_date
      AND (t.completed_at AT TIME ZONE v_user_timezone)::date <= p_end_date
    GROUP BY (t.completed_at AT TIME ZONE v_user_timezone)::date
  ),

  daily_events AS (
    SELECT
      COALESCE(
        t.end_date,
        t.start_date,
        (t.completed_at AT TIME ZONE v_user_timezone)::date
      ) AS date_val,
      COUNT(DISTINCT t.id) AS count_val,
      STRING_AGG(
        '• ' || t.title,
        E'\n' ORDER BY t.title
      ) AS summary_val,
      jsonb_agg(
        jsonb_build_object(
          'type', 'event',
          'title', t.title,
          'has_notes', CASE WHEN iwn.parent_id IS NOT NULL THEN true ELSE false END
        ) ORDER BY t.title
      ) AS details_val
    FROM "0008-ap-tasks" t
    LEFT JOIN items_with_notes iwn
      ON iwn.parent_id = t.id AND iwn.parent_type IN ('event', 'task')
    WHERE t.user_id = v_user_id
      AND t.type = 'event'
      AND t.status = 'completed'
      AND t.completed_at IS NOT NULL
      AND t.deleted_at IS NULL
      AND COALESCE(
            t.end_date,
            t.start_date,
            (t.completed_at AT TIME ZONE v_user_timezone)::date
          ) >= p_start_date
      AND COALESCE(
            t.end_date,
            t.start_date,
            (t.completed_at AT TIME ZONE v_user_timezone)::date
          ) <= p_end_date
    GROUP BY COALESCE(
      t.end_date,
      t.start_date,
      (t.completed_at AT TIME ZONE v_user_timezone)::date
    )
  ),

  daily_deposit_ideas AS (
    SELECT
      (d.created_at AT TIME ZONE v_user_timezone)::date AS date_val,
      COUNT(DISTINCT d.id) AS count_val,
      STRING_AGG(
        '• ' || d.title,
        E'\n' ORDER BY d.title
      ) AS summary_val,
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
      AND (d.created_at AT TIME ZONE v_user_timezone)::date >= p_start_date
      AND (d.created_at AT TIME ZONE v_user_timezone)::date <= p_end_date
    GROUP BY (d.created_at AT TIME ZONE v_user_timezone)::date
  ),

  daily_withdrawals AS (
    SELECT
      (w.withdrawn_at AT TIME ZONE v_user_timezone)::date AS date_val,
      COUNT(DISTINCT w.id) AS count_val,
      STRING_AGG(
        '• ' || COALESCE(w.title, 'Withdrawal'),
        E'\n' ORDER BY COALESCE(w.title, 'Withdrawal')
      ) AS summary_val,
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
      AND (w.withdrawn_at AT TIME ZONE v_user_timezone)::date >= p_start_date
      AND (w.withdrawn_at AT TIME ZONE v_user_timezone)::date <= p_end_date
    GROUP BY (w.withdrawn_at AT TIME ZONE v_user_timezone)::date
  ),

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
  'Returns all dates in range with ALL item types. Items include has_notes flag for frontend note icon display.';

GRANT EXECUTE ON FUNCTION get_dates_with_items_by_range TO authenticated;


-- ============================================================
-- 3. Rewrite get_monthly_item_counts (3-param version)
--    Used by get_history_month_summaries for card totals
-- ============================================================
DROP FUNCTION IF EXISTS get_monthly_item_counts(integer, integer, uuid);

CREATE FUNCTION get_monthly_item_counts(
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
  refl AS (
    SELECT COUNT(*)::bigint AS count_val
    FROM "0008-ap-reflections"
    WHERE user_id = v_user_id
      AND archived = false
      AND (created_at AT TIME ZONE v_user_timezone)::date >= v_start_date
      AND (created_at AT TIME ZONE v_user_timezone)::date < v_end_date
  ),

  tasks AS (
    SELECT COUNT(DISTINCT id)::bigint AS count_val
    FROM "0008-ap-tasks"
    WHERE user_id = v_user_id
      AND type = 'task'
      AND status = 'completed'
      AND completed_at IS NOT NULL
      AND deleted_at IS NULL
      AND (completed_at AT TIME ZONE v_user_timezone)::date >= v_start_date
      AND (completed_at AT TIME ZONE v_user_timezone)::date < v_end_date
  ),

  events AS (
    SELECT COUNT(DISTINCT id)::bigint AS count_val
    FROM "0008-ap-tasks"
    WHERE user_id = v_user_id
      AND type = 'event'
      AND status = 'completed'
      AND completed_at IS NOT NULL
      AND deleted_at IS NULL
      AND COALESCE(
            end_date,
            start_date,
            (completed_at AT TIME ZONE v_user_timezone)::date
          ) >= v_start_date
      AND COALESCE(
            end_date,
            start_date,
            (completed_at AT TIME ZONE v_user_timezone)::date
          ) < v_end_date
  ),

  deposit_ideas AS (
    SELECT COUNT(DISTINCT id)::bigint AS count_val
    FROM "0008-ap-deposit-ideas"
    WHERE user_id = v_user_id
      AND archived = false
      AND COALESCE(is_active, true) = true
      AND (created_at AT TIME ZONE v_user_timezone)::date >= v_start_date
      AND (created_at AT TIME ZONE v_user_timezone)::date < v_end_date
  ),

  withdrawals AS (
    SELECT COUNT(DISTINCT id)::bigint AS count_val
    FROM "0008-ap-withdrawals"
    WHERE user_id = v_user_id
      AND (withdrawn_at AT TIME ZONE v_user_timezone)::date >= v_start_date
      AND (withdrawn_at AT TIME ZONE v_user_timezone)::date < v_end_date
  )

  SELECT
    v_start_date AS month_start,
    (SELECT COALESCE(count_val, 0) FROM refl)           AS reflections_count,
    (SELECT COALESCE(count_val, 0) FROM tasks)          AS tasks_count,
    (SELECT COALESCE(count_val, 0) FROM events)         AS events_count,
    (SELECT COALESCE(count_val, 0) FROM deposit_ideas)  AS deposit_ideas_count,
    (SELECT COALESCE(count_val, 0) FROM withdrawals)    AS withdrawals_count,
    (
      (SELECT COALESCE(count_val, 0) FROM refl) +
      (SELECT COALESCE(count_val, 0) FROM tasks) +
      (SELECT COALESCE(count_val, 0) FROM events) +
      (SELECT COALESCE(count_val, 0) FROM deposit_ideas) +
      (SELECT COALESCE(count_val, 0) FROM withdrawals)
    ) AS total_items;
END;
$$;

COMMENT ON FUNCTION get_monthly_item_counts(integer, integer, uuid) IS
  'Returns item counts for a single month. Counts ALL completed tasks/events, active deposit ideas, and withdrawals (not just ones with notes).';

GRANT EXECUTE ON FUNCTION get_monthly_item_counts(integer, integer, uuid) TO authenticated;
