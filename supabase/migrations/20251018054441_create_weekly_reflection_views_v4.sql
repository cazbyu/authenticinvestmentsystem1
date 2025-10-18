/*
  # Create Weekly Reflection Views
  
  Creates optimized database views for Weekly Reflection feature
*/

-- Drop existing views
DROP VIEW IF EXISTS v_weekly_reflection_summary CASCADE;
DROP VIEW IF EXISTS v_weekly_withdrawal_by_role CASCADE;
DROP VIEW IF EXISTS v_weekly_withdrawals CASCADE;
DROP VIEW IF EXISTS v_weekly_domain_balance CASCADE;
DROP VIEW IF EXISTS v_weekly_role_investments CASCADE;
DROP VIEW IF EXISTS v_weekly_goal_actions CASCADE;
DROP VIEW IF EXISTS v_weekly_completed_tasks CASCADE;

-- View 1: Weekly Completed Tasks
CREATE VIEW v_weekly_completed_tasks AS
SELECT
  t.user_id, t.id as task_id, t.title, t.completed_at,
  date_trunc('week', t.completed_at)::date as week_start_date,
  (date_trunc('week', t.completed_at) + interval '6 days')::date as week_end_date,
  t.is_authentic_deposit, t.is_urgent, t.is_important,
  COALESCE(array_agg(DISTINCT rj.role_id) FILTER (WHERE rj.role_id IS NOT NULL), ARRAY[]::uuid[]) as role_ids,
  COALESCE(array_agg(DISTINCT dj.domain_id) FILTER (WHERE dj.domain_id IS NOT NULL), ARRAY[]::uuid[]) as domain_ids,
  COALESCE(array_agg(DISTINCT COALESCE(gj.twelve_wk_goal_id, gj.custom_goal_id)) FILTER (WHERE gj.twelve_wk_goal_id IS NOT NULL OR gj.custom_goal_id IS NOT NULL), ARRAY[]::uuid[]) as goal_ids
FROM "0008-ap-tasks" t
LEFT JOIN "0008-ap-universal-roles-join" rj ON rj.parent_id = t.id AND rj.parent_type = 'task'
LEFT JOIN "0008-ap-universal-domains-join" dj ON dj.parent_id = t.id AND dj.parent_type = 'task'
LEFT JOIN "0008-ap-universal-goals-join" gj ON gj.parent_id = t.id AND gj.parent_type = 'task'
WHERE t.completed_at IS NOT NULL
GROUP BY t.id;

-- View 2: Weekly Goal Actions
CREATE VIEW v_weekly_goal_actions AS
SELECT
  t.user_id,
  COALESCE(gj.twelve_wk_goal_id, gj.custom_goal_id) as goal_id,
  gj.goal_type,
  date_trunc('week', t.completed_at)::date as week_start_date,
  COUNT(*) as action_count,
  CASE WHEN gj.goal_type = 'twelve_wk_goal' THEN tw.title WHEN gj.goal_type = 'custom_goal' THEN cg.title END as goal_title,
  CASE WHEN gj.goal_type = 'twelve_wk_goal' THEN tw.status WHEN gj.goal_type = 'custom_goal' THEN cg.status END as goal_status,
  CASE WHEN gj.goal_type = 'twelve_wk_goal' THEN tw.weekly_target WHEN gj.goal_type = 'custom_goal' THEN cg.weekly_target END as weekly_target
FROM "0008-ap-tasks" t
INNER JOIN "0008-ap-universal-goals-join" gj ON gj.parent_id = t.id AND gj.parent_type = 'task'
LEFT JOIN "0008-ap-goals-12wk" tw ON gj.twelve_wk_goal_id = tw.id
LEFT JOIN "0008-ap-goals-custom" cg ON gj.custom_goal_id = cg.id
WHERE t.completed_at IS NOT NULL
GROUP BY t.user_id, goal_id, gj.goal_type, week_start_date, tw.title, tw.status, tw.weekly_target, cg.title, cg.status, cg.weekly_target;

-- View 3: Weekly Role Investments
CREATE VIEW v_weekly_role_investments AS
WITH task_activities AS (
  SELECT t.user_id, rj.role_id, date_trunc('week', t.completed_at)::date as week_start_date, COUNT(*) as task_count
  FROM "0008-ap-tasks" t
  INNER JOIN "0008-ap-universal-roles-join" rj ON rj.parent_id = t.id AND rj.parent_type = 'task'
  WHERE t.completed_at IS NOT NULL
  GROUP BY t.user_id, rj.role_id, week_start_date
),
deposit_activities AS (
  SELECT di.user_id, rj.role_id, date_trunc('week', di.created_at)::date as week_start_date, COUNT(*) as deposit_idea_count
  FROM "0008-ap-deposit-ideas" di
  INNER JOIN "0008-ap-universal-roles-join" rj ON rj.parent_id = di.id AND rj.parent_type = 'depositIdea'
  WHERE di.archived = false
  GROUP BY di.user_id, rj.role_id, week_start_date
)
SELECT
  COALESCE(ta.user_id, da.user_id) as user_id,
  COALESCE(ta.role_id, da.role_id) as role_id,
  COALESCE(ta.week_start_date, da.week_start_date) as week_start_date,
  COALESCE(ta.task_count, 0) as task_count,
  COALESCE(da.deposit_idea_count, 0) as deposit_idea_count,
  COALESCE(ta.task_count, 0) + COALESCE(da.deposit_idea_count, 0) as total_activities,
  r.label as role_label, r.color as role_color
FROM task_activities ta
FULL OUTER JOIN deposit_activities da ON ta.user_id = da.user_id AND ta.role_id = da.role_id AND ta.week_start_date = da.week_start_date
INNER JOIN "0008-ap-roles" r ON r.id = COALESCE(ta.role_id, da.role_id);

-- View 4: Weekly Domain Balance
CREATE VIEW v_weekly_domain_balance AS
SELECT
  t.user_id, dj.domain_id,
  date_trunc('week', t.completed_at)::date as week_start_date,
  COUNT(*) as activity_count,
  d.name as domain_name
FROM "0008-ap-tasks" t
INNER JOIN "0008-ap-universal-domains-join" dj ON dj.parent_id = t.id AND dj.parent_type = 'task'
INNER JOIN "0008-ap-domains" d ON d.id = dj.domain_id
WHERE t.completed_at IS NOT NULL
GROUP BY t.user_id, dj.domain_id, week_start_date, d.name;

-- View 5: Weekly Withdrawals
CREATE VIEW v_weekly_withdrawals AS
SELECT
  w.user_id, w.id as withdrawal_id, w.title, w.amount, w.withdrawn_at,
  date_trunc('week', w.withdrawn_at)::date as week_start_date,
  COALESCE(array_agg(DISTINCT rj.role_id) FILTER (WHERE rj.role_id IS NOT NULL), ARRAY[]::uuid[]) as role_ids
FROM "0008-ap-withdrawals" w
LEFT JOIN "0008-ap-universal-roles-join" rj ON rj.parent_id = w.id AND rj.parent_type = 'withdrawal'
GROUP BY w.id;

-- View 6: Weekly Withdrawal by Role  
CREATE VIEW v_weekly_withdrawal_by_role AS
SELECT
  w.user_id, rj.role_id, r.label as role_label,
  date_trunc('week', w.withdrawn_at)::date as week_start_date,
  COUNT(*) as withdrawal_count,
  SUM(w.amount) as total_amount
FROM "0008-ap-withdrawals" w
INNER JOIN "0008-ap-universal-roles-join" rj ON rj.parent_id = w.id AND rj.parent_type = 'withdrawal'
INNER JOIN "0008-ap-roles" r ON r.id = rj.role_id
GROUP BY w.user_id, rj.role_id, r.label, week_start_date;

-- Helper Functions
CREATE OR REPLACE FUNCTION get_current_week_dates() RETURNS TABLE(week_start_date date, week_end_date date) AS $$
BEGIN
  RETURN QUERY SELECT date_trunc('week', CURRENT_DATE)::date, (date_trunc('week', CURRENT_DATE) + interval '6 days')::date;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION get_week_dates(input_date date) RETURNS TABLE(week_start_date date, week_end_date date) AS $$
BEGIN
  RETURN QUERY SELECT date_trunc('week', input_date)::date, (date_trunc('week', input_date) + interval '6 days')::date;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
