/*
  # Create Morning Spark Delegations View

  1. Purpose
     - Unified view for all delegation assignments in Morning Spark
     - Shows delegated tasks due today or overdue
     - Includes delegate and task information
     - Filters by completion status

  2. Columns
     - delegation_id: Delegation record ID
     - user_id: User who delegated
     - delegate_name: Name of person delegated to
     - delegate_email: Email of delegate
     - task_id: ID of delegated task
     - task_title: Title of task
     - due_date: Delegation due date
     - completed: Completion status
     - status: Delegation status
     - notes: Delegation notes/context
     - created_at: When delegation was created
*/

CREATE OR REPLACE VIEW v_morning_spark_delegations AS
SELECT
  d.id AS delegation_id,
  d.user_id,
  d.name AS delegate_name,
  d.email AS delegate_email,
  d.task_id,
  t.title AS task_title,
  d.due_date,
  d.completed,
  COALESCE(d.status, 'pending') AS status,
  d.notes,
  d.created_at,
  t.status AS task_status
FROM "0008-ap-delegates" d
LEFT JOIN "0008-ap-tasks" t
  ON d.task_id = t.id
WHERE d.task_id IS NOT NULL
  AND d.completed = false
  AND d.due_date IS NOT NULL
  AND d.due_date <= CURRENT_DATE
  AND COALESCE(d.status, 'pending') != 'cancelled';

COMMENT ON VIEW v_morning_spark_delegations IS
  'Unified view of all active delegations due today or overdue for Morning Spark. Includes delegate and task information.';
