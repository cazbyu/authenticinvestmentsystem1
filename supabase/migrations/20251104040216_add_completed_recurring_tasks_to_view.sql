/*
  # Add Completed Recurring Task Instances to View

  1. Changes
    - Adds a third UNION to v_tasks_with_recurrence_expanded view
    - Includes completed child tasks (instances of recurring tasks)
    - These tasks have a parent_task_id and represent actual completions
    
  2. Why This Matters
    - Without this, completed recurring tasks don't appear in the calendar
    - Users can't see their completed work in the Eisenhower Matrix quadrants
    - Example: "Take Kiddos to School" completed on Nov 3 was invisible
    
  3. Technical Details
    - The view previously had 2 parts:
      1. Non-recurring tasks (includes completed_at)
      2. Virtual future occurrences (completed_at = NULL)
    - Now adds:
      3. Completed instances of recurring tasks (includes completed_at)
*/

DROP VIEW IF EXISTS v_dashboard_next_occurrences CASCADE;
DROP VIEW IF EXISTS v_tasks_with_recurrence_expanded CASCADE;

CREATE VIEW v_tasks_with_recurrence_expanded AS
-- Part 1: Non-recurring tasks (original behavior)
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
  t.user_global_timeline_id,
  t.custom_timeline_id,
  t.input_kind,
  t.recurrence_rule,
  t.recurrence_end_date,
  t.recurrence_exceptions,
  t.created_at,
  t.updated_at,
  t.due_date AS occurrence_date,
  false AS is_virtual_occurrence,
  t.id AS source_task_id
FROM "0008-ap-tasks" t
WHERE t.recurrence_rule IS NULL
  AND t.deleted_at IS NULL

UNION ALL

-- Part 2: Virtual future occurrences of recurring tasks (original behavior)
SELECT 
  t.id,
  t.user_id,
  NULL::uuid AS parent_task_id,
  t.type,
  t.title,
  'pending'::status_enum AS status,
  occ.occurrence_date AS due_date,
  CASE 
    WHEN t.type = 'event' THEN occ.occurrence_date 
    ELSE NULL 
  END AS start_date,
  CASE 
    WHEN t.type = 'event' THEN occ.occurrence_date 
    ELSE NULL 
  END AS end_date,
  t.start_time,
  t.end_time,
  NULL::timestamptz AS completed_at,
  t.is_urgent,
  t.is_important,
  t.is_all_day,
  t.is_anytime,
  t.user_global_timeline_id,
  t.custom_timeline_id,
  t.input_kind,
  t.recurrence_rule,
  t.recurrence_end_date,
  t.recurrence_exceptions,
  t.created_at,
  t.updated_at,
  occ.occurrence_date,
  true AS is_virtual_occurrence,
  t.id AS source_task_id
FROM "0008-ap-tasks" t
CROSS JOIN LATERAL (
  SELECT DISTINCT occurrence_date
  FROM fn_expand_recurrence_dates(
    COALESCE(t.due_date, t.start_date, CURRENT_DATE),
    t.recurrence_rule,
    t.recurrence_end_date,
    t.recurrence_exceptions,
    90,
    30
  ) AS occurrence_date
  WHERE occurrence_date >= COALESCE(t.due_date, t.start_date, CURRENT_DATE)
    AND NOT EXISTS (
      SELECT 1 
      FROM "0008-ap-tasks" comp
      WHERE comp.parent_task_id = t.id
        AND comp.due_date = occurrence_date
        AND comp.status = 'completed'
        AND comp.deleted_at IS NULL
    )
) occ
WHERE t.recurrence_rule IS NOT NULL
  AND t.parent_task_id IS NULL
  AND t.deleted_at IS NULL

UNION ALL

-- Part 3: NEW - Completed instances of recurring tasks
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
  t.user_global_timeline_id,
  t.custom_timeline_id,
  t.input_kind,
  t.recurrence_rule,
  t.recurrence_end_date,
  t.recurrence_exceptions,
  t.created_at,
  t.updated_at,
  t.due_date AS occurrence_date,
  false AS is_virtual_occurrence,
  t.parent_task_id AS source_task_id
FROM "0008-ap-tasks" t
WHERE t.parent_task_id IS NOT NULL
  AND t.status = 'completed'
  AND t.deleted_at IS NULL;

-- Recreate dependent view
CREATE VIEW v_dashboard_next_occurrences AS
SELECT * 
FROM v_tasks_with_recurrence_expanded
WHERE status = 'pending'
  AND occurrence_date IS NOT NULL
ORDER BY occurrence_date
LIMIT 10;
