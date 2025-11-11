/*
  # Fix Weekly and Daily Reflection Views - Sunday-Based Week Calculation

  1. Problem
    - PostgreSQL date_trunc('week') starts weeks on Monday
    - JavaScript getDay() starts weeks on Sunday (0 = Sunday)
    - This mismatch causes data to not show up in Weekly/Daily Reflections
    - Daily views were reusing weekly view logic incorrectly

  2. Solution
    - Create helper function to calculate Sunday-based weeks
    - Update all weekly views to use Sunday as week start
    - Create dedicated daily views that query by exact date
    - Ensure consistent date handling across all views

  3. New Helper Function
    - get_sunday_week_start: Returns Sunday for any given date's week

  4. Updated Views
    - v_weekly_completed_tasks: Now uses Sunday-based weeks
    - v_weekly_goal_actions: Now uses Sunday-based weeks
    - v_weekly_role_investments: Now uses Sunday-based weeks
    - v_weekly_domain_balance: Now uses Sunday-based weeks
    - v_weekly_withdrawals: Now uses Sunday-based weeks
    - v_weekly_withdrawal_by_role: Now uses Sunday-based weeks

  5. New Daily Views
    - v_daily_goal_actions: Goal actions by exact date
    - v_daily_role_investments: Role investments by exact date
    - v_daily_domain_balance: Domain balance by exact date

  6. Security
    - All views maintain RLS through underlying table permissions
*/

-- =====================================================
-- Helper Function: Get Sunday-Based Week Start
-- =====================================================
-- This function ensures weeks start on Sunday to match JavaScript Date logic
CREATE OR REPLACE FUNCTION get_sunday_week_start(input_date timestamp with time zone)
RETURNS date AS $$
BEGIN
  -- Get the day of week (0 = Sunday, 6 = Saturday in PostgreSQL with week_start=0)
  -- Subtract the day of week to get to the previous Sunday
  RETURN (input_date - (EXTRACT(DOW FROM input_date) || ' days')::interval)::date;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION get_sunday_week_start(timestamp with time zone) IS
'Returns the Sunday date for the week containing the input date. Used to align with JavaScript Date.getDay() logic where Sunday=0.';

-- =====================================================
-- Updated View 1: Weekly Completed Tasks (Sunday-Based)
-- =====================================================
DROP VIEW IF EXISTS v_weekly_completed_tasks CASCADE;

CREATE VIEW v_weekly_completed_tasks AS
SELECT
  t.user_id,
  t.id as task_id,
  t.title,
  t.completed_at,
  get_sunday_week_start(t.completed_at) as week_start_date,
  (get_sunday_week_start(t.completed_at) + interval '6 days')::date as week_end_date,
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
  AND t.deleted_at IS NULL
GROUP BY t.id, t.user_id, t.title, t.completed_at, t.is_authentic_deposit, t.is_urgent, t.is_important;

-- =====================================================
-- Updated View 2: Weekly Goal Actions (Sunday-Based)
-- =====================================================
DROP VIEW IF EXISTS v_weekly_goal_actions CASCADE;

CREATE VIEW v_weekly_goal_actions AS
SELECT
  t.user_id,
  COALESCE(gj.twelve_wk_goal_id, gj.custom_goal_id) as goal_id,
  gj.goal_type,
  get_sunday_week_start(t.completed_at) as week_start_date,
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
  AND t.deleted_at IS NULL
GROUP BY
  t.user_id,
  goal_id,
  gj.goal_type,
  get_sunday_week_start(t.completed_at),
  goal_title,
  goal_status,
  weekly_target;

-- =====================================================
-- Updated View 3: Weekly Role Investments (Sunday-Based)
-- =====================================================
DROP VIEW IF EXISTS v_weekly_role_investments CASCADE;

CREATE VIEW v_weekly_role_investments AS
WITH task_activities AS (
  SELECT
    t.user_id,
    rj.role_id,
    get_sunday_week_start(t.completed_at) as week_start_date,
    COUNT(*) as task_count
  FROM "0008-ap-tasks" t
  INNER JOIN "0008-ap-universal-roles-join" rj
    ON rj.parent_id = t.id AND rj.parent_type = 'task'
  WHERE t.completed_at IS NOT NULL
    AND t.deleted_at IS NULL
  GROUP BY t.user_id, rj.role_id, get_sunday_week_start(t.completed_at)
),
deposit_activities AS (
  SELECT
    di.user_id,
    rj.role_id,
    get_sunday_week_start(di.created_at) as week_start_date,
    COUNT(*) as deposit_idea_count
  FROM "0008-ap-deposit-ideas" di
  INNER JOIN "0008-ap-universal-roles-join" rj
    ON rj.parent_id = di.id AND rj.parent_type = 'depositIdea'
  WHERE di.archived = false
    AND COALESCE(di.is_active, true) = true
  GROUP BY di.user_id, rj.role_id, get_sunday_week_start(di.created_at)
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
-- Updated View 4: Weekly Domain Balance (Sunday-Based)
-- =====================================================
DROP VIEW IF EXISTS v_weekly_domain_balance CASCADE;

CREATE VIEW v_weekly_domain_balance AS
SELECT
  t.user_id,
  dj.domain_id,
  get_sunday_week_start(t.completed_at) as week_start_date,
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
  AND t.deleted_at IS NULL
GROUP BY
  t.user_id,
  dj.domain_id,
  get_sunday_week_start(t.completed_at),
  d.name,
  d.color;

-- =====================================================
-- Updated View 5: Weekly Withdrawals (Sunday-Based)
-- =====================================================
DROP VIEW IF EXISTS v_weekly_withdrawals CASCADE;

CREATE VIEW v_weekly_withdrawals AS
SELECT
  w.user_id,
  w.id as withdrawal_id,
  w.title,
  w.amount,
  w.withdrawn_at,
  get_sunday_week_start(w.withdrawn_at) as week_start_date,
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
-- Updated View 6: Weekly Withdrawal by Role (Sunday-Based)
-- =====================================================
DROP VIEW IF EXISTS v_weekly_withdrawal_by_role CASCADE;

CREATE VIEW v_weekly_withdrawal_by_role AS
SELECT
  w.user_id,
  rj.role_id,
  r.label as role_label,
  get_sunday_week_start(w.withdrawn_at) as week_start_date,
  COUNT(*) as withdrawal_count,
  SUM(w.amount) as total_amount
FROM "0008-ap-withdrawals" w
INNER JOIN "0008-ap-universal-roles-join" rj
  ON rj.parent_id = w.id AND rj.parent_type = 'withdrawal'
INNER JOIN "0008-ap-roles" r
  ON r.id = rj.role_id
GROUP BY w.user_id, rj.role_id, r.label, get_sunday_week_start(w.withdrawn_at);

-- =====================================================
-- New View 7: Daily Goal Actions (By Exact Date)
-- =====================================================
CREATE OR REPLACE VIEW v_daily_goal_actions AS
SELECT
  t.user_id,
  COALESCE(gj.twelve_wk_goal_id, gj.custom_goal_id) as goal_id,
  gj.goal_type,
  t.completed_at::date as completion_date,
  COUNT(*) as action_count,
  -- Include goal details
  CASE
    WHEN gj.goal_type = 'twelve_wk_goal' THEN tw.title
    WHEN gj.goal_type = 'custom_goal' THEN cg.title
  END as goal_title,
  CASE
    WHEN gj.goal_type = 'twelve_wk_goal' THEN tw.status
    WHEN gj.goal_type = 'custom_goal' THEN cg.status
  END as goal_status
FROM "0008-ap-tasks" t
INNER JOIN "0008-ap-universal-goals-join" gj
  ON gj.parent_id = t.id AND gj.parent_type = 'task'
LEFT JOIN "0008-ap-goals-12wk" tw
  ON gj.twelve_wk_goal_id = tw.id
LEFT JOIN "0008-ap-goals-custom" cg
  ON gj.custom_goal_id = cg.id
WHERE t.completed_at IS NOT NULL
  AND t.deleted_at IS NULL
GROUP BY
  t.user_id,
  goal_id,
  gj.goal_type,
  t.completed_at::date,
  goal_title,
  goal_status;

-- =====================================================
-- New View 8: Daily Role Investments (By Exact Date)
-- =====================================================
CREATE OR REPLACE VIEW v_daily_role_investments AS
WITH task_activities AS (
  SELECT
    t.user_id,
    rj.role_id,
    t.completed_at::date as activity_date,
    COUNT(*) as task_count
  FROM "0008-ap-tasks" t
  INNER JOIN "0008-ap-universal-roles-join" rj
    ON rj.parent_id = t.id AND rj.parent_type = 'task'
  WHERE t.completed_at IS NOT NULL
    AND t.deleted_at IS NULL
  GROUP BY t.user_id, rj.role_id, t.completed_at::date
),
deposit_activities AS (
  SELECT
    di.user_id,
    rj.role_id,
    di.created_at::date as activity_date,
    COUNT(*) as deposit_idea_count
  FROM "0008-ap-deposit-ideas" di
  INNER JOIN "0008-ap-universal-roles-join" rj
    ON rj.parent_id = di.id AND rj.parent_type = 'depositIdea'
  WHERE di.archived = false
    AND COALESCE(di.is_active, true) = true
  GROUP BY di.user_id, rj.role_id, di.created_at::date
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

-- =====================================================
-- New View 9: Daily Domain Balance (By Exact Date)
-- =====================================================
CREATE OR REPLACE VIEW v_daily_domain_balance AS
SELECT
  t.user_id,
  dj.domain_id,
  t.completed_at::date as activity_date,
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
  AND t.deleted_at IS NULL
GROUP BY
  t.user_id,
  dj.domain_id,
  t.completed_at::date,
  d.name,
  d.color;

-- =====================================================
-- Update Helper Functions to Use Sunday-Based Weeks
-- =====================================================
DROP FUNCTION IF EXISTS get_current_week_dates();
DROP FUNCTION IF EXISTS get_week_dates(date);

CREATE OR REPLACE FUNCTION get_current_week_dates()
RETURNS TABLE(week_start_date date, week_end_date date) AS $$
BEGIN
  RETURN QUERY
  SELECT
    get_sunday_week_start(CURRENT_TIMESTAMP) as week_start_date,
    (get_sunday_week_start(CURRENT_TIMESTAMP) + interval '6 days')::date as week_end_date;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION get_week_dates(input_date date)
RETURNS TABLE(week_start_date date, week_end_date date) AS $$
BEGIN
  RETURN QUERY
  SELECT
    get_sunday_week_start(input_date::timestamp with time zone) as week_start_date,
    (get_sunday_week_start(input_date::timestamp with time zone) + interval '6 days')::date as week_end_date;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================================
-- Update Indexes to Use Sunday-Based Week Function
-- =====================================================
DROP INDEX IF EXISTS idx_tasks_completed_at_week;
DROP INDEX IF EXISTS idx_withdrawals_withdrawn_at_week;

CREATE INDEX idx_tasks_completed_at_week
  ON "0008-ap-tasks"(user_id, (get_sunday_week_start(completed_at)))
  WHERE completed_at IS NOT NULL;

CREATE INDEX idx_withdrawals_withdrawn_at_week
  ON "0008-ap-withdrawals"(user_id, (get_sunday_week_start(withdrawn_at)));

-- Add indexes for daily queries
CREATE INDEX IF NOT EXISTS idx_tasks_completed_at_date
  ON "0008-ap-tasks"(user_id, ((completed_at)::date))
  WHERE completed_at IS NOT NULL;

-- =====================================================
-- Updated Comments
-- =====================================================
COMMENT ON VIEW v_weekly_completed_tasks IS 'Completed tasks with associations by week (Sunday-based weeks)';
COMMENT ON VIEW v_weekly_goal_actions IS 'Goal action counts per week (Sunday-based weeks)';
COMMENT ON VIEW v_weekly_role_investments IS 'Task and deposit idea counts per role per week (Sunday-based weeks)';
COMMENT ON VIEW v_weekly_domain_balance IS 'Activity counts per wellness domain per week (Sunday-based weeks)';
COMMENT ON VIEW v_weekly_withdrawals IS 'Withdrawals aggregated by week (Sunday-based weeks)';
COMMENT ON VIEW v_weekly_withdrawal_by_role IS 'Withdrawal counts and amounts by role per week (Sunday-based weeks)';
COMMENT ON VIEW v_daily_goal_actions IS 'Goal actions by exact date for daily reflections';
COMMENT ON VIEW v_daily_role_investments IS 'Role investments by exact date for daily reflections';
COMMENT ON VIEW v_daily_domain_balance IS 'Domain balance by exact date for daily reflections';
COMMENT ON FUNCTION get_current_week_dates() IS 'Returns start and end dates for current week (Sunday-Saturday)';
COMMENT ON FUNCTION get_week_dates(date) IS 'Returns start and end dates for the week containing given date (Sunday-Saturday)';
