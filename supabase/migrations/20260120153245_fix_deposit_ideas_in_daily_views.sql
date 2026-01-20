/*
  # Fix Deposit Ideas Visibility in Daily Views

  1. Changes
     - Remove is_active filter from v_daily_role_investments view
     - Show ALL deposit ideas (both activated and not activated) when calculating role investments
     - This ensures deposit ideas appear in the Daily View aggregation metrics

  2. Views Updated
     - v_daily_role_investments

  3. Notes
     - Only updating role investments view as that's the only one that references deposit ideas
     - Other views (goals, domains) only reference tasks
*/

DROP VIEW IF EXISTS v_daily_role_investments CASCADE;

CREATE VIEW v_daily_role_investments AS
WITH note_activities AS (
  -- Get all notes with their local date
  SELECT
    j.user_id,
    j.parent_id,
    j.parent_type,
    n.id AS note_id,
    n.created_at,
    n.created_at::date AS activity_date
  FROM "0008-ap-universal-notes-join" j
  JOIN "0008-ap-notes" n ON n.id = j.note_id
  LEFT JOIN "0008-ap-note-attachments" na ON na.note_id = n.id
  WHERE (
    (n.content IS NOT NULL AND btrim(n.content) <> '')
    OR na.id IS NOT NULL
  )
),
task_activities AS (
  SELECT
    t.user_id,
    rj.role_id,
    na.activity_date,
    COUNT(DISTINCT na.note_id) as task_count
  FROM "0008-ap-tasks" t
  INNER JOIN note_activities na
    ON na.parent_id = t.id AND na.parent_type = 'task'
  INNER JOIN "0008-ap-universal-roles-join" rj
    ON rj.parent_id = t.id AND rj.parent_type = 'task'
  WHERE t.deleted_at IS NULL
  GROUP BY t.user_id, rj.role_id, na.activity_date
),
deposit_activities AS (
  -- Show ALL deposit ideas (both activated and not activated)
  SELECT
    di.user_id,
    rj.role_id,
    na.activity_date,
    COUNT(DISTINCT na.note_id) as deposit_idea_count
  FROM "0008-ap-deposit-ideas" di
  INNER JOIN note_activities na
    ON na.parent_id = di.id AND na.parent_type = 'depositIdea'
  INNER JOIN "0008-ap-universal-roles-join" rj
    ON rj.parent_id = di.id AND rj.parent_type = 'depositIdea'
  WHERE di.archived = false
  GROUP BY di.user_id, rj.role_id, na.activity_date
)
SELECT
  COALESCE(ta.user_id, da.user_id) as user_id,
  COALESCE(ta.role_id, da.role_id) as role_id,
  COALESCE(ta.activity_date, da.activity_date) as activity_date,
  COALESCE(ta.task_count, 0) as task_count,
  COALESCE(da.deposit_idea_count, 0) as deposit_idea_count,
  COALESCE(ta.task_count, 0) + COALESCE(da.deposit_idea_count, 0) as total_activities,
  -- Join role details
  r.label as role_label,
  r.color as role_color
FROM task_activities ta
FULL OUTER JOIN deposit_activities da
  ON ta.user_id = da.user_id
  AND ta.role_id = da.role_id
  AND ta.activity_date = da.activity_date
INNER JOIN "0008-ap-roles" r
  ON r.id = COALESCE(ta.role_id, da.role_id);

COMMENT ON VIEW v_daily_role_investments IS
  'Role investments by note date - shows all deposit ideas regardless of activation status';
