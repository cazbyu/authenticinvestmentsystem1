/*
  # Fix Daily Views to Use Note Dates Instead of Task Completion Dates

  ## Problem
  Daily views (v_daily_role_investments, v_daily_domain_balance, v_daily_goal_actions)
  were using task completion dates, but the application design requires items to appear
  based on when notes were created/updated, not when tasks were completed.

  This caused a mismatch where:
  - Top sections of daily view showed tasks completed on a date
  - Bottom section showed notes created on that date
  - Result: Different items appeared in different sections

  ## Solution
  Rewrite all daily views to:
  1. Join through universal-notes-join to get notes
  2. Use note's created_at date as the activity_date
  3. Filter by real notes (have content or attachments)
  4. Match the logic in get_daily_history_items function

  ## Views Updated
  - v_daily_goal_actions
  - v_daily_role_investments
  - v_daily_domain_balance

  ## Expected Behavior
  All sections of the daily view now show items based on note dates, ensuring
  consistency across the entire daily view interface.
*/

-- =====================================================
-- Updated View 1: Daily Goal Actions (By Note Date)
-- =====================================================
DROP VIEW IF EXISTS v_daily_goal_actions CASCADE;

CREATE VIEW v_daily_goal_actions AS
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
  AND j.parent_type = 'task'
)
SELECT
  t.user_id,
  COALESCE(gj.twelve_wk_goal_id, gj.custom_goal_id) as goal_id,
  gj.goal_type,
  na.activity_date AS completion_date,
  COUNT(DISTINCT na.note_id) as action_count,
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
INNER JOIN note_activities na
  ON na.parent_id = t.id AND na.parent_type = 'task'
INNER JOIN "0008-ap-universal-goals-join" gj
  ON gj.parent_id = t.id AND gj.parent_type = 'task'
LEFT JOIN "0008-ap-goals-12wk" tw
  ON gj.twelve_wk_goal_id = tw.id
LEFT JOIN "0008-ap-goals-custom" cg
  ON gj.custom_goal_id = cg.id
WHERE t.deleted_at IS NULL
GROUP BY
  t.user_id,
  goal_id,
  gj.goal_type,
  na.activity_date,
  goal_title,
  goal_status;

COMMENT ON VIEW v_daily_goal_actions IS
  'Goal actions by note date - shows when notes were created, not when tasks were completed';

-- =====================================================
-- Updated View 2: Daily Role Investments (By Note Date)
-- =====================================================
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
    AND COALESCE(di.is_active, true) = true
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
  'Role investments by note date - shows when notes were created, not when tasks were completed';

-- =====================================================
-- Updated View 3: Daily Domain Balance (By Note Date)
-- =====================================================
DROP VIEW IF EXISTS v_daily_domain_balance CASCADE;

CREATE VIEW v_daily_domain_balance AS
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
  AND j.parent_type = 'task'
)
SELECT
  t.user_id,
  dj.domain_id,
  na.activity_date,
  COUNT(DISTINCT na.note_id) as activity_count,
  -- Join domain details
  d.name as domain_name,
  NULL::text as domain_color
FROM "0008-ap-tasks" t
INNER JOIN note_activities na
  ON na.parent_id = t.id AND na.parent_type = 'task'
INNER JOIN "0008-ap-universal-domains-join" dj
  ON dj.parent_id = t.id AND dj.parent_type = 'task'
INNER JOIN "0008-ap-domains" d
  ON d.id = dj.domain_id
WHERE t.deleted_at IS NULL
GROUP BY
  t.user_id,
  dj.domain_id,
  na.activity_date,
  d.name;

COMMENT ON VIEW v_daily_domain_balance IS
  'Domain balance by note date - shows when notes were created, not when tasks were completed';

-- =====================================================
-- Grant Permissions
-- =====================================================
GRANT SELECT ON v_daily_goal_actions TO authenticated;
GRANT SELECT ON v_daily_role_investments TO authenticated;
GRANT SELECT ON v_daily_domain_balance TO authenticated;
