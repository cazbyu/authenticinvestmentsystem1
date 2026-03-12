/*
  # Show ALL Items in Daily Action & Reflection Journal

  Previously, tasks/events/deposit-ideas/withdrawals only appeared in the
  daily view if they had notes attached (via JOIN on notes tables). This
  rewrite shows ALL completed items for the target date, regardless of
  whether they have notes.

  Items are anchored to:
  - Reflections: created_at date (local timezone)
  - Tasks: completed_at date (local timezone)
  - Events: start_date, end_date, or completed_at date
  - Deposit Ideas: created_at date (local timezone)
  - Withdrawals: withdrawn_at or created_at date (local timezone)

  The RETURNS TABLE signature is unchanged so the frontend TypeScript
  interface (DailyHistoryItemRow) continues to work.
*/

CREATE OR REPLACE FUNCTION get_daily_history_items(
  p_target_date date,
  p_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  title text,
  type text,
  status text,
  priority text,
  points numeric,
  completed_at timestamptz,
  created_at timestamptz,
  start_time time,
  is_all_day boolean,
  parent_id uuid,
  parent_type text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_timezone text;
BEGIN
  v_user_id := COALESCE(p_user_id, auth.uid());

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User ID is required';
  END IF;

  IF p_target_date IS NULL THEN
    RAISE EXCEPTION 'Target date is required';
  END IF;

  SELECT COALESCE(timezone, 'America/Denver')
  INTO v_timezone
  FROM "0008-ap-users"
  WHERE "0008-ap-users".id = v_user_id;

  v_timezone := COALESCE(v_timezone, 'America/Denver');

  RETURN QUERY

  -- 1. REFLECTIONS
  SELECT
    r.id,
    COALESCE(r.reflection_title,
      CASE
        WHEN r.daily_rose THEN 'Daily Rose'
        WHEN r.daily_thorn THEN 'Daily Thorn'
        ELSE 'Reflection'
      END
    ) AS title,
    CASE
      WHEN r.daily_rose THEN 'rose'
      WHEN r.daily_thorn THEN 'thorn'
      ELSE 'reflection'
    END AS type,
    'completed'::text AS status,
    'Normal'::text AS priority,
    0::numeric AS points,
    r.created_at AS completed_at,
    r.created_at,
    NULL::time AS start_time,
    FALSE AS is_all_day,
    r.parent_id,
    r.parent_type
  FROM "0008-ap-reflections" r
  WHERE r.user_id = v_user_id
    AND r.archived = false
    AND (
      r.date = p_target_date
      OR date(r.created_at AT TIME ZONE v_timezone) = p_target_date
    )

  UNION ALL

  -- 2. ALL COMPLETED TASKS (anchored to completed_at date)
  SELECT
    t.id,
    t.title,
    'task'::text AS type,
    t.status::text,
    CASE
      WHEN t.is_urgent AND t.is_important THEN 'Do First'
      WHEN t.is_urgent AND NOT t.is_important THEN 'Delegate'
      WHEN NOT t.is_urgent AND t.is_important THEN 'Schedule'
      ELSE 'Eliminate'
    END AS priority,
    0::numeric AS points,
    t.completed_at,
    t.created_at,
    NULL::time AS start_time,
    FALSE AS is_all_day,
    t.parent_id,
    t.parent_type
  FROM "0008-ap-tasks" t
  WHERE t.user_id = v_user_id
    AND t.type = 'task'
    AND t.deleted_at IS NULL
    AND t.status = 'completed'
    AND t.completed_at IS NOT NULL
    AND date(t.completed_at AT TIME ZONE v_timezone) = p_target_date

  UNION ALL

  -- 3. ALL COMPLETED EVENTS (anchored to start_date, end_date, or completed_at)
  SELECT
    t.id,
    t.title,
    'event'::text AS type,
    t.status::text,
    'Schedule'::text AS priority,
    0::numeric AS points,
    t.completed_at,
    t.created_at,
    t.start_time,
    t.is_all_day,
    t.parent_id,
    t.parent_type
  FROM "0008-ap-tasks" t
  WHERE t.user_id = v_user_id
    AND t.type = 'event'
    AND t.deleted_at IS NULL
    AND t.status = 'completed'
    AND (
      t.start_date = p_target_date
      OR t.end_date = p_target_date
      OR (t.completed_at IS NOT NULL AND date(t.completed_at AT TIME ZONE v_timezone) = p_target_date)
    )

  UNION ALL

  -- 4. ALL DEPOSIT IDEAS (anchored to created_at date)
  SELECT
    di.id,
    di.title,
    'depositIdea'::text AS type,
    CASE
      WHEN di.archived THEN 'archived'
      WHEN di.is_active THEN 'active'
      ELSE 'pending'
    END AS status,
    'Idea'::text AS priority,
    0::numeric AS points,
    di.activated_at AS completed_at,
    di.created_at,
    NULL::time AS start_time,
    FALSE AS is_all_day,
    di.parent_id,
    di.parent_type
  FROM "0008-ap-deposit-ideas" di
  WHERE di.user_id = v_user_id
    AND di.archived = false
    AND date(di.created_at AT TIME ZONE v_timezone) = p_target_date

  UNION ALL

  -- 5. ALL WITHDRAWALS (anchored to withdrawn_at or created_at date)
  SELECT
    w.id,
    COALESCE(NULLIF(btrim(w.title), ''), 'Withdrawal') AS title,
    'withdrawal'::text AS type,
    'completed'::text AS status,
    'Normal'::text AS priority,
    0::numeric AS points,
    COALESCE(w.withdrawn_at, w.created_at) AS completed_at,
    w.created_at,
    NULL::time AS start_time,
    FALSE AS is_all_day,
    NULL::uuid AS parent_id,
    NULL::text AS parent_type
  FROM "0008-ap-withdrawals" w
  WHERE w.user_id = v_user_id
    AND date(COALESCE(w.withdrawn_at, w.created_at) AT TIME ZONE v_timezone) = p_target_date

  ORDER BY completed_at DESC NULLS LAST, created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_daily_history_items(date, uuid) TO authenticated;
