/*
  # Add Snapshot Columns to User Global Timelines

  ## Summary
  Adds title, start_date, and end_date columns to 0008-ap-user-global-timelines to store
  a snapshot of the global cycle data at the time of activation. This ensures users have
  a historical record of their activated timelines even if the source global cycle data changes.

  ## Changes Made

  1. **Add Snapshot Columns**
     - `title` (TEXT): Copy of the global cycle title at activation time
     - `start_date` (DATE): Copy of the global cycle start_date at activation time
     - `end_date` (DATE): Copy of the global cycle end_date at activation time
     - All columns are nullable to accommodate any potential edge cases

  2. **Update Activation Function**
     - Modify fn_activate_user_global_timeline to copy title, start_date, end_date from 0008-ap-global-cycles
     - Maintain existing can_activate validation from v_global_cycles view
     - Preserve week_start_day preference handling from 0008-ap-users
     - Keep duplicate prevention and all existing validation logic

  ## Security
  - RLS policies remain unchanged
  - Function maintains SECURITY DEFINER with proper authentication checks
  - Can_activate validation ensures only eligible cycles can be activated

  ## Notes
  - Columns store snapshots at activation time, not live references
  - The created_at column automatically captures the activation timestamp
  - Week_start_day preference is read from 0008-ap-users and can be overridden
*/

-- ============================================================
-- 1. Add snapshot columns to user global timelines table
-- ============================================================
DO $$
BEGIN
  -- Add title column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '0008-ap-user-global-timelines' AND column_name = 'title'
  ) THEN
    ALTER TABLE "0008-ap-user-global-timelines"
    ADD COLUMN title TEXT;
    
    RAISE NOTICE 'Added title column to 0008-ap-user-global-timelines';
  END IF;

  -- Add start_date column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '0008-ap-user-global-timelines' AND column_name = 'start_date'
  ) THEN
    ALTER TABLE "0008-ap-user-global-timelines"
    ADD COLUMN start_date DATE;
    
    RAISE NOTICE 'Added start_date column to 0008-ap-user-global-timelines';
  END IF;

  -- Add end_date column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '0008-ap-user-global-timelines' AND column_name = 'end_date'
  ) THEN
    ALTER TABLE "0008-ap-user-global-timelines"
    ADD COLUMN end_date DATE;
    
    RAISE NOTICE 'Added end_date column to 0008-ap-user-global-timelines';
  END IF;
END $$;

-- ============================================================
-- 2. Update fn_activate_user_global_timeline function
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
BEGIN
  -- Get authenticated user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Get user's stored preference
  SELECT week_start_day INTO v_user_preference
  FROM "0008-ap-users"
  WHERE id = v_user_id;

  -- Use provided preference or fall back to user's stored preference
  v_final_preference := COALESCE(p_week_start_day, v_user_preference, 'sunday');

  -- Validate week_start_day
  IF v_final_preference NOT IN ('sunday', 'monday') THEN
    RAISE EXCEPTION 'Invalid week_start_day. Must be sunday or monday';
  END IF;

  -- Verify global cycle exists, is active, and can be activated
  -- Also retrieve title, start_date, and end_date for snapshot
  SELECT
    EXISTS(SELECT 1 FROM "0008-ap-global-cycles" WHERE id = p_global_cycle_id AND (status = 'active' OR status IS NULL)),
    COALESCE((SELECT can_activate FROM v_global_cycles WHERE global_cycle_id = p_global_cycle_id), FALSE),
    (SELECT title FROM "0008-ap-global-cycles" WHERE id = p_global_cycle_id),
    (SELECT start_date FROM "0008-ap-global-cycles" WHERE id = p_global_cycle_id),
    (SELECT end_date FROM "0008-ap-global-cycles" WHERE id = p_global_cycle_id)
  INTO v_cycle_exists, v_can_activate, v_cycle_title, v_cycle_start_date, v_cycle_end_date;

  IF NOT v_cycle_exists THEN
    RAISE EXCEPTION 'Global cycle not found or not active';
  END IF;

  IF NOT v_can_activate THEN
    RAISE EXCEPTION 'This global cycle cannot be activated yet. Only the current cycle and the next cycle (during reflection window) can be activated.';
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

  -- Save preference to user's profile if it was provided or differs from stored
  IF p_week_start_day IS NOT NULL AND p_week_start_day != v_user_preference THEN
    UPDATE "0008-ap-users"
    SET week_start_day = v_final_preference
    WHERE id = v_user_id;

    RAISE NOTICE 'Updated user preference to: %', v_final_preference;
  END IF;

  -- Create new active timeline with snapshot data
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

  -- Generate adjusted weeks based on the user's week_start_day preference
  PERFORM generate_adjusted_global_weeks(v_new_timeline_id);

  RAISE NOTICE 'Activated timeline % with week_start_day=% and copied title=%, start_date=%, end_date=%', 
    v_new_timeline_id, v_final_preference, v_cycle_title, v_cycle_start_date, v_cycle_end_date;

  RETURN v_new_timeline_id;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_activate_user_global_timeline(uuid, text) TO authenticated;

COMMENT ON FUNCTION fn_activate_user_global_timeline(uuid, text) IS
  'Activates a global timeline for a user with snapshot data. Copies title, start_date, end_date from global cycle. Reads week_start_day preference from user profile or accepts override. Only allows activation when can_activate is TRUE in v_global_cycles view.';

-- ============================================================
-- END MIGRATION
-- ============================================================
