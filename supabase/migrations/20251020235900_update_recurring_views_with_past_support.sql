/*
  # Update Recurring Tasks Views with Past Date Support

  ## Summary
  Updates the recurring task expansion function and views to properly support
  past dates. This is a rebuild of the recurring tasks system with improved
  handling of WEEKLY, MONTHLY, and YEARLY recurrence patterns.

  ## Changes Made
  1. **Updated fn_expand_recurrence_dates Function**
     - Added p_max_past_days parameter (default 90 days)
     - Fixed WEEKLY alignment to start from Sunday
     - Improved MONTHLY handling with BYMONTHDAY and BYSETPOS
     - Enhanced YEARLY pattern support
     - Better exception date handling

  2. **Updated v_tasks_with_recurrence_expanded View**
     - Now includes past occurrences (90 days back)
     - Better filtering of completed occurrences
     - Improved virtual occurrence generation

  3. **Updated v_dashboard_next_occurrences View**
     - Optimized query for next pending occurrence
     - Better handling of virtual vs real occurrences

  ## Migration Strategy
  - Drops and recreates all objects in correct dependency order
  - Safe to run multiple times (idempotent)
  - Preserves existing data in 0008-ap-tasks table

  ## Supersedes
  This migration supersedes the function/view definitions from:
  - 20251019220255_add_recurring_tasks_system.sql

  The schema changes (columns and indexes) from that migration are preserved.
*/

-- =============================================================================
-- RECURRING TASKS: FUNCTION + VIEWS (clean rebuild)
-- =============================================================================
-- Safe, single-run migration. Drops dependents in order, recreates function,
-- then views, then grants, then a quick smoke test.
-- =============================================================================

-- 0) Drop dependents (safe if they don't exist)
DROP VIEW IF EXISTS v_dashboard_next_occurrences;
DROP VIEW IF EXISTS v_tasks_with_recurrence_expanded;

-- 1) Drop any older function signatures that might conflict
DROP FUNCTION IF EXISTS fn_expand_recurrence_dates(date, text, date, jsonb, integer);
DROP FUNCTION IF EXISTS fn_expand_recurrence_dates(date, text, date, jsonb, integer, integer);
DROP FUNCTION IF EXISTS fn_expand_recurrence_dates(timestamp, text, timestamp, jsonb, integer, integer);

-- 2) Create the recurrence expansion function
--    Supports: DAILY, WEEKLY (BYDAY), MONTHLY (BYMONTHDAY | BYDAY+BYSETPOS), YEARLY
--    Respects: INTERVAL, COUNT, EXCEPTIONS
--    Window:   past via p_max_past_days; future via p_max_future_days/until
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
  v_byday        text := NULL;       -- comma list: MO,TU,...
  v_bymonthday   integer := NULL;    -- 1..31 or negative for from-end
  v_bysetpos     integer := NULL;    -- e.g., 1 (first), 2 (second), -1 (last)

  -- working vars
  v_window_start date;
  v_window_end   date;
  v_current_date date;
  v_occurs       integer := 0;
  v_ex_dates     date[];
  v_day_codes    text[];
  v_day_code     text;
  v_dow          integer;            -- 0=Sun..6=Sat
  v_tmp          date;
  v_month_last   integer;
  p_max_occurrences integer := 1000; -- safety limit
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
    -- align to the Sunday of the week that includes GREATEST(p_start_date, v_window_start)
    v_current_date := date_trunc('week', GREATEST(p_start_date, v_window_start))::date; -- week starts Monday in ISO; adjust to Sunday
    v_current_date := v_current_date - ((EXTRACT(DOW FROM v_current_date)::int)::text || ' days')::interval; -- normalize to Sunday
  ELSIF v_freq = 'MONTHLY' THEN
    v_current_date := date_trunc('month', GREATEST(p_start_date, v_window_start))::date;
  ELSIF v_freq = 'YEARLY' THEN
    v_current_date := make_date(EXTRACT(YEAR FROM GREATEST(p_start_date, v_window_start))::int,
                                EXTRACT(MONTH FROM p_start_date)::int,
                                EXTRACT(DAY FROM p_start_date)::int);
  ELSE
    v_current_date := GREATEST(p_start_date, v_window_start);
  END IF;

  -- exceptions
  v_ex_dates := ARRAY(SELECT jsonb_array_elements_text(p_exceptions)::date);

  -- ---- MAIN LOOP ----
  WHILE v_current_date <= v_window_end LOOP
    -- DAILY ---------------------------------------------------
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

    -- WEEKLY --------------------------------------------------
    ELSIF v_freq = 'WEEKLY' THEN
      IF v_byday IS NULL THEN
        -- default to start date's weekday (two-letter code)
        v_byday := CASE EXTRACT(DOW FROM p_start_date)
          WHEN 0 THEN 'SU' WHEN 1 THEN 'MO' WHEN 2 THEN 'TU' WHEN 3 THEN 'WE'
          WHEN 4 THEN 'TH' WHEN 5 THEN 'FR' WHEN 6 THEN 'SA' END;
      END IF;
      v_day_codes := string_to_array(upper(v_byday), ',');

      -- emit days in this week
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

      -- advance N weeks
      v_current_date := v_current_date + ((v_interval * 7) || ' days')::interval;

    -- MONTHLY -------------------------------------------------
    ELSIF v_freq = 'MONTHLY' THEN
      v_tmp := NULL;

      IF v_bymonthday IS NOT NULL THEN
        -- positive day of month OR negative (from end)
        v_month_last := EXTRACT(DAY FROM (date_trunc('month', v_current_date) + interval '1 month - 1 day'))::int;

        IF v_bymonthday > 0 THEN
          v_tmp := date_trunc('month', v_current_date)::date
                   + (LEAST(v_bymonthday, v_month_last) - 1);
        ELSE
          v_tmp := (date_trunc('month', v_current_date) + interval '1 month - 1 day')::date
                   + (v_bymonthday); -- negative shifts from end
        END IF;

      ELSIF v_byday IS NOT NULL AND v_bysetpos IS NOT NULL THEN
        -- e.g., BYDAY=MO;BYSETPOS=2  (second Monday)
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
        -- default: same day-of-month as start date, clamped to last day
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

    -- YEARLY --------------------------------------------------
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

    -- global safety: never exceed requested max occurrences
    IF v_occurs >= p_max_occurrences THEN
      RETURN;
    END IF;
  END LOOP;

  RETURN;
END;
$$;

COMMENT ON FUNCTION fn_expand_recurrence_dates IS
  'Expands RRULE into dates. Supports DAILY/WEEKLY/MONTHLY/YEARLY, BYDAY, BYMONTHDAY, BYSETPOS, INTERVAL, COUNT, and JSONB exceptions. Includes past/future window.';

GRANT EXECUTE ON FUNCTION fn_expand_recurrence_dates(date, text, date, jsonb, integer, integer) TO authenticated;

-- 3) Expanded tasks view (now includes past occurrences)
CREATE OR REPLACE VIEW v_tasks_with_recurrence_expanded AS
-- Non-recurring tasks/events
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

-- Parent recurring templates (unexpanded row)
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

-- Expanded virtual occurrences (includes past window)
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
  365,   -- future days
  90     -- past days (history)
) AS x
WHERE t.recurrence_rule IS NOT NULL
  AND t.deleted_at IS NULL
  AND t.parent_task_id IS NULL
  -- Hide virtual rows that have a real completed child on that day
  AND NOT EXISTS (
    SELECT 1
    FROM "0008-ap-tasks" c
    WHERE c.parent_task_id = t.id
      AND c.due_date = x.occurrence_date
      AND c.status = 'completed'
      AND c.deleted_at IS NULL
  );

GRANT SELECT ON v_tasks_with_recurrence_expanded TO authenticated;

COMMENT ON VIEW v_tasks_with_recurrence_expanded IS
  'All tasks plus virtual expanded occurrences. Includes past 90 days and next 365 days.';

-- 4) Dashboard view: next pending occurrence per recurring task + all non-recurring
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

COMMENT ON VIEW v_dashboard_next_occurrences IS
  'Dashboard-optimized: next pending virtual occurrence for each recurring task, plus all non-recurring tasks.';

-- 5) Verification checks
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'fn_expand_recurrence_dates') THEN
    RAISE NOTICE '✓ Function fn_expand_recurrence_dates created successfully';
  ELSE
    RAISE EXCEPTION '✗ Function fn_expand_recurrence_dates MISSING';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'v_tasks_with_recurrence_expanded') THEN
    RAISE NOTICE '✓ View v_tasks_with_recurrence_expanded created successfully';
  ELSE
    RAISE EXCEPTION '✗ View v_tasks_with_recurrence_expanded MISSING';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'v_dashboard_next_occurrences') THEN
    RAISE NOTICE '✓ View v_dashboard_next_occurrences created successfully';
  ELSE
    RAISE EXCEPTION '✗ View v_dashboard_next_occurrences MISSING';
  END IF;

  RAISE NOTICE '✓ All recurring task views updated successfully with past date support';
END $$;
