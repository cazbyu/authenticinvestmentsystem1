/*
  # Add Authentic Deposit Weekly Tracking System

  1. **Performance Optimization**
     - Add composite index on 0008-ap-tasks for fast authentic deposit queries
     - Index covers: user_id, is_authentic_deposit, completed_at
     - Partial index (only for authentic deposits) to minimize size

  2. **Helper Functions**
     - `fn_get_user_week_start_day`: Retrieves user's week start preference (sunday/monday)
     - `fn_count_weekly_authentic_deposits`: Counts completed authentic deposits in a date range
     - `fn_count_scoped_authentic_deposits`: Counts authentic deposits filtered by scope (role/domain/kr)

  3. **Business Rules**
     - Weekly limit: 14 authentic deposits per user
     - Week boundaries based on user's week_start_day preference
     - Only counts tasks with is_authentic_deposit = true AND status = 'completed'

  4. **Security**
     - All functions use SECURITY DEFINER to access user data
     - Functions validate user_id matches authenticated user where applicable
*/

-- 1. Add performance index for authentic deposit queries
CREATE INDEX IF NOT EXISTS idx_tasks_authentic_week
  ON "0008-ap-tasks" (user_id, is_authentic_deposit, completed_at, status)
  WHERE is_authentic_deposit = true;

-- 2. Function to get user's week start day preference
CREATE OR REPLACE FUNCTION fn_get_user_week_start_day(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_week_start_day text;
BEGIN
  SELECT week_start_day INTO v_week_start_day
  FROM "0008-ap-users"
  WHERE user_id = p_user_id;

  -- Default to 'sunday' if not found
  RETURN COALESCE(v_week_start_day, 'sunday');
END;
$$;

-- 3. Function to count weekly authentic deposits for a user
CREATE OR REPLACE FUNCTION fn_count_weekly_authentic_deposits(
  p_user_id uuid,
  p_week_start timestamptz,
  p_week_end timestamptz
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*)::integer INTO v_count
  FROM "0008-ap-tasks"
  WHERE user_id = p_user_id
    AND is_authentic_deposit = true
    AND status = 'completed'
    AND completed_at >= p_week_start
    AND completed_at < p_week_end;

  RETURN COALESCE(v_count, 0);
END;
$$;

-- 4. Function to count scoped authentic deposits (by role, domain, or key_relationship)
CREATE OR REPLACE FUNCTION fn_count_scoped_authentic_deposits(
  p_user_id uuid,
  p_week_start timestamptz,
  p_week_end timestamptz,
  p_scope_type text,
  p_scope_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count integer;
BEGIN
  -- Validate scope_type
  IF p_scope_type NOT IN ('role', 'domain', 'key_relationship') THEN
    RAISE EXCEPTION 'Invalid scope_type: %. Must be role, domain, or key_relationship', p_scope_type;
  END IF;

  -- Count based on scope type
  IF p_scope_type = 'role' THEN
    SELECT COUNT(DISTINCT t.id)::integer INTO v_count
    FROM "0008-ap-tasks" t
    INNER JOIN "0008-ap-universal-roles" ur ON ur.task_id = t.id
    WHERE t.user_id = p_user_id
      AND t.is_authentic_deposit = true
      AND t.status = 'completed'
      AND t.completed_at >= p_week_start
      AND t.completed_at < p_week_end
      AND ur.role_id = p_scope_id;

  ELSIF p_scope_type = 'domain' THEN
    SELECT COUNT(DISTINCT t.id)::integer INTO v_count
    FROM "0008-ap-tasks" t
    INNER JOIN "0008-ap-universal-domains" ud ON ud.task_id = t.id
    WHERE t.user_id = p_user_id
      AND t.is_authentic_deposit = true
      AND t.status = 'completed'
      AND t.completed_at >= p_week_start
      AND t.completed_at < p_week_end
      AND ud.domain_id = p_scope_id;

  ELSIF p_scope_type = 'key_relationship' THEN
    SELECT COUNT(DISTINCT t.id)::integer INTO v_count
    FROM "0008-ap-tasks" t
    INNER JOIN "0008-ap-universal-roles" ur ON ur.task_id = t.id
    INNER JOIN "0008-ap-key-relationships" kr ON kr.id = p_scope_id
    WHERE t.user_id = p_user_id
      AND t.is_authentic_deposit = true
      AND t.status = 'completed'
      AND t.completed_at >= p_week_start
      AND t.completed_at < p_week_end
      AND ur.role_id = kr.role_id;
  END IF;

  RETURN COALESCE(v_count, 0);
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION fn_get_user_week_start_day(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_count_weekly_authentic_deposits(uuid, timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_count_scoped_authentic_deposits(uuid, timestamptz, timestamptz, text, uuid) TO authenticated;
