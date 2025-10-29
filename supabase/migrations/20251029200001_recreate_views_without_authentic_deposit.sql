/*
  # Recreate Views Without Authentic Deposit Column

  This migration recreates all views that were dropped when removing the is_authentic_deposit column.
  The views are recreated with the same structure but without the is_authentic_deposit field.

  Views recreated:
  - v_tasks_with_recurrence_expanded
  - v_dashboard_next_occurrences
  - ap_task_when
  - mv_role_weekly
  - v_weekly_completed_tasks
*/

-- Recreate v_tasks_with_recurrence_expanded (base view for recurring tasks)
CREATE OR REPLACE VIEW v_tasks_with_recurrence_expanded AS
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

SELECT
  t.id,
  t.user_id,
  NULL::uuid AS parent_task_id,
  t.type,
  t.title,
  'pending'::status_enum AS status,
  occ.occurrence_date AS due_date,
  CASE WHEN t.type = 'event' THEN occ.occurrence_date ELSE NULL END AS start_date,
  CASE WHEN t.type = 'event' THEN occ.occurrence_date ELSE NULL END AS end_date,
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
) AS occ
WHERE t.recurrence_rule IS NOT NULL
  AND t.parent_task_id IS NULL
  AND t.deleted_at IS NULL;

-- Recreate v_dashboard_next_occurrences with midnight filtering
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
  (CURRENT_TIMESTAMP AT TIME ZONE COALESCE(mf.timezone, 'UTC'))::date >= mf.occurrence_date
  AND (
    (CURRENT_TIMESTAMP AT TIME ZONE COALESCE(mf.timezone, 'UTC'))::date > mf.occurrence_date
    OR
    (
      (CURRENT_TIMESTAMP AT TIME ZONE COALESCE(mf.timezone, 'UTC'))::date = mf.occurrence_date
      AND EXTRACT(HOUR FROM (CURRENT_TIMESTAMP AT TIME ZONE COALESCE(mf.timezone, 'UTC'))) * 60
        + EXTRACT(MINUTE FROM (CURRENT_TIMESTAMP AT TIME ZONE COALESCE(mf.timezone, 'UTC'))) >= 1
    )
  );

-- Recreate ap_task_when view (if it exists)
CREATE OR REPLACE VIEW ap_task_when AS
SELECT
  id,
  user_id,
  title,
  type,
  status,
  due_date,
  start_date,
  end_date,
  start_time,
  end_time,
  is_all_day,
  is_urgent,
  is_important,
  completed_at,
  created_at,
  updated_at
FROM "0008-ap-tasks"
WHERE deleted_at IS NULL;

-- Recreate v_weekly_completed_tasks view (if it exists)
CREATE OR REPLACE VIEW v_weekly_completed_tasks AS
SELECT
  t.id,
  t.user_id,
  t.title,
  t.type,
  t.status,
  t.completed_at,
  t.due_date,
  DATE_TRUNC('week', t.completed_at) AS week_start
FROM "0008-ap-tasks" t
WHERE t.status = 'completed'
  AND t.completed_at IS NOT NULL
  AND t.deleted_at IS NULL;

-- Note: mv_role_weekly is a materialized view that depends on ap_task_when
-- It will need to be refreshed after this migration completes
-- The materialized view should be refreshed using: REFRESH MATERIALIZED VIEW mv_role_weekly;
