/*
  ============================================================================
  SUPABASE VIEW FIX SCRIPT
  ============================================================================
  
  Purpose: Fix view column naming conflicts and establish correct architecture
  
  Architecture Summary:
  - 0008-ap-global-cycles: Master cycle definitions (start_date, end_date)
  - 0008-ap-global-weeks: Canonical weeks pulled from cycles (12 weeks per cycle)
  - 0008-ap-user-global-timelines: User activations with week_start_day preference
  - Views: Join these tables to provide user-specific data with display preferences
  
  Safe to run multiple times (idempotent)
  ============================================================================
*/

-- =====================================================
-- STEP 1: Drop all dependent views (CASCADE handles dependencies)
-- =====================================================

DROP VIEW IF EXISTS v_unified_timeline_weeks CASCADE;
DROP VIEW IF EXISTS v_unified_timeline_days_left CASCADE;
DROP VIEW IF EXISTS v_user_global_timeline_weeks CASCADE;
DROP VIEW IF EXISTS v_user_global_timeline_days_left CASCADE;

-- =====================================================
-- STEP 2: Ensure 0008-ap-global-weeks table exists
-- =====================================================

CREATE TABLE IF NOT EXISTS "0008-ap-global-weeks" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  global_cycle_id uuid NOT NULL REFERENCES "0008-ap-global-cycles"(id) ON DELETE CASCADE,
  week_number integer NOT NULL,
  week_start date NOT NULL,
  week_end date NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT unique_global_cycle_week UNIQUE (global_cycle_id, week_number)
);

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_global_weeks_cycle_id 
  ON "0008-ap-global-weeks"(global_cycle_id);

CREATE INDEX IF NOT EXISTS idx_global_weeks_dates 
  ON "0008-ap-global-weeks"(week_start, week_end);

-- =====================================================
-- STEP 3: Enable RLS on global weeks table
-- =====================================================

ALTER TABLE "0008-ap-global-weeks" ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "gw_select_all" ON "0008-ap-global-weeks";
DROP POLICY IF EXISTS "gw_select_authenticated" ON "0008-ap-global-weeks";
DROP POLICY IF EXISTS "gw_insert_authenticated" ON "0008-ap-global-weeks";
DROP POLICY IF EXISTS "gw_update_authenticated" ON "0008-ap-global-weeks";
DROP POLICY IF EXISTS "gw_delete_authenticated" ON "0008-ap-global-weeks";
DROP POLICY IF EXISTS "gw_write_service_role" ON "0008-ap-global-weeks";

-- Recreate policies
CREATE POLICY "gw_select_authenticated"
  ON "0008-ap-global-weeks"
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "gw_insert_authenticated"
  ON "0008-ap-global-weeks"
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "gw_update_authenticated"
  ON "0008-ap-global-weeks"
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "gw_delete_authenticated"
  ON "0008-ap-global-weeks"
  FOR DELETE
  TO authenticated
  USING (true);

-- =====================================================
-- STEP 4: Create function to generate canonical weeks from cycles
-- =====================================================

CREATE OR REPLACE FUNCTION generate_canonical_global_weeks(
  p_global_cycle_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cycle_start_date date;
  v_cycle_end_date date;
  v_week_num integer;
  v_week_start date;
  v_week_end date;
BEGIN
  -- Get cycle dates from global_cycles table
  SELECT start_date, end_date
  INTO v_cycle_start_date, v_cycle_end_date
  FROM "0008-ap-global-cycles"
  WHERE id = p_global_cycle_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Global cycle not found: %', p_global_cycle_id;
  END IF;

  IF v_cycle_start_date IS NULL OR v_cycle_end_date IS NULL THEN
    RAISE EXCEPTION 'Global cycle % has null start_date or end_date', p_global_cycle_id;
  END IF;

  -- Delete existing weeks for this cycle
  DELETE FROM "0008-ap-global-weeks"
  WHERE global_cycle_id = p_global_cycle_id;

  -- Generate 12 canonical weeks based on cycle dates
  FOR v_week_num IN 1..12 LOOP
    v_week_start := (v_cycle_start_date + ((v_week_num - 1) * INTERVAL '7 days'))::date;
    v_week_end := (v_week_start + INTERVAL '6 days')::date;

    INSERT INTO "0008-ap-global-weeks" (
      global_cycle_id,
      week_number,
      week_start,
      week_end
    ) VALUES (
      p_global_cycle_id,
      v_week_num,
      v_week_start,
      v_week_end
    );
  END LOOP;

  RAISE NOTICE 'Generated 12 canonical weeks for global_cycle_id %', p_global_cycle_id;
END;
$$;

GRANT EXECUTE ON FUNCTION generate_canonical_global_weeks(uuid) TO authenticated;

COMMENT ON FUNCTION generate_canonical_global_weeks(uuid) IS
  'Generates 12 canonical weeks for a global cycle. Weeks are pulled directly from cycle start_date and end_date. User week_start_day preference is stored separately in user_global_timelines.';

-- =====================================================
-- STEP 5: Populate weeks for all existing cycles
-- =====================================================

DO $$
DECLARE
  cycle_rec RECORD;
BEGIN
  FOR cycle_rec IN
    SELECT id, title, start_date, end_date
    FROM "0008-ap-global-cycles"
    WHERE start_date IS NOT NULL AND end_date IS NOT NULL
  LOOP
    BEGIN
      PERFORM generate_canonical_global_weeks(cycle_rec.id);
      RAISE NOTICE 'Generated weeks for cycle: % (% to %)',
        cycle_rec.title,
        cycle_rec.start_date,
        cycle_rec.end_date;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to generate weeks for cycle %: %', cycle_rec.id, SQLERRM;
    END;
  END LOOP;
END $$;

-- =====================================================
-- STEP 6: Create v_user_global_timeline_weeks view
-- =====================================================

CREATE OR REPLACE VIEW v_user_global_timeline_weeks AS
SELECT
  ugt.id AS timeline_id,
  ugt.user_id,
  ugt.week_start_day,
  gw.week_number,
  gw.week_start,
  gw.week_end,
  'global'::text AS source
FROM "0008-ap-user-global-timelines" ugt
JOIN "0008-ap-global-cycles" gc ON ugt.global_cycle_id = gc.id
JOIN "0008-ap-global-weeks" gw ON gw.global_cycle_id = gc.id
WHERE ugt.status = 'active';

GRANT SELECT ON v_user_global_timeline_weeks TO authenticated;

COMMENT ON VIEW v_user_global_timeline_weeks IS
  'Returns canonical week boundaries for each active user global timeline. Week dates are pulled from global_cycles. User week_start_day preference is included as display metadata for frontend.';

-- =====================================================
-- STEP 7: Create v_user_global_timeline_days_left view
-- =====================================================

CREATE OR REPLACE VIEW v_user_global_timeline_days_left AS
SELECT 
  ugt.id AS timeline_id,
  ugt.user_id,
  GREATEST(0, (gc.end_date - CURRENT_DATE)::integer) AS days_left,
  CASE 
    WHEN gc.end_date <= gc.start_date THEN 100
    ELSE LEAST(100, GREATEST(0, 
      ((CURRENT_DATE - gc.start_date)::numeric / (gc.end_date - gc.start_date)::numeric) * 100
    ))
  END AS pct_elapsed,
  'global'::text AS source
FROM "0008-ap-user-global-timelines" ugt
JOIN "0008-ap-global-cycles" gc ON ugt.global_cycle_id = gc.id
WHERE ugt.status = 'active';

GRANT SELECT ON v_user_global_timeline_days_left TO authenticated;

COMMENT ON VIEW v_user_global_timeline_days_left IS
  'Returns days remaining for each active user global timeline. Calculated from global_cycles dates.';

-- =====================================================
-- STEP 8: Create unified views (if custom timelines exist)
-- =====================================================

CREATE OR REPLACE VIEW v_unified_timeline_weeks AS
SELECT 
  timeline_id,
  user_id,
  week_start_day,
  week_number,
  week_start,
  week_end,
  source
FROM v_user_global_timeline_weeks;

GRANT SELECT ON v_unified_timeline_weeks TO authenticated;

COMMENT ON VIEW v_unified_timeline_weeks IS
  'Unified view of all timeline weeks. Currently includes global timelines only. Custom timelines can be added via UNION ALL when ready.';

CREATE OR REPLACE VIEW v_unified_timeline_days_left AS
SELECT 
  timeline_id,
  user_id,
  days_left,
  pct_elapsed,
  source
FROM v_user_global_timeline_days_left;

GRANT SELECT ON v_unified_timeline_days_left TO authenticated;

COMMENT ON VIEW v_unified_timeline_days_left IS
  'Unified view of days remaining for all active timelines.';

-- =====================================================
-- STEP 9: Update activation function to generate weeks
-- =====================================================

CREATE OR REPLACE FUNCTION fn_activate_user_global_timeline(
  p_global_cycle_id uuid,
  p_week_start_day text DEFAULT 'sunday'
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
BEGIN
  -- Get authenticated user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Validate week_start_day
  IF p_week_start_day NOT IN ('sunday', 'monday') THEN
    RAISE EXCEPTION 'Invalid week_start_day. Must be sunday or monday';
  END IF;

  -- Verify global cycle exists and is active
  SELECT EXISTS(
    SELECT 1 FROM "0008-ap-global-cycles"
    WHERE id = p_global_cycle_id
      AND (is_active = true OR is_active IS NULL)
  ) INTO v_cycle_exists;

  IF NOT v_cycle_exists THEN
    RAISE EXCEPTION 'Global cycle not found or not active';
  END IF;

  -- Check if user already has this cycle activated
  SELECT id INTO v_existing_timeline_id
  FROM "0008-ap-user-global-timelines"
  WHERE user_id = v_user_id
    AND global_cycle_id = p_global_cycle_id
    AND status = 'active';

  IF FOUND THEN
    RAISE EXCEPTION 'This global cycle is already activated';
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
    p_week_start_day,
    now()
  )
  RETURNING id INTO v_new_timeline_id;

  -- Ensure canonical weeks exist for this cycle (idempotent)
  PERFORM generate_canonical_global_weeks(p_global_cycle_id);

  RETURN v_new_timeline_id;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_activate_user_global_timeline(uuid, text) TO authenticated;

COMMENT ON FUNCTION fn_activate_user_global_timeline(uuid, text) IS
  'Activates a global timeline for a user with specified week_start_day preference (sunday or monday). Ensures canonical weeks are generated from the cycle.';

-- =====================================================
-- STEP 10: Verification queries
-- =====================================================

DO $$
DECLARE
  v_cycle_count integer;
  v_week_count integer;
  v_timeline_count integer;
BEGIN
  SELECT COUNT(*) INTO v_cycle_count FROM "0008-ap-global-cycles";
  SELECT COUNT(*) INTO v_week_count FROM "0008-ap-global-weeks";
  SELECT COUNT(*) INTO v_timeline_count FROM "0008-ap-user-global-timelines" WHERE status = 'active';

  RAISE NOTICE '============================================';
  RAISE NOTICE 'VERIFICATION RESULTS:';
  RAISE NOTICE '  Global Cycles: %', v_cycle_count;
  RAISE NOTICE '  Week Records: %', v_week_count;
  RAISE NOTICE '  Expected: % (12 weeks per cycle)', v_cycle_count * 12;
  RAISE NOTICE '  Active User Timelines: %', v_timeline_count;
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Views created successfully:';
  RAISE NOTICE '  - v_user_global_timeline_weeks';
  RAISE NOTICE '  - v_user_global_timeline_days_left';
  RAISE NOTICE '  - v_unified_timeline_weeks';
  RAISE NOTICE '  - v_unified_timeline_days_left';
  RAISE NOTICE '============================================';
END $$;
