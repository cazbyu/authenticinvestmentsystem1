/*
  # Recurring Tasks/Events - Complete Implementation
  
  ## Summary
  Adds comprehensive recurring task/event support using database views for efficient 
  calendar display without creating premature rows. Creates actual task rows only 
  when occurrences are completed.
  
  ## Changes Made
  1. **Schema Enhancements**
     - Add recurrence_end_date column for end boundary
     - Add recurrence_exceptions jsonb array for excluded dates
     - Add indexes for performance
  
  2. **PostgreSQL Function: fn_expand_recurrence_dates**
     - Expands RRULE patterns into occurrence dates
     - Handles DAILY, WEEKLY, MONTHLY, YEARLY frequencies
     - Supports complex patterns (Mon-Fri, last Friday, Nth weekday)
     - Respects recurrence_end_date and exception dates
  
  3. **View: v_tasks_with_recurrence_expanded**
     - Unions regular tasks with expanded recurring occurrences
     - Provides calendar-ready data without storing extra rows
     - Filters out exception dates and respects end dates
  
  4. **View: v_dashboard_next_occurrences**
     - Shows only the next pending occurrence per recurring task
     - Optimized for dashboard display
  
  ## Usage
  - Calendar views query v_tasks_with_recurrence_expanded
  - Dashboard queries v_dashboard_next_occurrences
  - Completion creates actual row with parent_task_id
  - Journal shows all completed rows with parent_task_id
*/

-- ============================================================================
-- STEP 1: Add New Columns to 0008-ap-tasks
-- ============================================================================

-- Add recurrence_end_date for defining when recurrence stops
ALTER TABLE "0008-ap-tasks"
  ADD COLUMN IF NOT EXISTS recurrence_end_date date;

-- Add recurrence_exceptions for storing excluded dates (when user deletes "this occurrence only")
ALTER TABLE "0008-ap-tasks"
  ADD COLUMN IF NOT EXISTS recurrence_exceptions jsonb DEFAULT '[]'::jsonb;

-- Add comment documentation
COMMENT ON COLUMN "0008-ap-tasks".recurrence_rule IS 
  'RFC 5545 RRULE string (e.g., FREQ=DAILY;INTERVAL=1 or FREQ=WEEKLY;BYDAY=MO,WE,FR)';
  
COMMENT ON COLUMN "0008-ap-tasks".recurrence_end_date IS 
  'Date when recurrence stops. NULL means infinite recurrence. Can be calculated from COUNT in RRULE.';
  
COMMENT ON COLUMN "0008-ap-tasks".recurrence_exceptions IS 
  'Array of ISO date strings to exclude from recurrence expansion (e.g., ["2025-01-15", "2025-02-12"])';
  
COMMENT ON COLUMN "0008-ap-tasks".parent_task_id IS 
  'Links completed occurrence to parent recurring task. NULL for non-recurring tasks or parent templates.';

-- ============================================================================
-- STEP 2: Add Performance Indexes
-- ============================================================================

-- Index for recurring tasks queries
CREATE INDEX IF NOT EXISTS idx_tasks_recurrence_rule ON "0008-ap-tasks"(recurrence_rule) 
  WHERE recurrence_rule IS NOT NULL;

-- Index for parent task lookups (already exists, but ensure it's there)
CREATE INDEX IF NOT EXISTS idx_tasks_parent_task_id ON "0008-ap-tasks"(parent_task_id) 
  WHERE parent_task_id IS NOT NULL;

-- Index for completed occurrences (for Journal view)
CREATE INDEX IF NOT EXISTS idx_tasks_parent_completed ON "0008-ap-tasks"(parent_task_id, status, completed_at) 
  WHERE parent_task_id IS NOT NULL AND status = 'completed';

-- Index for due date range queries (for calendar views)
CREATE INDEX IF NOT EXISTS idx_tasks_due_date_range ON "0008-ap-tasks"(due_date, status, deleted_at);

-- ============================================================================
-- STEP 3: Create RRULE Expansion Function
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_expand_recurrence_dates(
  p_start_date date,
  p_recurrence_rule text,
  p_recurrence_end_date date,
  p_recurrence_exceptions jsonb DEFAULT '[]'::jsonb,
  p_max_future_days integer DEFAULT 365
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
  v_max_occurrences integer := 1000; -- Safety limit
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
  
  -- Extract COUNT (overrides recurrence_end_date if present)
  IF p_recurrence_rule ~* 'COUNT=(\d+)' THEN
    v_count := (regexp_matches(p_recurrence_rule, 'COUNT=(\d+)', 'i'))[1]::integer;
  END IF;
  
  -- Determine end date
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
      -- Check if date is NOT in exceptions
      IF NOT (p_recurrence_exceptions ? v_current_date::text) THEN
        occurrence_date := v_current_date;
        RETURN NEXT;
        v_occurrence_count := v_occurrence_count + 1;
      END IF;
      
      v_current_date := v_current_date + (v_interval || ' days')::interval;
      
      -- Safety check
      IF v_occurrence_count >= v_max_occurrences THEN
        EXIT;
      END IF;
    END LOOP;
  
  -- ============================================================================
  -- FREQ=WEEKLY
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
    
    WHILE v_current_date <= v_end_date AND (v_count IS NULL OR v_occurrence_count < v_count) LOOP
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
        
        -- Only include if >= start date and not in exceptions
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
      
      -- BYMONTHDAY specified (e.g., 15th of month or -1 for last day)
      IF v_bymonthday IS NOT NULL THEN
        IF v_bymonthday > 0 THEN
          -- Positive: Nth day of month (adjust to last day if month is shorter)
          v_month_last_day := EXTRACT(DAY FROM (DATE_TRUNC('month', v_current_date) + INTERVAL '1 month - 1 day'))::integer;
          v_temp_date := DATE_TRUNC('month', v_current_date) + (LEAST(v_bymonthday, v_month_last_day) - 1 || ' days')::interval;
        ELSE
          -- Negative: count from end of month
          v_temp_date := DATE_TRUNC('month', v_current_date) + INTERVAL '1 month - 1 day' + (v_bymonthday || ' days')::interval;
        END IF;
      
      -- BYDAY + BYSETPOS specified (e.g., 2nd Tuesday, last Friday)
      ELSIF v_byday IS NOT NULL AND v_bysetpos IS NOT NULL THEN
        -- Find all occurrences of the specified weekday in the month
        v_dow := CASE v_byday
          WHEN 'SU' THEN 0
          WHEN 'MO' THEN 1
          WHEN 'TU' THEN 2
          WHEN 'WE' THEN 3
          WHEN 'TH' THEN 4
          WHEN 'FR' THEN 5
          WHEN 'SA' THEN 6
        END;
        
        -- Use a query to find the Nth occurrence
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
      
      -- Safety check
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
      
      -- Move to next interval year (same month and day)
      v_current_date := (DATE_TRUNC('year', v_current_date) + (v_interval || ' years')::interval + 
                        ((EXTRACT(MONTH FROM p_start_date) - 1) || ' months')::interval +
                        ((EXTRACT(DAY FROM p_start_date) - 1) || ' days')::interval)::date;
      
      -- Safety check
      IF v_occurrence_count >= v_max_occurrences THEN
        EXIT;
      END IF;
    END LOOP;
  END IF;
  
  RETURN;
END;
$$;

COMMENT ON FUNCTION fn_expand_recurrence_dates IS 
  'Expands RRULE pattern into individual occurrence dates. Supports DAILY, WEEKLY, MONTHLY, YEARLY frequencies with BYDAY, BYMONTHDAY, BYSETPOS, INTERVAL, COUNT parameters.';

-- ============================================================================
-- STEP 4: Create View for Expanded Tasks (Calendar View)
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

-- Parent recurring tasks (template records - show once with original due_date)
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

-- Expanded recurring occurrences (virtual rows for calendar display)
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
  365
) expanded
WHERE t.recurrence_rule IS NOT NULL
  AND t.deleted_at IS NULL
  AND t.parent_task_id IS NULL
  AND expanded.occurrence_date >= CURRENT_DATE
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
  'Unified view of all tasks including virtual expanded occurrences of recurring tasks. Used by calendar views to display all dates without creating actual rows until completion.';

-- ============================================================================
-- STEP 5: Create View for Dashboard (Next Occurrence Only)
-- ============================================================================

CREATE OR REPLACE VIEW v_dashboard_next_occurrences AS
WITH next_occurrences AS (
  SELECT 
    source_task_id,
    MIN(occurrence_date) FILTER (WHERE occurrence_date >= CURRENT_DATE) as next_occurrence_date
  FROM v_tasks_with_recurrence_expanded
  WHERE recurrence_rule IS NOT NULL
    AND status = 'pending'
  GROUP BY source_task_id
)
SELECT 
  t.*
FROM v_tasks_with_recurrence_expanded t
INNER JOIN next_occurrences n 
  ON t.source_task_id = n.source_task_id 
  AND t.occurrence_date = n.next_occurrence_date
WHERE t.recurrence_rule IS NOT NULL
  AND t.status = 'pending'

UNION ALL

-- Include all non-recurring tasks
SELECT t.*
FROM v_tasks_with_recurrence_expanded t
WHERE t.recurrence_rule IS NULL;

GRANT SELECT ON v_dashboard_next_occurrences TO authenticated;

COMMENT ON VIEW v_dashboard_next_occurrences IS 
  'Dashboard-optimized view showing only the next pending occurrence for each recurring task. Non-recurring tasks are shown as-is.';

-- ============================================================================
-- STEP 6: Grant Permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION fn_expand_recurrence_dates(date, text, date, jsonb, integer) TO authenticated;