/*
  # Implement Dynamic Global Cycles View and Remove is_active Column

  ## Summary
  This migration removes the `is_active` column from `0008-ap-global-cycles` and creates
  a dynamic view `v_global_cycles` that calculates timeline status based on dates.
  It also ensures week_start_day preference is stored in the users table and migrates
  existing preferences.

  ## Changes Made

  1. **Drop Triggers and is_active Column**
     - Remove triggers that managed the is_active column
     - Drop the is_active column from 0008-ap-global-cycles table

  2. **Add week_start_day to Users Table**
     - Add week_start_day column to 0008-ap-users if not exists
     - Default value is 'sunday'
     - Includes check constraint for valid values

  3. **Migrate Existing Preferences**
     - Copy most recent week_start_day from user-global-timelines to users table
     - Ensures existing user preferences are preserved

  4. **Create v_global_cycles View**
     - Dynamically calculates cycle_position (active, 2nd_in_line, 3rd_in_line, 4th_in_line, archived, future)
     - Determines can_activate flag based on reflection windows
     - Only 'active' and '2nd_in_line' positions can be activated
     - 2nd_in_line requires current date >= previous timeline's reflection_start

  5. **Update Activation Function**
     - fn_activate_user_global_timeline now reads user's preference from 0008-ap-users
     - Saves any override back to users table for future activations
     - Maintains per-timeline tracking in user-global-timelines for history

  ## Security
  - All functions use SECURITY DEFINER with proper authentication checks
  - RLS policies remain unchanged and secure
*/

-- ============================================================
-- 1. Drop dependent triggers to safely remove is_active
-- ============================================================
DROP TRIGGER IF EXISTS trg_auto_set_is_active ON "0008-ap-global-cycles" CASCADE;
DROP TRIGGER IF EXISTS trg_log_is_active_flip ON "0008-ap-global-cycles" CASCADE;

-- ============================================================
-- 2. Add status column if it doesn't exist
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '0008-ap-global-cycles' AND column_name = 'status'
  ) THEN
    ALTER TABLE "0008-ap-global-cycles"
    ADD COLUMN status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived'));

    RAISE NOTICE 'Added status column to 0008-ap-global-cycles';
  END IF;
END $$;

-- ============================================================
-- 3. Remove week_start_day and is_active columns from global cycles
-- ============================================================
ALTER TABLE "0008-ap-global-cycles" DROP COLUMN IF EXISTS week_start_day;
ALTER TABLE "0008-ap-global-cycles" DROP COLUMN IF EXISTS is_active;

-- ============================================================
-- 4. Add week_start_day column to users table
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '0008-ap-users' AND column_name = 'week_start_day'
  ) THEN
    ALTER TABLE "0008-ap-users"
    ADD COLUMN week_start_day TEXT NOT NULL DEFAULT 'sunday';

    ALTER TABLE "0008-ap-users"
    ADD CONSTRAINT chk_week_start_day CHECK (week_start_day IN ('sunday', 'monday'));

    RAISE NOTICE 'Added week_start_day column to 0008-ap-users';
  ELSE
    RAISE NOTICE 'week_start_day column already exists in 0008-ap-users';
  END IF;
END $$;

-- ============================================================
-- 5. Migrate existing week_start_day preferences to users table
-- ============================================================
DO $$
DECLARE
  user_rec RECORD;
  latest_preference TEXT;
BEGIN
  FOR user_rec IN
    SELECT DISTINCT user_id
    FROM "0008-ap-user-global-timelines"
    WHERE status = 'active'
  LOOP
    -- Get the most recent week_start_day preference for this user
    SELECT week_start_day INTO latest_preference
    FROM "0008-ap-user-global-timelines"
    WHERE user_id = user_rec.user_id
      AND week_start_day IS NOT NULL
    ORDER BY activated_at DESC NULLS LAST, created_at DESC
    LIMIT 1;

    IF latest_preference IS NOT NULL THEN
      UPDATE "0008-ap-users"
      SET week_start_day = latest_preference
      WHERE id = user_rec.user_id;

      RAISE NOTICE 'Migrated preference for user %: %', user_rec.user_id, latest_preference;
    END IF;
  END LOOP;
END $$;

-- ============================================================
-- 6. Create v_global_cycles view
-- ============================================================
DROP VIEW IF EXISTS v_global_cycles CASCADE;

CREATE OR REPLACE VIEW v_global_cycles AS
WITH ordered_cycles AS (
  SELECT
    gc.id AS global_cycle_id,
    gc.title,
    gc.description,
    gc.start_date,
    gc.end_date,
    gc.reflection_start,
    gc.reflection_end,
    COALESCE(gc.status, 'active') AS status,
    gc.created_at,
    ROW_NUMBER() OVER (ORDER BY gc.start_date) AS row_num
  FROM "0008-ap-global-cycles" AS gc
  WHERE COALESCE(gc.status, 'active') = 'active'
),
current_cycle AS (
  SELECT row_num
  FROM ordered_cycles
  WHERE CURRENT_DATE BETWEEN start_date AND reflection_end
  LIMIT 1
)
SELECT
  oc.global_cycle_id,
  oc.title,
  oc.description,
  oc.start_date,
  oc.end_date,
  oc.reflection_start,
  oc.reflection_end,
  oc.status,
  oc.created_at,

  -- Determine cycle position
  CASE
    WHEN CURRENT_DATE BETWEEN oc.start_date AND oc.reflection_end THEN 'active'
    WHEN oc.row_num < COALESCE((SELECT row_num FROM current_cycle), 0) THEN 'archived'
    WHEN oc.row_num = COALESCE((SELECT row_num FROM current_cycle), 0) + 1 THEN '2nd_in_line'
    WHEN oc.row_num = COALESCE((SELECT row_num FROM current_cycle), 0) + 2 THEN '3rd_in_line'
    WHEN oc.row_num = COALESCE((SELECT row_num FROM current_cycle), 0) + 3 THEN '4th_in_line'
    ELSE 'future'
  END AS cycle_position,

  -- Determine if can activate
  -- Only 'active' and '2nd_in_line' can be activated
  -- '2nd_in_line' requires current date >= active timeline's reflection_start
  CASE
    -- Current active timeline can always be activated
    WHEN CURRENT_DATE BETWEEN oc.start_date AND oc.reflection_end THEN TRUE

    -- 2nd in line can be activated if we're in the reflection window of the previous (active) timeline
    WHEN oc.row_num = COALESCE((SELECT row_num FROM current_cycle), 0) + 1 THEN
      CASE
        WHEN CURRENT_DATE >= (
          SELECT reflection_start
          FROM ordered_cycles prev
          WHERE prev.row_num = COALESCE((SELECT row_num FROM current_cycle), 0)
        ) THEN TRUE
        ELSE FALSE
      END

    -- All other positions (3rd, 4th, archived, future) cannot be activated
    ELSE FALSE
  END AS can_activate

FROM ordered_cycles AS oc
ORDER BY oc.start_date;

COMMENT ON VIEW v_global_cycles IS
  'Dynamic view that calculates global cycle positions and activation eligibility based on dates. Only active and 2nd_in_line cycles can be activated.';

-- ============================================================
-- 7. Update fn_activate_user_global_timeline function
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
  SELECT
    EXISTS(SELECT 1 FROM "0008-ap-global-cycles" WHERE id = p_global_cycle_id AND (status = 'active' OR status IS NULL)),
    COALESCE((SELECT can_activate FROM v_global_cycles WHERE global_cycle_id = p_global_cycle_id), FALSE)
  INTO v_cycle_exists, v_can_activate;

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

  -- Create new active timeline
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

  -- Generate adjusted weeks based on the user's week_start_day preference
  PERFORM generate_adjusted_global_weeks(v_new_timeline_id);

  RAISE NOTICE 'Activated timeline % with week_start_day=%', v_new_timeline_id, v_final_preference;

  RETURN v_new_timeline_id;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_activate_user_global_timeline(uuid, text) TO authenticated;

COMMENT ON FUNCTION fn_activate_user_global_timeline(uuid, text) IS
  'Activates a global timeline for a user. Reads week_start_day preference from user profile or accepts override. Only allows activation of current or next cycle during reflection window.';

-- ============================================================
-- END MIGRATION
-- ============================================================
