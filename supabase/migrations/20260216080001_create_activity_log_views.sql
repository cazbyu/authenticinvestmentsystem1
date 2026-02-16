-- Migration: Create analytics views for activity log data
-- These views aggregate activity log entries for dashboard and reporting

-- ============================================================
-- 1. Weekly summary per task
-- ============================================================

CREATE OR REPLACE VIEW v_activity_log_weekly_summary AS
SELECT
  al.user_id,
  al.task_id,
  t.title AS task_title,
  al.template_type,
  date_trunc('week', al.log_date)::date AS week_start,
  COUNT(*) AS entry_count,
  SUM(al.primary_metric) AS total_metric,
  AVG(al.primary_metric) AS avg_metric,
  MIN(al.primary_metric) AS min_metric,
  MAX(al.primary_metric) AS max_metric
FROM "0008-ap-activity-log" al
JOIN "0008-ap-tasks" t ON t.id = al.task_id
GROUP BY al.user_id, al.task_id, t.title, al.template_type, date_trunc('week', al.log_date)::date;

-- ============================================================
-- 2. Daily detail per task (entries as JSON array)
-- ============================================================

CREATE OR REPLACE VIEW v_activity_log_daily_summary AS
SELECT
  al.user_id,
  al.task_id,
  t.title AS task_title,
  al.log_date,
  al.template_type,
  COUNT(*) AS entry_count,
  SUM(al.primary_metric) AS total_metric,
  json_agg(
    json_build_object(
      'id', al.id,
      'primary_metric', al.primary_metric,
      'details', al.details,
      'notes', al.notes,
      'created_at', al.created_at
    ) ORDER BY al.created_at
  ) AS entries
FROM "0008-ap-activity-log" al
JOIN "0008-ap-tasks" t ON t.id = al.task_id
GROUP BY al.user_id, al.task_id, t.title, al.log_date, al.template_type;

-- ============================================================
-- 3. Grant access to authenticated users
-- ============================================================

GRANT SELECT ON v_activity_log_weekly_summary TO authenticated;
GRANT SELECT ON v_activity_log_daily_summary TO authenticated;
