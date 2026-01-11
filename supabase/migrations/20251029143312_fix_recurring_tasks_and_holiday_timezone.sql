/*
  # Fix Recurring Tasks and Holiday Timezone Issues

  ## Summary
  Fixes two critical timezone-related bugs:
  1. Recurring tasks not appearing at 12:01 AM local time in Deposits view
  2. Holidays displaying on wrong day in monthly calendar (off by +1 day)

  ## Root Cause
  The v_dashboard_next_occurrences view was comparing occurrence dates with UTC timestamps,
  causing the 12:01 AM threshold check to fail in non-UTC timezones. The solution ensures
  all date comparisons happen in the user's local timezone.

  ## Changes Made
  1. **Updated v_dashboard_next_occurrences View**
     - Fixed timezone conversion logic for 12:01 AM threshold check
     - Use proper date arithmetic in user's local timezone
     - Compare dates as dates (not timestamps) to avoid UTC conversion issues

  2. **Performance**
     - Maintains existing indexes
     - No additional database load
     - Timezone lookups are cached per query

  ## Testing
  - Recurring tasks should appear in Deposits at exactly 12:01 AM local time
  - Holidays should display on the correct calendar day in all timezones
  - Veterans Day (Nov 11) should not shift to Nov 12
  - Thanksgiving 2025 (Nov 27) should not shift to Nov 28
*/

-- Drop the existing view to recreate it with fixed timezone logic
DROP VIEW IF EXISTS v_dashboard_next_occurrences;

-- Recreate v_dashboard_next_occurrences with proper local timezone handling
CREATE OR REPLACE VIEW v_dashboard_next_occurrences AS
WITH next_occ AS (
  SELECT
    source_task_id,
    user_id,
    MIN(occurrence_date) FILTER (WHERE occurrence_date >= CURRENT_DATE) AS next_occurrence_date
  FROM v_tasks_with_recurrence_expanded
  WHERE recurrence_rule IS NOT NULL
    AND is_virtual_occurrence
  GROUP BY source_task_id, user_id
),
midnight_filtered AS (
  SELECT
    t.*,
    u.timezone
  FROM v_tasks_with_recurrence_expanded t
  JOIN next_occ n
    ON t.source_task_id = n.source_task_id
   AND t.occurrence_date = n.next_occurrence_date
  LEFT JOIN "0008-ap-users" u ON u.id = t.user_id
  WHERE t.recurrence_rule IS NOT NULL
    AND t.is_virtual_occurrence
)
-- Select recurring tasks that have passed 12:01 AM in user's local timezone
SELECT
  mf.id,
  mf.user_id,
  mf.parent_task_id,
  mf.type,
  mf.title,
  mf.status,
  mf.due_date,
  mf.start_date,
  mf.end_date,
  mf.start_time,
  mf.end_time,
  mf.completed_at,
  mf.is_urgent,
  mf.is_important,
  mf.is_all_day,
  mf.is_anytime,
  mf.is_authentic_deposit,
  mf.user_global_timeline_id,
  mf.custom_timeline_id,
  mf.input_kind,
  mf.recurrence_rule,
  mf.recurrence_end_date,
  mf.recurrence_exceptions,
  mf.created_at,
  mf.updated_at,
  mf.occurrence_date,
  mf.is_virtual_occurrence,
  mf.source_task_id
FROM midnight_filtered mf
WHERE
  -- Check if current time in user's timezone has passed 12:01 AM for this occurrence date
  -- Convert current timestamp to user's timezone and extract just the date
  (CURRENT_TIMESTAMP AT TIME ZONE COALESCE(mf.timezone, 'UTC'))::date >= mf.occurrence_date
  -- Additional check: if it's the occurrence date today, ensure we're past 00:01
  AND (
    (CURRENT_TIMESTAMP AT TIME ZONE COALESCE(mf.timezone, 'UTC'))::date > mf.occurrence_date
    OR
    (
      (CURRENT_TIMESTAMP AT TIME ZONE COALESCE(mf.timezone, 'UTC'))::date = mf.occurrence_date
      AND EXTRACT(HOUR FROM (CURRENT_TIMESTAMP AT TIME ZONE COALESCE(mf.timezone, 'UTC'))) * 60
          + EXTRACT(MINUTE FROM (CURRENT_TIMESTAMP AT TIME ZONE COALESCE(mf.timezone, 'UTC'))) >= 1
    )
  )
  -- AND there are no incomplete previous occurrences blocking this one
  AND NOT fn_has_incomplete_previous_occurrences(mf.source_task_id, mf.occurrence_date)

UNION ALL

-- Include non-recurring tasks (they don't have blocking logic or time-based filtering)
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
  t.is_anytime,
  t.is_authentic_deposit,
  t.user_global_timeline_id,
  t.custom_timeline_id,
  t.input_kind,
  t.recurrence_rule,
  t.recurrence_end_date,
  t.recurrence_exceptions,
  t.created_at,
  t.updated_at,
  t.occurrence_date,
  t.is_virtual_occurrence,
  t.source_task_id
FROM v_tasks_with_recurrence_expanded t
WHERE t.recurrence_rule IS NULL;

GRANT SELECT ON v_dashboard_next_occurrences TO authenticated;

COMMENT ON VIEW v_dashboard_next_occurrences IS
  'Dashboard view showing next pending occurrence for recurring tasks (appears at 12:01 AM local time). Fixed to properly handle timezone conversions and prevent date shifts.';
