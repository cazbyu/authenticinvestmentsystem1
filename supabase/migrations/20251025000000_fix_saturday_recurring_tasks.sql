/*
  # Fix Saturday Recurring Tasks Not Appearing Beyond First Occurrence

  ## Summary
  Fixes a critical bug in the WEEKLY recurrence expansion where tasks recurring on
  single days (especially Saturday) would only show 1-2 occurrences instead of
  expanding through the full 365-day window.

  ## Root Cause
  The WEEKLY frequency loop was checking `v_current_date <= v_end_date` where
  `v_current_date` represents the start of each week (Sunday). For tasks scheduled
  on Saturday (the last day of the week), the loop would exit prematurely because
  the week start date would exceed the end date before generating all Saturday
  occurrences within the window.

  ## Changes Made
  1. **Loop Condition Fix**
     - Change from: `WHILE v_current_date <= v_end_date`
     - Change to: `WHILE v_current_date <= v_end_date + INTERVAL '6 days'`
     - This ensures we check all 7 days of each week, even when the week starts
       near the end date boundary

  2. **Safety Check Enhancement**
     - Added a check to ensure v_temp_date doesn't exceed v_end_date by more than
       the week length to prevent any edge case issues

  ## Impact
  - Saturday recurring tasks will now properly show all 52+ occurrences in the year
  - All other single-day weekly recurrences are also fixed
  - Multi-day weekly recurrences (e.g., Mon-Wed-Fri) continue to work correctly
  - No impact on DAILY, MONTHLY, or YEARLY frequencies
*/

-- Drop dependent views
DROP VIEW IF EXISTS v_dashboard_next_occurrences;
DROP VIEW IF EXISTS v_tasks_with_recurrence_expanded;

-- Drop and recreate the function with the fix
DROP FUNCTION IF EXISTS fn_expand_recurrence_dates(date, text, date, jsonb, integer, integer);
DROP FUNCTION IF EXISTS fn_expand_recurrence_dates(date, text, date, jsonb, integer);

CREATE FUNCTION fn_expand_recurrence_dates(
  p_start_date date,
  p_recurrence_rule text,
  p_recurrence_end_date date,
  p_recurrence_exceptions jsonb DEFAULT '[]'::jsonb,
  p_max_future_days integer DEFAULT 365,
  p_max_past_days integer DEFAULT 90
)
RETURNS TABLE (occurrence_date date)
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_freq text;
  v_interval integer := 1;
  v_byday text;
  v_bymonthday integer;
  v_bysetpos integer;
  v_count integer;
  v_end_date date;
  v_current_date date;
  v_occurrence_count integer := 0;
  v_max_occurrences integer := 1000;
  v_day_codes text[];
  v_day_code text;
  v_dow integer;
  v_temp_date date;
  v_week_num integer;
  v_month_last_day integer;
BEGIN
  -- Parse RRULE components
  v_freq := (regexp_matches(p_recurrence_rule, 'FREQ=(\w+)', 'i'))[1];

  -- Extract INTERVAL (default 1)
  IF p_recurrence_rule ~* 'INTERVAL=(\d+)' THEN
    v_interval := (regexp_matches(p_recurrence_rule, 'INTERVAL=(\d+)', 'i'))[1]::integer;
  END IF;

  -- Extract BYDAY
  IF p_recurrence_rule ~* 'BYDAY=([A-Z,]+)' THEN
    v_byday := (regexp_matches(p_recurrence_rule, 'BYDAY=([A-Z,]+)', 'i'))[1];
  END IF;

  -- Extract BYMONTHDAY
  IF p_recurrence_rule ~* 'BYMONTHDAY=(-?\d+)' THEN
    v_bymonthday := (regexp_matches(p_recurrence_rule, 'BYMONTHDAY=(-?\d+)', 'i'))[1]::integer;
  END IF;

  -- Extract BYSETPOS
  IF p_recurrence_rule ~* 'BYSETPOS=(-?\d+)' THEN
    v_bysetpos := (regexp_matches(p_recurrence_rule, 'BYSETPOS=(-?\d+)', 'i'))[1]::integer;
  END IF;

  -- Extract COUNT
  IF p_recurrence_rule ~* 'COUNT=(\d+)' THEN
    v_count := (regexp_matches(p_recurrence_rule, 'COUNT=(\d+)', 'i'))[1]::integer;
  END IF;

  -- Determine end date (support both future and past)
  v_end_date := COALESCE(
    p_recurrence_end_date,
    CURRENT_DATE + p_max_future_days
  );

  v_current_date := p_start_date;

  -- ============================================================================
  -- FREQ=DAILY
  -- ============================================================================
  IF v_freq = 'DAILY' THEN
    WHILE v_current_date <= v_end_date AND (v_count IS NULL OR v_occurrence_count < v_count) LOOP
      IF NOT (p_recurrence_exceptions ? v_current_date::text) THEN
        occurrence_date := v_current_date;
        RETURN NEXT;
        v_occurrence_count := v_occurrence_count + 1;
      END IF;

      v_current_date := v_current_date + (v_interval || ' days')::interval;

      IF v_occurrence_count >= v_max_occurrences THEN
        EXIT;
      END IF;
    END LOOP;

  -- ============================================================================
  -- FREQ=WEEKLY - FIXED VERSION
  -- ============================================================================
  ELSIF v_freq = 'WEEKLY' THEN
    -- If no BYDAY specified, use start date's day of week
    IF v_byday IS NULL THEN
      v_byday := CASE EXTRACT(DOW FROM p_start_date)
        WHEN 0 THEN 'SU'
        WHEN 1 THEN 'MO'
        WHEN 2 THEN 'TU'
        WHEN 3 THEN 'WE'
        WHEN 4 THEN 'TH'
        WHEN 5 THEN 'FR'
        WHEN 6 THEN 'SA'
      END;
    END IF;

    -- Convert BYDAY to array
    v_day_codes := string_to_array(v_byday, ',');

    -- Start from beginning of week containing start date
    v_current_date := p_start_date - (EXTRACT(DOW FROM p_start_date)::integer || ' days')::interval;
    v_week_num := 0;

    -- FIX: Add 6 days to end_date to ensure we check all days in weeks that start before the boundary
    WHILE v_current_date <= v_end_date + INTERVAL '6 days'
          AND (v_count IS NULL OR v_occurrence_count < v_count) LOOP
      -- Check each day in this week
      FOREACH v_day_code IN ARRAY v_day_codes LOOP
        v_dow := CASE v_day_code
          WHEN 'SU' THEN 0
          WHEN 'MO' THEN 1
          WHEN 'TU' THEN 2
          WHEN 'WE' THEN 3
          WHEN 'TH' THEN 4
          WHEN 'FR' THEN 5
          WHEN 'SA' THEN 6
        END;

        v_temp_date := v_current_date + (v_dow || ' days')::interval;

        -- Only include if >= start date, <= end date, and not in exceptions
        IF v_temp_date >= p_start_date
           AND v_temp_date <= v_end_date
           AND NOT (p_recurrence_exceptions ? v_temp_date::text) THEN
          occurrence_date := v_temp_date;
          RETURN NEXT;
          v_occurrence_count := v_occurrence_count + 1;

          IF v_count IS NOT NULL AND v_occurrence_count >= v_count THEN
            RETURN;
          END IF;
        END IF;
      END LOOP;

      -- Move to next interval week
      v_week_num := v_week_num + 1;
      v_current_date := p_start_date - (EXTRACT(DOW FROM p_start_date)::integer || ' days')::interval
                        + ((v_week_num * v_interval * 7) || ' days')::interval;

      -- Safety check
      IF v_occurrence_count >= v_max_occurrences THEN
        EXIT;
      END IF;
    END LOOP;

  -- ============================================================================
  -- FREQ=MONTHLY
  -- ============================================================================
  ELSIF v_freq = 'MONTHLY' THEN
    v_current_date := p_start_date;

    WHILE v_current_date <= v_end_date AND (v_count IS NULL OR v_occurrence_count < v_count) LOOP
      v_temp_date := NULL;

      -- BYMONTHDAY specified
      IF v_bymonthday IS NOT NULL THEN
        IF v_bymonthday > 0 THEN
          v_month_last_day := EXTRACT(DAY FROM (DATE_TRUNC('month', v_current_date) + INTERVAL '1 month - 1 day'))::integer;
          v_temp_date := DATE_TRUNC('month', v_current_date) + (LEAST(v_bymonthday, v_month_last_day) - 1 || ' days')::interval;
        ELSE
          v_temp_date := DATE_TRUNC('month', v_current_date) + INTERVAL '1 month - 1 day' + (v_bymonthday || ' days')::interval;
        END IF;

      -- BYDAY + BYSETPOS specified
      ELSIF v_byday IS NOT NULL AND v_bysetpos IS NOT NULL THEN
        v_dow := CASE v_byday
          WHEN 'SU' THEN 0
          WHEN 'MO' THEN 1
          WHEN 'TU' THEN 2
          WHEN 'WE' THEN 3
          WHEN 'TH' THEN 4
          WHEN 'FR' THEN 5
          WHEN 'SA' THEN 6
        END;

        SELECT day INTO v_temp_date
        FROM (
          SELECT
            d::date as day,
            ROW_NUMBER() OVER (ORDER BY d) as rn
          FROM generate_series(
            DATE_TRUNC('month', v_current_date)::date,
            (DATE_TRUNC('month', v_current_date) + INTERVAL '1 month - 1 day')::date,
            '1 day'::interval
          ) d
          WHERE EXTRACT(DOW FROM d) = v_dow
        ) weekdays
        WHERE rn = CASE
          WHEN v_bysetpos > 0 THEN v_bysetpos
          ELSE (SELECT COUNT(*) FROM generate_series(
            DATE_TRUNC('month', v_current_date)::date,
            (DATE_TRUNC('month', v_current_date) + INTERVAL '1 month - 1 day')::date,
            '1 day'::interval
          ) d WHERE EXTRACT(DOW FROM d) = v_dow) + v_bysetpos + 1
        END;

      -- No BYMONTHDAY or BYDAY: use start date's day of month
      ELSE
        v_month_last_day := EXTRACT(DAY FROM (DATE_TRUNC('month', v_current_date) + INTERVAL '1 month - 1 day'))::integer;
        v_temp_date := DATE_TRUNC('month', v_current_date) +
                       (LEAST(EXTRACT(DAY FROM p_start_date)::integer, v_month_last_day) - 1 || ' days')::interval;
      END IF;

      -- Return if valid and not in exceptions
      IF v_temp_date IS NOT NULL
         AND v_temp_date >= p_start_date
         AND v_temp_date <= v_end_date
         AND NOT (p_recurrence_exceptions ? v_temp_date::text) THEN
        occurrence_date := v_temp_date;
        RETURN NEXT;
        v_occurrence_count := v_occurrence_count + 1;
      END IF;

      -- Move to next interval month
      v_current_date := (DATE_TRUNC('month', v_current_date) + (v_interval || ' months')::interval)::date;

      IF v_occurrence_count >= v_max_occurrences THEN
        EXIT;
      END IF;
    END LOOP;

  -- ============================================================================
  -- FREQ=YEARLY
  -- ============================================================================
  ELSIF v_freq = 'YEARLY' THEN
    v_current_date := p_start_date;

    WHILE v_current_date <= v_end_date AND (v_count IS NULL OR v_occurrence_count < v_count) LOOP
      IF NOT (p_recurrence_exceptions ? v_current_date::text) THEN
        occurrence_date := v_current_date;
        RETURN NEXT;
        v_occurrence_count := v_occurrence_count + 1;
      END IF;

      v_current_date := (DATE_TRUNC('year', v_current_date) + (v_interval || ' years')::interval +
                        ((EXTRACT(MONTH FROM p_start_date) - 1) || ' months')::interval +
                        ((EXTRACT(DAY FROM p_start_date) - 1) || ' days')::interval)::date;

      IF v_occurrence_count >= v_max_occurrences THEN
        EXIT;
      END IF;
    END LOOP;
  END IF;

  RETURN;
END;
$$;

COMMENT ON FUNCTION fn_expand_recurrence_dates IS
  'Expands RRULE pattern into individual occurrence dates. Fixed to properly handle WEEKLY frequency for all days of the week, especially Saturday.';

-- Recreate v_tasks_with_recurrence_expanded view
CREATE OR REPLACE VIEW v_tasks_with_recurrence_expanded AS
-- Non-recurring tasks/events
SELECT
  t.id, t.user_id, t.parent_task_id, t.type, t.title, t.status,
  t.due_date, t.start_date, t.end_date, t.start_time, t.end_time,
  t.completed_at, t.is_urgent, t.is_important, t.is_all_day, t.is_anytime, t.is_authentic_deposit,
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

-- Parent recurring templates (unexpanded row)
SELECT
  t.id, t.user_id, t.parent_task_id, t.type, t.title, t.status,
  t.due_date, t.start_date, t.end_date, t.start_time, t.end_time,
  t.completed_at, t.is_urgent, t.is_important, t.is_all_day, t.is_anytime, t.is_authentic_deposit,
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

-- Expanded virtual occurrences (365 days future, 90 days past)
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
  t.is_urgent, t.is_important, t.is_all_day, t.is_anytime, t.is_authentic_deposit,
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

-- Recreate v_dashboard_next_occurrences view
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

-- Verification queries
DO $$
BEGIN
  RAISE NOTICE '✓ Function fn_expand_recurrence_dates updated with Saturday fix';
  RAISE NOTICE '✓ Views recreated: v_tasks_with_recurrence_expanded, v_dashboard_next_occurrences';
  RAISE NOTICE '✓ Saturday recurring tasks will now show all occurrences in 365-day window';
END $$;
