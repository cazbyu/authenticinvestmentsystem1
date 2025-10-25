-- =============================================================================
-- FIX: p_max_occurrences Error
-- =============================================================================
-- Run this script in Supabase SQL Editor to fix the "column p_max_occurrences does not exist" error
-- The issue was that the variable was incorrectly named with p_ prefix (parameter convention)
-- instead of v_ prefix (local variable convention)
-- =============================================================================

-- Drop the views that depend on the function
DROP VIEW IF EXISTS v_dashboard_next_occurrences;
DROP VIEW IF EXISTS v_tasks_with_recurrence_expanded;

-- Drop all versions of the function
DROP FUNCTION IF EXISTS fn_expand_recurrence_dates(date, text, date, jsonb, integer);
DROP FUNCTION IF EXISTS fn_expand_recurrence_dates(date, text, date, jsonb, integer, integer);
DROP FUNCTION IF EXISTS fn_expand_recurrence_dates(timestamp, text, timestamp, jsonb, integer, integer);

-- Recreate the function with the corrected variable name
CREATE OR REPLACE FUNCTION fn_expand_recurrence_dates(
  p_start_date date,
  p_rrule text,
  p_until_date date DEFAULT NULL,
  p_exceptions jsonb DEFAULT '[]'::jsonb,
  p_max_future_days integer DEFAULT 365,
  p_max_past_days integer DEFAULT 90
)
RETURNS TABLE (occurrence_date date)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  -- parsed RRULE components
  v_freq         text;
  v_interval     integer := 1;
  v_count        integer := NULL;
  v_byday        text := NULL;
  v_bymonthday   integer := NULL;
  v_bysetpos     integer := NULL;

  -- working vars
  v_window_start date;
  v_window_end   date;
  v_current_date date;
  v_occurs       integer := 0;
  v_ex_dates     date[];
  v_day_codes    text[];
  v_day_code     text;
  v_dow          integer;
  v_tmp          date;
  v_month_last   integer;
  v_max_occurrences integer := 1000; -- FIXED: was p_max_occurrences
BEGIN
  -- ---- Parse RRULE ----
  v_freq := (regexp_match(p_rrule, 'FREQ=([A-Z]+)'))[1];
  IF v_freq IS NULL THEN
    RAISE NOTICE 'Invalid RRULE (no FREQ): %', p_rrule;
    RETURN;
  END IF;

  IF p_rrule ~ 'INTERVAL='   THEN v_interval   := (regexp_match(p_rrule, 'INTERVAL=(\d+)'))[1]::integer; END IF;
  IF p_rrule ~ 'COUNT='      THEN v_count      := (regexp_match(p_rrule, 'COUNT=(\d+)'))[1]::integer; END IF;
  IF p_rrule ~ 'BYDAY='      THEN v_byday      := (regexp_match(p_rrule, 'BYDAY=([A-Z,]+)'))[1]; END IF;
  IF p_rrule ~ 'BYMONTHDAY=' THEN v_bymonthday := (regexp_match(p_rrule, 'BYMONTHDAY=(-?\d+)'))[1]::integer; END IF;
  IF p_rrule ~ 'BYSETPOS='   THEN v_bysetpos   := (regexp_match(p_rrule, 'BYSETPOS=(-?\d+)'))[1]::integer; END IF;

  -- ---- Window (past/future) ----
  v_window_start := GREATEST(p_start_date - p_max_past_days, p_start_date - p_max_past_days);
  v_window_end   := COALESCE(p_until_date, CURRENT_DATE + p_max_future_days);

  -- start iteration at the first relevant boundary for each FREQ
  IF v_freq = 'WEEKLY' THEN
    v_current_date := date_trunc('week', GREATEST(p_start_date, v_window_start))::date;
    v_current_date := v_current_date - ((EXTRACT(DOW FROM v_current_date)::int)::text || ' days')::interval;
  ELSIF v_freq = 'MONTHLY' THEN
    v_current_date := date_trunc('month', GREATEST(p_start_date, v_window_start))::date;
  ELSIF v_freq = 'YEARLY' THEN
    v_current_date := make_date(EXTRACT(YEAR FROM GREATEST(p_start_date, v_window_start))::int,
                                EXTRACT(MONTH FROM p_start_date)::int,
                                EXTRACT(DAY FROM p_start_date)::int);
  ELSE
    v_current_date := GREATEST(p_start_date, v_window_start);
  END IF;

  v_ex_dates := ARRAY(SELECT jsonb_array_elements_text(p_exceptions)::date);

  -- ---- MAIN LOOP ----
  WHILE v_current_date <= v_window_end LOOP
    IF v_freq = 'DAILY' THEN
      IF v_current_date >= GREATEST(p_start_date, v_window_start)
         AND v_current_date <= v_window_end
         AND NOT (v_current_date = ANY (v_ex_dates)) THEN
        occurrence_date := v_current_date;
        RETURN NEXT;
        v_occurs := v_occurs + 1;
        IF v_count IS NOT NULL AND v_occurs >= v_count THEN RETURN; END IF;
      END IF;
      v_current_date := v_current_date + v_interval;

    ELSIF v_freq = 'WEEKLY' THEN
      IF v_byday IS NULL THEN
        v_byday := CASE EXTRACT(DOW FROM p_start_date)
          WHEN 0 THEN 'SU' WHEN 1 THEN 'MO' WHEN 2 THEN 'TU' WHEN 3 THEN 'WE'
          WHEN 4 THEN 'TH' WHEN 5 THEN 'FR' WHEN 6 THEN 'SA' END;
      END IF;
      v_day_codes := string_to_array(upper(v_byday), ',');

      FOREACH v_day_code IN ARRAY v_day_codes LOOP
        v_dow := CASE v_day_code
          WHEN 'SU' THEN 0 WHEN 'MO' THEN 1 WHEN 'TU' THEN 2 WHEN 'WE' THEN 3
          WHEN 'TH' THEN 4 WHEN 'FR' THEN 5 WHEN 'SA' THEN 6 END;

        v_tmp := v_current_date + (v_dow || ' days')::interval;

        IF v_tmp >= GREATEST(p_start_date, v_window_start)
           AND v_tmp <= v_window_end
           AND NOT (v_tmp = ANY (v_ex_dates)) THEN
          occurrence_date := v_tmp::date;
          RETURN NEXT;
          v_occurs := v_occurs + 1;
          IF v_count IS NOT NULL AND v_occurs >= v_count THEN RETURN; END IF;
        END IF;
      END LOOP;

      v_current_date := v_current_date + ((v_interval * 7) || ' days')::interval;

    ELSIF v_freq = 'MONTHLY' THEN
      v_tmp := NULL;

      IF v_bymonthday IS NOT NULL THEN
        v_month_last := EXTRACT(DAY FROM (date_trunc('month', v_current_date) + interval '1 month - 1 day'))::int;

        IF v_bymonthday > 0 THEN
          v_tmp := date_trunc('month', v_current_date)::date
                   + (LEAST(v_bymonthday, v_month_last) - 1);
        ELSE
          v_tmp := (date_trunc('month', v_current_date) + interval '1 month - 1 day')::date
                   + (v_bymonthday);
        END IF;

      ELSIF v_byday IS NOT NULL AND v_bysetpos IS NOT NULL THEN
        v_dow := CASE upper(v_byday)
          WHEN 'SU' THEN 0 WHEN 'MO' THEN 1 WHEN 'TU' THEN 2 WHEN 'WE' THEN 3
          WHEN 'TH' THEN 4 WHEN 'FR' THEN 5 WHEN 'SA' THEN 6 END;

        WITH month_days AS (
          SELECT d::date AS d,
                 ROW_NUMBER() OVER (ORDER BY d) AS rn,
                 ROW_NUMBER() OVER (ORDER BY d DESC) AS rn_rev
          FROM generate_series(date_trunc('month', v_current_date)::date,
                               (date_trunc('month', v_current_date) + interval '1 month - 1 day')::date,
                               '1 day'::interval) AS g(d)
          WHERE EXTRACT(DOW FROM d) = v_dow
        )
        SELECT d INTO v_tmp
        FROM month_days
        WHERE (v_bysetpos > 0 AND rn = v_bysetpos)
           OR (v_bysetpos < 0 AND rn_rev = -v_bysetpos);

      ELSE
        v_month_last := EXTRACT(DAY FROM (date_trunc('month', v_current_date) + interval '1 month - 1 day'))::int;
        v_tmp := date_trunc('month', v_current_date)::date
                 + (LEAST(EXTRACT(DAY FROM p_start_date)::int, v_month_last) - 1);
      END IF;

      IF v_tmp IS NOT NULL
         AND v_tmp >= GREATEST(p_start_date, v_window_start)
         AND v_tmp <= v_window_end
         AND NOT (v_tmp = ANY (v_ex_dates)) THEN
        occurrence_date := v_tmp;
        RETURN NEXT;
        v_occurs := v_occurs + 1;
        IF v_count IS NOT NULL AND v_occurs >= v_count THEN RETURN; END IF;
      END IF;

      v_current_date := (date_trunc('month', v_current_date) + (v_interval || ' months')::interval)::date;

    ELSIF v_freq = 'YEARLY' THEN
      v_tmp := make_date(EXTRACT(YEAR FROM v_current_date)::int,
                         EXTRACT(MONTH FROM p_start_date)::int,
                         LEAST(EXTRACT(DAY FROM p_start_date)::int,
                               EXTRACT(DAY FROM (date_trunc('month', make_date(EXTRACT(YEAR FROM v_current_date)::int,
                                                                              EXTRACT(MONTH FROM p_start_date)::int,
                                                                              1)) + interval '1 month - 1 day'))::int));

      IF v_tmp >= GREATEST(p_start_date, v_window_start)
         AND v_tmp <= v_window_end
         AND NOT (v_tmp = ANY (v_ex_dates)) THEN
        occurrence_date := v_tmp;
        RETURN NEXT;
        v_occurs := v_occurs + 1;
        IF v_count IS NOT NULL AND v_occurs >= v_count THEN RETURN; END IF;
      END IF;

      v_current_date := (date_trunc('year', v_current_date) + (v_interval || ' years')::interval)::date;

    ELSE
      RAISE NOTICE 'Unsupported FREQ: %', v_freq;
      RETURN;
    END IF;

    -- FIXED: Changed from p_max_occurrences to v_max_occurrences
    IF v_occurs >= v_max_occurrences THEN
      RETURN;
    END IF;
  END LOOP;

  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_expand_recurrence_dates(date, text, date, jsonb, integer, integer) TO authenticated;

-- Recreate the expanded view
CREATE OR REPLACE VIEW v_tasks_with_recurrence_expanded AS
SELECT
  t.id, t.user_id, t.parent_task_id, t.type, t.title, t.status,
  t.due_date, t.start_date, t.end_date, t.start_time, t.end_time,
  t.completed_at, t.is_urgent, t.is_important, t.is_all_day, t.is_authentic_deposit,
  t.user_global_timeline_id, t.custom_timeline_id, t.input_kind,
  t.recurrence_rule, t.recurrence_end_date, t.recurrence_exceptions,
  t.created_at, t.updated_at,
  t.due_date AS occurrence_date,
  false AS is_virtual_occurrence,
  t.id AS source_task_id
FROM "0008-ap-tasks" t
WHERE t.recurrence_rule IS NULL
  AND t.deleted_at IS NULL
  AND t.parent_task_id IS NULL

UNION ALL

SELECT
  t.id, t.user_id, t.parent_task_id, t.type, t.title, t.status,
  t.due_date, t.start_date, t.end_date, t.start_time, t.end_time,
  t.completed_at, t.is_urgent, t.is_important, t.is_all_day, t.is_authentic_deposit,
  t.user_global_timeline_id, t.custom_timeline_id, t.input_kind,
  t.recurrence_rule, t.recurrence_end_date, t.recurrence_exceptions,
  t.created_at, t.updated_at,
  t.due_date AS occurrence_date,
  false AS is_virtual_occurrence,
  t.id AS source_task_id
FROM "0008-ap-tasks" t
WHERE t.recurrence_rule IS NOT NULL
  AND t.deleted_at IS NULL
  AND t.parent_task_id IS NULL

UNION ALL

SELECT
  t.id, t.user_id, t.parent_task_id, t.type, t.title,
  'pending' AS status,
  x.occurrence_date AS due_date,
  CASE WHEN t.start_date IS NOT NULL
       THEN x.occurrence_date + (t.start_date - COALESCE(t.due_date, t.start_date))
       ELSE NULL END AS start_date,
  CASE WHEN t.end_date IS NOT NULL
       THEN x.occurrence_date + (t.end_date - COALESCE(t.due_date, t.start_date))
       ELSE NULL END AS end_date,
  t.start_time, t.end_time,
  NULL AS completed_at,
  t.is_urgent, t.is_important, t.is_all_day, t.is_authentic_deposit,
  t.user_global_timeline_id, t.custom_timeline_id, t.input_kind,
  t.recurrence_rule, t.recurrence_end_date, t.recurrence_exceptions,
  t.created_at, t.updated_at,
  x.occurrence_date,
  true AS is_virtual_occurrence,
  t.id AS source_task_id
FROM "0008-ap-tasks" t
CROSS JOIN LATERAL fn_expand_recurrence_dates(
  COALESCE(t.due_date, t.start_date, CURRENT_DATE),
  t.recurrence_rule,
  t.recurrence_end_date,
  t.recurrence_exceptions,
  365,
  90
) AS x
WHERE t.recurrence_rule IS NOT NULL
  AND t.deleted_at IS NULL
  AND t.parent_task_id IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "0008-ap-tasks" c
    WHERE c.parent_task_id = t.id
      AND c.due_date = x.occurrence_date
      AND c.status = 'completed'
      AND c.deleted_at IS NULL
  );

GRANT SELECT ON v_tasks_with_recurrence_expanded TO authenticated;

-- Recreate the dashboard view
CREATE OR REPLACE VIEW v_dashboard_next_occurrences AS
WITH next_occ AS (
  SELECT
    source_task_id,
    MIN(occurrence_date) FILTER (WHERE occurrence_date >= CURRENT_DATE) AS next_occurrence_date
  FROM v_tasks_with_recurrence_expanded
  WHERE recurrence_rule IS NOT NULL
    AND is_virtual_occurrence
  GROUP BY source_task_id
)
SELECT t.*
FROM v_tasks_with_recurrence_expanded t
JOIN next_occ n
  ON t.source_task_id = n.source_task_id
 AND t.occurrence_date = n.next_occurrence_date
WHERE t.recurrence_rule IS NOT NULL
  AND t.is_virtual_occurrence
UNION ALL
SELECT t.*
FROM v_tasks_with_recurrence_expanded t
WHERE t.recurrence_rule IS NULL;

GRANT SELECT ON v_dashboard_next_occurrences TO authenticated;

-- Verification
SELECT '✓ Function fixed and recreated' AS status;
SELECT '✓ Views recreated successfully' AS status;
SELECT '✓ Ready to test in dashboard' AS status;
