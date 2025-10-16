/*
  # Fix Scoped Authentic Deposit Counting Function

  1. **Issue**
     - The `fn_count_scoped_authentic_deposits` function was joining with wrong table names
     - Used `0008-ap-universal-roles` instead of `0008-ap-universal-roles-join`
     - Used `0008-ap-universal-domains` instead of `0008-ap-universal-domains-join`

  2. **Fix**
     - Update function to use correct join table names
     - Fix the joins to use `parent_id` and `parent_type` columns correctly
*/

-- Drop and recreate the function with correct table names
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
    INNER JOIN "0008-ap-universal-roles-join" urj 
      ON urj.parent_id = t.id 
      AND urj.parent_type = 'task'
    WHERE t.user_id = p_user_id
      AND t.is_authentic_deposit = true
      AND t.status = 'completed'
      AND t.completed_at >= p_week_start
      AND t.completed_at < p_week_end
      AND urj.role_id = p_scope_id;

  ELSIF p_scope_type = 'domain' THEN
    SELECT COUNT(DISTINCT t.id)::integer INTO v_count
    FROM "0008-ap-tasks" t
    INNER JOIN "0008-ap-universal-domains-join" udj 
      ON udj.parent_id = t.id 
      AND udj.parent_type = 'task'
    WHERE t.user_id = p_user_id
      AND t.is_authentic_deposit = true
      AND t.status = 'completed'
      AND t.completed_at >= p_week_start
      AND t.completed_at < p_week_end
      AND udj.domain_id = p_scope_id;

  ELSIF p_scope_type = 'key_relationship' THEN
    SELECT COUNT(DISTINCT t.id)::integer INTO v_count
    FROM "0008-ap-tasks" t
    INNER JOIN "0008-ap-universal-key-relationships-join" ukrj 
      ON ukrj.parent_id = t.id 
      AND ukrj.parent_type = 'task'
    WHERE t.user_id = p_user_id
      AND t.is_authentic_deposit = true
      AND t.status = 'completed'
      AND t.completed_at >= p_week_start
      AND t.completed_at < p_week_end
      AND ukrj.key_relationship_id = p_scope_id;
  END IF;

  RETURN COALESCE(v_count, 0);
END;
$$;

-- Ensure permissions are still granted
GRANT EXECUTE ON FUNCTION fn_count_scoped_authentic_deposits(uuid, timestamptz, timestamptz, text, uuid) TO authenticated;
