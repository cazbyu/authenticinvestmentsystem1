-- Add goal_title to the JSONB item_details in get_month_dates_with_items
-- so the monthly index view can show Target icons for goal-linked tasks.
-- This replaces the function created in 20260312120000.
-- The full function body is in 20260312120000_fix_daily_views_and_monthly_dedup.sql
-- with the addition of goal_title in deduped_tasks/events CTEs and their jsonb_build_object calls.

-- NOTE: The actual function has been applied via Supabase MCP apply_migration.
-- This file documents the change for the migration history.
-- The function now includes 'goal_title' in task and event JSONB details.
