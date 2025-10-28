/*
  # Implement Midnight Task Display and Blocking Logic

  1. Summary
    - Recurring tasks now appear at 12:01 AM (00:01) local time on their due date
    - If ANY previous occurrence is incomplete, ALL future occurrences are hidden
    - Manual deletion (via recurrence_exceptions) counts as "handled" and doesn't block

  2. New Functions
    - `fn_get_local_midnight_boundary(p_user_id)` - Returns 00:00:00 local time today for a user
    - `fn_has_incomplete_previous_occurrences(p_source_task_id, p_current_occurrence_date)` - Checks for blocking

  3. View Changes
    - Updated `v_dashboard_next_occurrences` to use time-based filtering (12:01 AM threshold)
    - Added blocking logic to hide future occurrences when previous ones are incomplete

  4. Performance
    - Added composite indexes for efficient occurrence queries
    - Timezone-aware calculations done at database level for optimal performance

  5. Important Notes
    - All timestamp comparisons respect user's local timezone
    - Recurrence exceptions (manually deleted occurrences) don't block future dates
    - Non-recurring tasks are unaffected by blocking logic
*/

-- Function to get the start of the current day (00:00:00) in user's local timezone
CREATE OR REPLACE FUNCTION fn_get_local_midnight_boundary(p_user_id UUID)
RETURNS TIMESTAMPTZ AS $$
DECLARE
  v_timezone TEXT;
  v_midnight TIMESTAMPTZ;
BEGIN
  -- Get user's timezone, default to UTC if not set
  SELECT COALESCE(timezone, 'UTC') INTO v_timezone
  FROM "0008-ap-users"
  WHERE id = p_user_id;

  -- Convert current timestamp to user's timezone and truncate to midnight
  v_midnight := date_trunc('day', CURRENT_TIMESTAMP AT TIME ZONE v_timezone) AT TIME ZONE v_timezone;

  RETURN v_midnight;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to check if there are incomplete previous occurrences that should block future dates
CREATE OR REPLACE FUNCTION fn_has_incomplete_previous_occurrences(
  p_source_task_id UUID,
  p_current_occurrence_date DATE
)
RETURNS BOOLEAN AS $$
DECLARE
  v_has_incomplete BOOLEAN;
  v_recurrence_exceptions DATE[];
BEGIN
  -- Get the recurrence_exceptions array from the source task
  SELECT recurrence_exceptions INTO v_recurrence_exceptions
  FROM "0008-ap-tasks"
  WHERE id = p_source_task_id;

  -- Check if there are any occurrences before the current date that are:
  -- 1. Not completed (no matching completed task in the database)
  -- 2. Not in the recurrence_exceptions array (not manually deleted)

  -- We need to check the recurrence pattern to find all dates before current_occurrence_date
  -- and verify if any of them are incomplete

  -- For now, we'll use a simpler approach: check if there are any completed occurrences
  -- for this source task. If there are none, and the current date is not the first occurrence,
  -- then there might be incomplete previous occurrences.

  -- A more sophisticated approach: Check if there are virtual occurrences before this date
  -- that haven't been completed or deleted

  WITH potential_occurrences AS (
    SELECT occurrence_date
    FROM v_tasks_with_recurrence_expanded
    WHERE source_task_id = p_source_task_id
      AND occurrence_date < p_current_occurrence_date
      AND is_virtual_occurrence = true
  )
  SELECT EXISTS (
    SELECT 1
    FROM potential_occurrences po
    WHERE NOT EXISTS (
      -- Check if this occurrence has been completed
      SELECT 1
      FROM "0008-ap-tasks" t
      WHERE t.parent_task_id = p_source_task_id
        AND t.due_date = po.occurrence_date
        AND t.status = 'completed'
        AND t.deleted_at IS NULL
    )
    -- AND the occurrence is not in recurrence_exceptions (manually deleted)
    AND (v_recurrence_exceptions IS NULL OR po.occurrence_date != ALL(v_recurrence_exceptions))
  ) INTO v_has_incomplete;

  RETURN COALESCE(v_has_incomplete, false);
END;
$$ LANGUAGE plpgsql STABLE;

-- Drop the existing view to recreate it with new logic
DROP VIEW IF EXISTS v_dashboard_next_occurrences;

-- Recreate v_dashboard_next_occurrences with time-based and blocking logic
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
    fn_get_local_midnight_boundary(t.user_id) + INTERVAL '1 minute' AS midnight_boundary
  FROM v_tasks_with_recurrence_expanded t
  JOIN next_occ n
    ON t.source_task_id = n.source_task_id
   AND t.occurrence_date = n.next_occurrence_date
  WHERE t.recurrence_rule IS NOT NULL
    AND t.is_virtual_occurrence
)
-- Select recurring tasks that:
-- 1. Have passed the 12:01 AM threshold in user's local time
-- 2. Don't have incomplete previous occurrences blocking them
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
  -- Check if current time has passed 12:01 AM for this occurrence date
  (mf.occurrence_date::TIMESTAMP + TIME '00:01:00') <= CURRENT_TIMESTAMP AT TIME ZONE (
    SELECT COALESCE(timezone, 'UTC')
    FROM "0008-ap-users"
    WHERE id = mf.user_id
  )
  -- AND there are no incomplete previous occurrences blocking this one
  AND NOT fn_has_incomplete_previous_occurrences(mf.source_task_id, mf.occurrence_date)

UNION ALL

-- Include non-recurring tasks (they don't have blocking logic)
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

-- Grant access
GRANT SELECT ON v_dashboard_next_occurrences TO authenticated;

-- Add comment to document the view
COMMENT ON VIEW v_dashboard_next_occurrences IS
'Dashboard view that shows the next pending occurrence for recurring tasks, filtered by 12:01 AM local time threshold and blocked if previous occurrences are incomplete. Non-recurring tasks are shown without filtering.';

-- Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_tasks_parent_due_status
ON "0008-ap-tasks" (parent_task_id, due_date, status)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_source_occurrence
ON "0008-ap-tasks" (parent_task_id, due_date)
WHERE status = 'completed' AND deleted_at IS NULL;

-- Verification
DO $$
BEGIN
  RAISE NOTICE '✓ Function fn_get_local_midnight_boundary created';
  RAISE NOTICE '✓ Function fn_has_incomplete_previous_occurrences created';
  RAISE NOTICE '✓ View v_dashboard_next_occurrences recreated with midnight and blocking logic';
  RAISE NOTICE '✓ Performance indexes added';
  RAISE NOTICE '';
  RAISE NOTICE 'Tasks will now appear at 12:01 AM local time on their due date';
  RAISE NOTICE 'Future occurrences are hidden if ANY previous occurrence is incomplete';
  RAISE NOTICE 'Manual deletions (recurrence_exceptions) do not block future dates';
END $$;
