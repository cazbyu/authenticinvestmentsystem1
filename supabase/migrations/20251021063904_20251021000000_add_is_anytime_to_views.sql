/*
  # Add is_anytime Column to Database Views

  ## Summary
  Updates the recurring task views to include the new `is_anytime` column
  that differentiates anytime tasks from all-day events.

  ## Changes Made
  1. **Updated v_tasks_with_recurrence_expanded View**
     - Added `is_anytime` to all SELECT clauses
  
  2. **Updated v_dashboard_next_occurrences View**
     - Now includes `is_anytime` field (inherited from base view)

  ## Data Model
  - `is_anytime`: Boolean field for tasks without specific times
  - `is_all_day`: Boolean field for all-day events
  - Tasks use `is_anytime`, Events use `is_all_day`
*/

-- Drop dependent views in correct order
DROP VIEW IF EXISTS v_dashboard_next_occurrences;
DROP VIEW IF EXISTS v_tasks_with_recurrence_expanded;

-- Recreate v_tasks_with_recurrence_expanded with is_anytime
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
  730,   -- future days (2 years for better visibility)
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
  'All tasks plus virtual expanded occurrences. Includes past 90 days and next 730 days (2 years).';

-- Recreate v_dashboard_next_occurrences
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
