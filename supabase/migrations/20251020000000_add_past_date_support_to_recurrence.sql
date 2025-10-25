/*
  # Add Past Date Support to Recurrence Function

  ## Summary
  Updates the fn_expand_recurrence_dates function to support displaying past dates
  in the calendar by adding a p_max_past_days parameter. This enables users to view
  their task history when navigating to previous dates.

  ## Changes Made
  1. **Function Update: fn_expand_recurrence_dates**
     - Drop old 5-parameter version
     - Create new 6-parameter version with p_max_past_days
     - Add logic to expand occurrences into the past
     - Update all frequency handlers (DAILY, WEEKLY, MONTHLY, YEARLY)

  2. **View Update: v_tasks_with_recurrence_expanded**
     - Remove date filter that blocked past dates
     - Update function call to include past days parameter (90 days)
     - Maintain all other view logic

  3. **Permissions**
     - Grant execute on new 6-parameter function signature

  ## Impact
  - Calendar will show tasks from 90 days in the past
  - Calendar will show tasks 365 days into the future
  - Total viewing window: ~455 days of task data
*/

-- ============================================================================
-- STEP 1: Update fn_expand_recurrence_dates Function
-- ============================================================================

-- Drop the old 5-parameter version to avoid signature conflicts
DROP FUNCTION IF EXISTS fn_expand_recurrence_dates(date, text, date, jsonb, integer);

-- Create the new 6-parameter version with past date support
CREATE OR REPLACE FUNCTION fn_expand_recurrence_dates(
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
  v_start_window date;
BEGIN
  -- Parse RRULE components
  v_freq := (regexp_matches(p_recurrence_rule, 'FREQ=(\w+)', 'i'))[1];

  IF p_recurrence_rule ~* 'INTERVAL=(\d+)' THEN
    v_interval := (regexp_matches(p_recurrence_rule, 'INTERVAL=(\d+)', 'i'))[1]::integer;
  END IF;

  IF p_recurrence_rule ~* 'BYDAY=([A-Z,]+)' THEN
    v_byday := (regexp_matches(p_recurrence_rule, 'BYDAY=([A-Z,]+)', 'i'))[1];
  END IF;

  IF p_recurrence_rule ~* 'BYMONTHDAY=(-?\d+)' THEN
    v_bymonthday := (regexp_matches(p_recurrence_rule, 'BYMONTHDAY=(-?\d+)', 'i'))[1]::integer;
  END IF;

  IF p_recurrence_rule ~* 'BYSETPOS=(-?\d+)' THEN
    v_bysetpos := (regexp_matches(p_recurrence_rule, 'BYSETPOS=(-?\d+)', 'i'))[1]::integer;
  END IF;

  IF p_recurrence_rule ~* 'COUNT=(\d+)' THEN
    v_count := (regexp_matches(p_recurrence_rule, 'COUNT=(\d+)', 'i'))[1]::integer;
  END IF;

  -- Set up the expansion window (past to future)
  v_start_window := CURRENT_DATE - p_max_past_days;
  v_end_date := COALESCE(
    p_recurrence_end_date,
    CURRENT_DATE + p_max_future_days
  );

  -- Start from either the task's start date or the beginning of the window
  v_current_date := LEAST(p_start_date, v_start_window);

  -- ============================================================================
  -- FREQ=DAILY
  -- ============================================================================
  IF v_freq = 'DAILY' THEN
    -- Start from the window start, not just the task start date
    v_current_date := GREATEST(p_start_date, v_start_window);

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
  -- FREQ=WEEKLY
  -- ============================================================================
  ELSIF v_freq = 'WEEKLY' THEN
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

    v_day_codes := string_to_array(v_byday, ',');

    -- Start from the window start
    v_current_date := GREATEST(p_start_date - (EXTRACT(DOW FROM p_start_date)::integer || ' days')::interval,
                                v_start_window - (EXTRACT(DOW FROM v_start_window)::integer || ' days')::interval);
    v_week_num := 0;

    WHILE v_current_date <= v_end_date AND (v_count IS NULL OR v_occurrence_count < v_count) LOOP
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

        -- Include dates within the window (past or future)
        IF v_temp_date >= GREATEST(p_start_date, v_start_window)
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

      v_week_num := v_week_num + 1;
      v_current_date := p_start_date - (EXTRACT(DOW FROM p_start_date)::integer || ' days')::interval
                        + ((v_week_num * v_interval * 7) || ' days')::interval;

      IF v_occurrence_count >= v_max_occurrences THEN
        EXIT;
      END IF;
    END LOOP;

  -- ============================================================================
  -- FREQ=MONTHLY
  -- ============================================================================
  ELSIF v_freq = 'MONTHLY' THEN
    -- Adjust current date to include past months
    v_current_date := GREATEST(
      DATE_TRUNC('month', p_start_date),
      DATE_TRUNC('month', v_start_window)
    )::date;

    WHILE v_current_date <= v_end_date AND (v_count IS NULL OR v_occurrence_count < v_count) LOOP
      v_temp_date := NULL;

      IF v_bymonthday IS NOT NULL THEN
        IF v_bymonthday > 0 THEN
          v_month_last_day := EXTRACT(DAY FROM (DATE_TRUNC('month', v_current_date) + INTERVAL '1 month - 1 day'))::integer;
          v_temp_date := DATE_TRUNC('month', v_current_date) + (LEAST(v_bymonthday, v_month_last_day) - 1 || ' days')::interval;
        ELSE
          v_temp_date := DATE_TRUNC('month', v_current_date) + INTERVAL '1 month - 1 day' + (v_bymonthday || ' days')::interval;
        END IF;

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

      ELSE
        v_month_last_day := EXTRACT(DAY FROM (DATE_TRUNC('month', v_current_date) + INTERVAL '1 month - 1 day'))::integer;
        v_temp_date := DATE_TRUNC('month', v_current_date) +
                       (LEAST(EXTRACT(DAY FROM p_start_date)::integer, v_month_last_day) - 1 || ' days')::interval;
      END IF;

      -- Include dates within the window (past or future)
      IF v_temp_date IS NOT NULL
         AND v_temp_date >= GREATEST(p_start_date, v_start_window)
         AND v_temp_date <= v_end_date
         AND NOT (p_recurrence_exceptions ? v_temp_date::text) THEN
        occurrence_date := v_temp_date;
        RETURN NEXT;
        v_occurrence_count := v_occurrence_count + 1;
      END IF;

      v_current_date := (DATE_TRUNC('month', v_current_date) + (v_interval || ' months')::interval)::date;

      IF v_occurrence_count >= v_max_occurrences THEN
        EXIT;
      END IF;
    END LOOP;

  -- ============================================================================
  -- FREQ=YEARLY
  -- ============================================================================
  ELSIF v_freq = 'YEARLY' THEN
    -- Adjust current date to include past years
    v_current_date := GREATEST(p_start_date, v_start_window);

    WHILE v_current_date <= v_end_date AND (v_count IS NULL OR v_occurrence_count < v_count) LOOP
      IF v_current_date >= p_start_date
         AND NOT (p_recurrence_exceptions ? v_current_date::text) THEN
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
  'Expands RRULE pattern into individual occurrence dates. Supports DAILY, WEEKLY, MONTHLY, YEARLY frequencies with BYDAY, BYMONTHDAY, BYSETPOS, INTERVAL, COUNT parameters. Supports past date expansion via p_max_past_days parameter for calendar history display.';

-- ============================================================================
-- STEP 2: Update v_tasks_with_recurrence_expanded View
-- ============================================================================

CREATE OR REPLACE VIEW v_tasks_with_recurrence_expanded AS
-- Non-recurring tasks and events (show as-is)
SELECT
  t.id,
  t.user_id,
  t.parent_task_id,
  t.type,
  t.title,
  t.status,
  t.due_date,
  t.start_date,
  t.end_date,
  t.start_time,
  t.end_time,
  t.completed_at,
  t.is_urgent,
  t.is_important,
  t.is_all_day,
  t.is_authentic_deposit,
  t.user_global_timeline_id,
  t.custom_timeline_id,
  t.input_kind,
  t.recurrence_rule,
  t.recurrence_end_date,
  t.recurrence_exceptions,
  t.created_at,
  t.updated_at,
  t.due_date as occurrence_date,
  false as is_virtual_occurrence,
  t.id as source_task_id
FROM "0008-ap-tasks" t
WHERE t.recurrence_rule IS NULL
  AND t.deleted_at IS NULL
  AND t.parent_task_id IS NULL

UNION ALL

-- Parent recurring tasks (template records)
SELECT
  t.id,
  t.user_id,
  t.parent_task_id,
  t.type,
  t.title,
  t.status,
  t.due_date,
  t.start_date,
  t.end_date,
  t.start_time,
  t.end_time,
  t.completed_at,
  t.is_urgent,
  t.is_important,
  t.is_all_day,
  t.is_authentic_deposit,
  t.user_global_timeline_id,
  t.custom_timeline_id,
  t.input_kind,
  t.recurrence_rule,
  t.recurrence_end_date,
  t.recurrence_exceptions,
  t.created_at,
  t.updated_at,
  t.due_date as occurrence_date,
  false as is_virtual_occurrence,
  t.id as source_task_id
FROM "0008-ap-tasks" t
WHERE t.recurrence_rule IS NOT NULL
  AND t.deleted_at IS NULL
  AND t.parent_task_id IS NULL

UNION ALL

-- Expanded recurring occurrences (NOW INCLUDES PAST DATES)
SELECT
  t.id,
  t.user_id,
  t.parent_task_id,
  t.type,
  t.title,
  'pending' as status,
  expanded.occurrence_date as due_date,
  CASE
    WHEN t.start_date IS NOT NULL THEN
      expanded.occurrence_date + (t.start_date - COALESCE(t.due_date, t.start_date))
    ELSE NULL
  END as start_date,
  CASE
    WHEN t.end_date IS NOT NULL THEN
      expanded.occurrence_date + (t.end_date - COALESCE(t.due_date, t.start_date))
    ELSE NULL
  END as end_date,
  t.start_time,
  t.end_time,
  NULL as completed_at,
  t.is_urgent,
  t.is_important,
  t.is_all_day,
  t.is_authentic_deposit,
  t.user_global_timeline_id,
  t.custom_timeline_id,
  t.input_kind,
  t.recurrence_rule,
  t.recurrence_end_date,
  t.recurrence_exceptions,
  t.created_at,
  t.updated_at,
  expanded.occurrence_date,
  true as is_virtual_occurrence,
  t.id as source_task_id
FROM "0008-ap-tasks" t
CROSS JOIN LATERAL fn_expand_recurrence_dates(
  COALESCE(t.due_date, t.start_date, CURRENT_DATE),
  t.recurrence_rule,
  t.recurrence_end_date,
  t.recurrence_exceptions,
  365,  -- future days
  90    -- past days (90 days of history)
) expanded
WHERE t.recurrence_rule IS NOT NULL
  AND t.deleted_at IS NULL
  AND t.parent_task_id IS NULL
  -- Removed: AND expanded.occurrence_date >= CURRENT_DATE
  -- This allows past dates to be displayed in calendar
  AND NOT EXISTS (
    SELECT 1
    FROM "0008-ap-tasks" completed
    WHERE completed.parent_task_id = t.id
      AND completed.due_date = expanded.occurrence_date
      AND completed.status = 'completed'
      AND completed.deleted_at IS NULL
  );

GRANT SELECT ON v_tasks_with_recurrence_expanded TO authenticated;

COMMENT ON VIEW v_tasks_with_recurrence_expanded IS
  'Unified view of all tasks including virtual expanded occurrences of recurring tasks. Includes past 90 days for calendar history display.';

-- ============================================================================
-- STEP 3: Grant Permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION fn_expand_recurrence_dates(date, text, date, jsonb, integer, integer) TO authenticated;
