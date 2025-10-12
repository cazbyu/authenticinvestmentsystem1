/*
  ============================================================================
  EMERGENCY TEST - Quick Check
  ============================================================================
  Run this to quickly test if activation will work
  ============================================================================
*/

-- Step 1: See if you're logged in
SELECT 
  '=== YOU ARE ===' AS info,
  auth.uid() AS your_user_id,
  auth.role() AS your_role;

-- Step 2: See available cycles
SELECT 
  '=== AVAILABLE CYCLES ===' AS info,
  id AS cycle_id,
  title,
  start_date,
  end_date,
  is_active
FROM "0008-ap-global-cycles"
WHERE is_active = true;

-- Step 3: Check user_global_timelines table structure
SELECT 
  '=== WHAT COLUMNS EXIST ===' AS info,
  column_name
FROM information_schema.columns
WHERE table_name = '0008-ap-user-global-timelines'
ORDER BY ordinal_position;

-- Step 4: Try a direct insert (REPLACE THE CYCLE_ID)
-- This will tell us exactly what's wrong
-- Uncomment the next block and replace <CYCLE_ID> with a real ID from step 2

/*
INSERT INTO "0008-ap-user-global-timelines" (
  user_id,
  global_cycle_id,
  status,
  week_start_day
)
SELECT
  auth.uid(),
  '<CYCLE_ID>'::uuid,  -- REPLACE THIS
  'active',
  'monday'
WHERE NOT EXISTS (
  SELECT 1 FROM "0008-ap-user-global-timelines"
  WHERE user_id = auth.uid()
    AND global_cycle_id = '<CYCLE_ID>'::uuid  -- REPLACE THIS
    AND status = 'active'
);
*/

-- Step 5: Check if it worked
SELECT 
  '=== YOUR TIMELINES ===' AS info,
  id,
  global_cycle_id,
  status,
  week_start_day,
  created_at
FROM "0008-ap-user-global-timelines"
WHERE user_id = auth.uid()
ORDER BY created_at DESC;
