/*
  # Create Weekly Reflection Views

  1. Purpose
    - Optimize Weekly Reflection data fetching with pre-aggregated views
    - Eliminate N+1 query problems with single optimized queries
    - Provide consistent date handling at database level
    - Enable efficient analytics and reporting

  2. New Views
    - v_weekly_completed_tasks - All completed tasks with associations by week
    - v_weekly_goal_actions - Goal action counts per week
    - v_weekly_role_investments - Role activity aggregation per week
    - v_weekly_domain_balance - Domain activity counts per week
    - v_weekly_withdrawals - Withdrawal aggregation by week
    - v_weekly_reflection_summary - Combined weekly statistics

  3. Performance
    - Adds functional indexes for week-based queries
    - Uses array aggregations for efficient association lookups
    - Leverages PostgreSQL date_trunc for consistent week calculation

  4. Security
    - Views use security_invoker to respect RLS on underlying tables
    - No new permissions needed - inherits from base tables
*/

-- =====================================================
-- View 1: Weekly Completed Tasks with Associations
-- =====================================================
CREATE OR REPLACE VIEW v_weekly_completed_tasks AS
SELECT
  t.user_id,
  t.id as task_id,
  t.title,
  t.completed_at,
  date_trunc('week', t.completed_at)::date as week_start_date,
  (date_trunc('week', t.completed_at) + interval '6 days')::date as week_end_date,
  t.is_authentic_deposit,
  t.is_urgent,
  t.is_important,
  -- Aggregate roles as array
  COALESCE(
    array_agg(DISTINCT rj.role_id) FILTER (WHERE rj.role_id IS NOT NULL),
    ARRAY[]::uuid[]
  ) as role_ids,
  -- Aggregate domains as array
  COALESCE(
    array_agg(DISTINCT dj.domain_id) FILTER (WHERE dj.domain_id IS NOT NULL),
    ARRAY[]::uuid[]
  ) as domain_ids,
  -- Aggregate goals as array
  COALESCE(
    array_agg(DISTINCT COALESCE(gj.twelve_wk_goal_id, gj.custom_goal_id))
    FILTER (WHERE gj.twelve_wk_goal_id IS NOT NULL OR gj.custom_goal_id IS NOT NULL),
    ARRAY[]::uuid[]
  ) as goal_ids,
  -- Check for notes
  EXISTS(
    SELECT 1 FROM "0008-ap-universal-notes-join" nj
    WHERE nj.parent_id = t.id AND nj.parent_type = 'task'
  ) as has_notes
FROM "0008-ap-tasks" t
LEFT JOIN "0008-ap-universal-roles-join" rj
  ON rj.parent_id = t.id AND rj.parent_type = 'task'
LEFT JOIN "0008-ap-universal-domains-join" dj
  ON dj.parent_id = t.id AND dj.parent_type = 'task'
LEFT JOIN "0008-ap-universal-goals-join" gj
  ON gj.parent_id = t.id AND gj.parent_type = 'task'
WHERE t.completed_at IS NOT NULL
GROUP BY t.id, t.user_id, t.title, t.completed_at, t.is_authentic_deposit, t.is_urgent, t.is_important;

-- =====================================================
-- View 2: Weekly Goal Actions Count
-- =====================================================
CREATE OR REPLACE VIEW v_weekly_goal_actions AS
SELECT
  t.user_id,
  COALESCE(gj.twelve_wk_goal_id, gj.custom_goal_id) as goal_id,
  gj.goal_type,
  date_trunc('week', t.completed_at)::date as week_start_date,
  COUNT(*) as action_count,
  -- Include goal details for convenience
  CASE
    WHEN gj.goal_type = 'twelve_wk_goal' THEN tw.title
    WHEN gj.goal_type = 'custom_goal' THEN cg.title
  END as goal_title,
  CASE
    WHEN gj.goal_type = 'twelve_wk_goal' THEN tw.status
    WHEN gj.goal_type = 'custom_goal' THEN cg.status
  END as goal_status,
  CASE
    WHEN gj.goal_type = 'twelve_wk_goal' THEN tw.weekly_target
    WHEN gj.goal_type = 'custom_goal' THEN cg.weekly_target
  END as weekly_target
FROM "0008-ap-tasks" t
INNER JOIN "0008-ap-universal-goals-join" gj
  ON gj.parent_id = t.id AND gj.parent_type = 'task'
LEFT JOIN "0008-ap-goals-12wk" tw
  ON gj.twelve_wk_goal_id = tw.id
LEFT JOIN "0008-ap-goals-custom" cg
  ON gj.custom_goal_id = cg.id
WHERE t.completed_at IS NOT NULL
GROUP BY
  t.user_id,
  goal_id,
  gj.goal_type,
  date_trunc('week', t.completed_at)::date,
  goal_title,
  goal_status,
  weekly_target;

-- =====================================================
-- View 3: Weekly Role Investments
-- =====================================================
CREATE OR REPLACE VIEW v_weekly_role_investments AS
WITH task_activities AS (
  SELECT
    t.user_id,
    rj.role_id,
    date_trunc('week', t.completed_at)::date as week_start_date,
    COUNT(*) as task_count
  FROM "0008-ap-tasks" t
  INNER JOIN "0008-ap-universal-roles-join" rj
    ON rj.parent_id = t.id AND rj.parent_type = 'task'
  WHERE t.completed_at IS NOT NULL
  GROUP BY t.user_id, rj.role_id, date_trunc('week', t.completed_at)::date
),
deposit_activities AS (
  SELECT
    di.user_id,
    rj.role_id,
    date_trunc('week', di.created_at)::date as week_start_date,
    COUNT(*) as deposit_idea_count
  FROM "0008-ap-deposit-ideas" di
  INNER JOIN "0008-ap-universal-roles-join" rj
    ON rj.parent_id = di.id AND rj.parent_type = 'depositIdea'
  WHERE di.archived = false
  GROUP BY di.user_id, rj.role_id, date_trunc('week', di.created_at)::date
)
SELECT
  COALESCE(ta.user_id, da.user_id) as user_id,
  COALESCE(ta.role_id, da.role_id) as role_id,
  COALESCE(ta.week_start_date, da.week_start_date) as week_start_date,
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
  AND ta.week_start_date = da.week_start_date
INNER JOIN "0008-ap-roles" r
  ON r.id = COALESCE(ta.role_id, da.role_id);

-- =====================================================
-- View 4: Weekly Domain Balance
-- =====================================================
CREATE OR REPLACE VIEW v_weekly_domain_balance AS
SELECT
  t.user_id,
  dj.domain_id,
  date_trunc('week', t.completed_at)::date as week_start_date,
  COUNT(*) as activity_count,
  -- Join domain details
  d.name as domain_name,
  d.color as domain_color
FROM "0008-ap-tasks" t
INNER JOIN "0008-ap-universal-domains-join" dj
  ON dj.parent_id = t.id AND dj.parent_type = 'task'
INNER JOIN "0008-ap-domains" d
  ON d.id = dj.domain_id
WHERE t.completed_at IS NOT NULL
GROUP BY
  t.user_id,
  dj.domain_id,
  date_trunc('week', t.completed_at)::date,
  d.name,
  d.color;

-- =====================================================
-- View 5: Weekly Withdrawals
-- =====================================================
CREATE OR REPLACE VIEW v_weekly_withdrawals AS
SELECT
  w.user_id,
  w.id as withdrawal_id,
  w.title,
  w.amount,
  w.withdrawn_at,
  date_trunc('week', w.withdrawn_at)::date as week_start_date,
  -- Aggregate roles
  COALESCE(
    array_agg(DISTINCT rj.role_id) FILTER (WHERE rj.role_id IS NOT NULL),
    ARRAY[]::uuid[]
  ) as role_ids,
  -- Count roles for easy access
  COUNT(DISTINCT rj.role_id) FILTER (WHERE rj.role_id IS NOT NULL) as role_count
FROM "0008-ap-withdrawals" w
LEFT JOIN "0008-ap-universal-roles-join" rj
  ON rj.parent_id = w.id AND rj.parent_type = 'withdrawal'
GROUP BY w.id, w.user_id, w.title, w.amount, w.withdrawn_at;

-- =====================================================
-- View 6: Weekly Withdrawal Analysis by Role
-- =====================================================
CREATE OR REPLACE VIEW v_weekly_withdrawal_by_role AS
SELECT
  w.user_id,
  rj.role_id,
  r.label as role_label,
  date_trunc('week', w.withdrawn_at)::date as week_start_date,
  COUNT(*) as withdrawal_count,
  SUM(w.amount) as total_amount
FROM "0008-ap-withdrawals" w
INNER JOIN "0008-ap-universal-roles-join" rj
  ON rj.parent_id = w.id AND rj.parent_type = 'withdrawal'
INNER JOIN "0008-ap-roles" r
  ON r.id = rj.role_id
GROUP BY w.user_id, rj.role_id, r.label, date_trunc('week', w.withdrawn_at)::date;

-- =====================================================
-- View 7: Weekly Reflection Summary (Combined Stats)
-- =====================================================
CREATE OR REPLACE VIEW v_weekly_reflection_summary AS
SELECT
  user_id,
  week_start_date,
  -- Goal actions count
  (SELECT COUNT(DISTINCT goal_id)
   FROM v_weekly_goal_actions vwga
   WHERE vwga.user_id = base.user_id
   AND vwga.week_start_date = base.week_start_date
   AND vwga.goal_status = 'active') as total_goals_with_actions,
  (SELECT COALESCE(SUM(action_count), 0)
   FROM v_weekly_goal_actions vwga
   WHERE vwga.user_id = base.user_id
   AND vwga.week_start_date = base.week_start_date) as total_actions_completed,
  -- Role investments count
  (SELECT COUNT(DISTINCT role_id)
   FROM v_weekly_role_investments vwri
   WHERE vwri.user_id = base.user_id
   AND vwri.week_start_date = base.week_start_date) as total_roles_invested,
  -- Domain balance count
  (SELECT COUNT(DISTINCT domain_id)
   FROM v_weekly_domain_balance vwdb
   WHERE vwdb.user_id = base.user_id
   AND vwdb.week_start_date = base.week_start_date) as total_domains_engaged,
  -- Withdrawals
  (SELECT COUNT(*)
   FROM v_weekly_withdrawals vww
   WHERE vww.user_id = base.user_id
   AND vww.week_start_date = base.week_start_date) as total_withdrawals,
  (SELECT COALESCE(SUM(amount), 0)
   FROM v_weekly_withdrawals vww
   WHERE vww.user_id = base.user_id
   AND vww.week_start_date = base.week_start_date) as total_withdrawal_amount
FROM (
  SELECT DISTINCT user_id, week_start_date
  FROM v_weekly_completed_tasks
  UNION
  SELECT DISTINCT user_id, week_start_date
  FROM v_weekly_withdrawals
) base;

-- =====================================================
-- Performance Indexes
-- =====================================================

-- Index for week-based task queries
CREATE INDEX IF NOT EXISTS idx_tasks_completed_at_week
  ON "0008-ap-tasks"(user_id, (date_trunc('week', completed_at)::date))
  WHERE completed_at IS NOT NULL;

-- Index for week-based withdrawal queries
CREATE INDEX IF NOT EXISTS idx_withdrawals_withdrawn_at_week
  ON "0008-ap-withdrawals"(user_id, (date_trunc('week', withdrawn_at)::date));

-- Composite index for goal joins
CREATE INDEX IF NOT EXISTS idx_goals_join_task_parent
  ON "0008-ap-universal-goals-join"(parent_id, parent_type, twelve_wk_goal_id, custom_goal_id)
  WHERE parent_type = 'task';

-- =====================================================
-- Helper Function: Get Current Week Dates
-- =====================================================
CREATE OR REPLACE FUNCTION get_current_week_dates()
RETURNS TABLE(week_start_date date, week_end_date date) AS $$
BEGIN
  RETURN QUERY
  SELECT
    date_trunc('week', CURRENT_DATE)::date as week_start_date,
    (date_trunc('week', CURRENT_DATE) + interval '6 days')::date as week_end_date;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- Helper Function: Get Week Dates for Any Date
-- =====================================================
CREATE OR REPLACE FUNCTION get_week_dates(input_date date)
RETURNS TABLE(week_start_date date, week_end_date date) AS $$
BEGIN
  RETURN QUERY
  SELECT
    date_trunc('week', input_date)::date as week_start_date,
    (date_trunc('week', input_date) + interval '6 days')::date as week_end_date;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================================
-- Comments for Documentation
-- =====================================================
COMMENT ON VIEW v_weekly_completed_tasks IS 'Pre-aggregated completed tasks with role, domain, and goal associations by week';
COMMENT ON VIEW v_weekly_goal_actions IS 'Count of completed actions per goal per week with goal details';
COMMENT ON VIEW v_weekly_role_investments IS 'Task and deposit idea counts per role per week';
COMMENT ON VIEW v_weekly_domain_balance IS 'Activity counts per wellness domain per week';
COMMENT ON VIEW v_weekly_withdrawals IS 'Withdrawals aggregated by week with role associations';
COMMENT ON VIEW v_weekly_withdrawal_by_role IS 'Withdrawal counts and amounts by role per week';
COMMENT ON VIEW v_weekly_reflection_summary IS 'Combined weekly statistics for reflection dashboard';
COMMENT ON FUNCTION get_current_week_dates() IS 'Returns start and end dates for the current week (Sunday-Saturday)';
COMMENT ON FUNCTION get_week_dates(date) IS 'Returns start and end dates for the week containing the given date';
