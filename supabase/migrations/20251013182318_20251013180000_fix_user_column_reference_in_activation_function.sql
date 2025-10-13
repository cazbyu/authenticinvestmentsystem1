/*
  # Fix Column Reference in Timeline Activation Function

  ## Summary
  Fixes a critical bug in fn_activate_user_global_timeline where the function
  references 0008-ap-users.user_id column which doesn't exist. The correct
  column name is 0008-ap-users.id (which is both the primary key and foreign
  key to auth.users).

  ## Changes Made

  1. **Fix SELECT Query (line 47-49)**
     - Changed: WHERE user_id = v_user_id
     - To: WHERE id = v_user_id

  2. **Fix UPDATE Query (line 107-109)**
     - Changed: WHERE user_id = v_user_id
     - To: WHERE id = v_user_id

  ## Schema Context
  - 0008-ap-users table structure:
    - id (uuid, PK, FK to auth.users.id)
    - NO user_id column exists
  - 0008-ap-user-global-timelines table structure:
    - id (uuid, PK)
    - user_id (uuid, FK to auth.users.id)

  ## Security
  - No security changes required
  - Function maintains SECURITY DEFINER
  - All authentication checks remain unchanged
*/

-- ============================================================
-- Fix fn_activate_user_global_timeline function
-- ============================================================
CREATE OR REPLACE FUNCTION fn_activate_user_global_timeline(
  p_global_cycle_id uuid,
  p_week_start_day text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_new_timeline_id uuid;
  v_existing_timeline_id uuid;
  v_cycle_exists boolean;
  v_user_preference text;
  v_final_preference text;
  v_can_activate boolean;
  v_cycle_title text;
  v_cycle_start_date date;
  v_cycle_end_date date;
  v_view_exists boolean;
  v_has_snapshot_columns boolean;
  v_has_user_preference_column boolean;
BEGIN
  -- Get authenticated user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Check if v_global_cycles view exists
  SELECT EXISTS(
    SELECT 1 FROM information_schema.views 
    WHERE table_schema = 'public' AND table_name = 'v_global_cycles'
  ) INTO v_view_exists;

  -- Check if snapshot columns exist
  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '0008-ap-user-global-timelines' 
      AND column_name IN ('title', 'start_date', 'end_date')
    GROUP BY table_name
    HAVING COUNT(*) = 3
  ) INTO v_has_snapshot_columns;

  -- Check if user preference column exists
  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '0008-ap-users' AND column_name = 'week_start_day'
  ) INTO v_has_user_preference_column;

  -- Get user's stored preference if column exists
  -- FIX: Changed from WHERE user_id = v_user_id to WHERE id = v_user_id
  IF v_has_user_preference_column THEN
    SELECT week_start_day INTO v_user_preference
    FROM "0008-ap-users"
    WHERE id = v_user_id;
  END IF;

  -- Use provided preference or fall back to user's stored preference or default
  v_final_preference := COALESCE(p_week_start_day, v_user_preference, 'sunday');

  -- Validate week_start_day
  IF v_final_preference NOT IN ('sunday', 'monday') THEN
    RAISE EXCEPTION 'Invalid week_start_day. Must be sunday or monday';
  END IF;

  -- Fetch cycle data
  SELECT 
    title,
    start_date,
    end_date
  INTO 
    v_cycle_title,
    v_cycle_start_date,
    v_cycle_end_date
  FROM "0008-ap-global-cycles"
  WHERE id = p_global_cycle_id
    AND (status = 'active' OR status IS NULL);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Global cycle not found or not active';
  END IF;

  v_cycle_exists := true;

  -- Check can_activate from view if it exists
  IF v_view_exists THEN
    SELECT COALESCE(can_activate, false)
    INTO v_can_activate
    FROM v_global_cycles
    WHERE global_cycle_id = p_global_cycle_id;
    
    IF NOT v_can_activate THEN
      RAISE EXCEPTION 'This global cycle cannot be activated yet. Only the current cycle and the next cycle (during reflection window) can be activated.';
    END IF;
  END IF;

  -- Check if user already has this exact cycle activated
  SELECT id INTO v_existing_timeline_id
  FROM "0008-ap-user-global-timelines"
  WHERE user_id = v_user_id
    AND global_cycle_id = p_global_cycle_id
    AND status = 'active';

  IF FOUND THEN
    RAISE EXCEPTION 'This global cycle is already activated';
  END IF;

  -- Save preference to user's profile if column exists and preference differs
  -- FIX: Changed from WHERE user_id = v_user_id to WHERE id = v_user_id
  IF v_has_user_preference_column AND p_week_start_day IS NOT NULL AND p_week_start_day != v_user_preference THEN
    UPDATE "0008-ap-users"
    SET week_start_day = v_final_preference
    WHERE id = v_user_id;

    RAISE NOTICE 'Updated user preference to: %', v_final_preference;
  END IF;

  -- Create new active timeline with conditional snapshot data
  IF v_has_snapshot_columns THEN
    INSERT INTO "0008-ap-user-global-timelines" (
      user_id,
      global_cycle_id,
      status,
      week_start_day,
      activated_at,
      title,
      start_date,
      end_date
    ) VALUES (
      v_user_id,
      p_global_cycle_id,
      'active',
      v_final_preference,
      now(),
      v_cycle_title,
      v_cycle_start_date,
      v_cycle_end_date
    )
    RETURNING id INTO v_new_timeline_id;
  ELSE
    INSERT INTO "0008-ap-user-global-timelines" (
      user_id,
      global_cycle_id,
      status,
      week_start_day,
      activated_at
    ) VALUES (
      v_user_id,
      p_global_cycle_id,
      'active',
      v_final_preference,
      now()
    )
    RETURNING id INTO v_new_timeline_id;
  END IF;

  -- Generate canonical weeks
  PERFORM generate_canonical_global_weeks(p_global_cycle_id);

  RAISE NOTICE 'Activated timeline % with week_start_day=%', v_new_timeline_id, v_final_preference;

  RETURN v_new_timeline_id;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_activate_user_global_timeline(uuid, text) TO authenticated;

COMMENT ON FUNCTION fn_activate_user_global_timeline(uuid, text) IS
  'Activates a global timeline for a user. Fixed to use correct column reference: 0008-ap-users.id (not user_id).';
