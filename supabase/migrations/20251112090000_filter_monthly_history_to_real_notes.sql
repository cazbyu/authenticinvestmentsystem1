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
    SELECT DISTINCT
      j.parent_type,
      j.parent_id,
      (n.created_at AT TIME ZONE v_user_timezone)::date AS note_date
    FROM "0008-ap-universal-notes-join" j
    INNER JOIN "0008-ap-notes" n ON n.id = j.note_id
    WHERE
      j.user_id = v_user_id
      AND n.user_id = v_user_id
      AND (
        (n.content IS NOT NULL AND btrim(n.content) <> '')
        OR EXISTS (
          SELECT 1
          FROM "0008-ap-note-attachments" na
          WHERE na.note_id = n.id
            AND na.user_id = v_user_id
        )
      )
      AND (n.created_at AT TIME ZONE v_user_timezone)::date >= v_start_date
      AND (n.created_at AT TIME ZONE v_user_timezone)::date < v_end_date
  ),
  qualified_notes AS (
    SELECT DISTINCT
      parent_type,
      parent_id,
      note_date
    FROM note_filter
  ),
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
  task_items AS (
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
  ),
  daily_tasks AS (
    SELECT
      ti.task_date AS date_val,
      COUNT(DISTINCT ti.id) AS count_val,
      STRING_AGG(
        DISTINCT '• ' || ti.title,
        E'\n' ORDER BY ti.title
      ) AS summary_val
    FROM task_items ti
    INNER JOIN qualified_notes nf
      ON nf.parent_type = 'task'
     AND nf.parent_id = ti.id
     AND nf.note_date = ti.task_date
    WHERE ti.user_id = v_user_id
      AND ti.type = 'task'
      AND ti.deleted_at IS NULL
      AND ti.task_date IS NOT NULL
      AND ti.task_date >= v_start_date
      AND ti.task_date < v_end_date
    GROUP BY ti.task_date
  ),
  event_items AS (
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
  ),
  daily_events AS (
    SELECT
      ei.event_date AS date_val,
      COUNT(DISTINCT ei.id) AS count_val,
      STRING_AGG(
        DISTINCT '• ' || ei.title,
        E'\n' ORDER BY ei.title
      ) AS summary_val
    FROM event_items ei
    INNER JOIN qualified_notes nf
      ON nf.parent_type = 'task'
     AND nf.parent_id = ei.id
     AND nf.note_date = ei.event_date
    WHERE ei.user_id = v_user_id
      AND ei.type = 'event'
      AND ei.deleted_at IS NULL
      AND ei.event_date IS NOT NULL
      AND ei.event_date >= v_start_date
      AND ei.event_date < v_end_date
    GROUP BY ei.event_date
  ),
  deposit_idea_items AS (
    SELECT
      d.id,
      d.user_id,
      d.title,
      COALESCE(
        (d.activated_at AT TIME ZONE v_user_timezone)::date,
        (d.created_at AT TIME ZONE v_user_timezone)::date
      ) AS idea_date
    FROM "0008-ap-deposit-ideas" d
  ),
  daily_deposit_ideas AS (
    SELECT
      di.idea_date AS date_val,
      COUNT(DISTINCT di.id) AS count_val,
      STRING_AGG(
        DISTINCT '• ' || di.title,
        E'\n' ORDER BY di.title
      ) AS summary_val
    FROM deposit_idea_items di
    INNER JOIN qualified_notes nf
      ON nf.parent_type = 'depositIdea'
     AND nf.parent_id = di.id
     AND nf.note_date = di.idea_date
    WHERE di.user_id = v_user_id
      AND di.idea_date IS NOT NULL
      AND di.idea_date >= v_start_date
      AND di.idea_date < v_end_date
    GROUP BY di.idea_date
  ),
  withdrawal_items AS (
    SELECT
      w.id,
      w.user_id,
      w.title,
      COALESCE(
        (w.withdrawn_at AT TIME ZONE v_user_timezone)::date,
        (w.created_at AT TIME ZONE v_user_timezone)::date
      ) AS withdrawal_date
    FROM "0008-ap-withdrawals" w
  ),
  daily_withdrawals AS (
    SELECT
      wi.withdrawal_date AS date_val,
      COUNT(DISTINCT wi.id) AS count_val,
      STRING_AGG(
        DISTINCT '• ' || COALESCE(wi.title, 'Withdrawal'),
        E'\n' ORDER BY COALESCE(wi.title, 'Withdrawal')
      ) AS summary_val
    FROM withdrawal_items wi
    INNER JOIN qualified_notes nf
      ON nf.parent_type = 'withdrawal'
     AND nf.parent_id = wi.id
     AND nf.note_date = wi.withdrawal_date
    WHERE wi.user_id = v_user_id
      AND wi.withdrawal_date IS NOT NULL
      AND wi.withdrawal_date >= v_start_date
      AND wi.withdrawal_date < v_end_date
    GROUP BY wi.withdrawal_date
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
