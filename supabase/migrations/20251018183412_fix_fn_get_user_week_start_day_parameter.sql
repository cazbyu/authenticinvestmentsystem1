/*
  # Fix fn_get_user_week_start_day Function Parameter
  
  1. Problem
    - Function is querying for `user_id` column which doesn't exist
    - The correct column name is `id` in the 0008-ap-users table
  
  2. Solution
    - Update the function to use the correct column name `id`
    - This will fix the "column user_id does not exist" error
*/

-- Fix the function to use correct column name
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
  WHERE id = p_user_id;  -- Changed from user_id to id

  -- Default to 'sunday' if not found
  RETURN COALESCE(v_week_start_day, 'sunday');
END;
$$;

COMMENT ON FUNCTION fn_get_user_week_start_day(uuid) IS 
'Returns the user''s preferred week start day (sunday or monday). Defaults to sunday if not set.';
