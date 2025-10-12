/*
  ============================================================================
  CHECK WHAT FRONTEND SEES
  ============================================================================
  This simulates the exact query your frontend is running
  ============================================================================
*/

-- What the frontend sees when fetching available cycles
SELECT 
  '=== AVAILABLE CYCLES (as seen by frontend) ===' AS info,
  id, 
  title, 
  cycle_label, 
  start_date, 
  end_date, 
  reflection_end, 
  is_active, 
  status
FROM "0008-ap-global-cycles"
WHERE status = 'active'  -- Frontend checks this
  AND reflection_end >= CURRENT_DATE
ORDER BY start_date;

-- Also check using is_active instead of status
SELECT 
  '=== AVAILABLE CYCLES (using is_active) ===' AS info,
  id, 
  title, 
  cycle_label, 
  start_date, 
  end_date, 
  reflection_end, 
  is_active
FROM "0008-ap-global-cycles"
WHERE is_active = true
ORDER BY start_date;

-- Check if status column exists
SELECT 
  '=== DOES STATUS COLUMN EXIST? ===' AS info,
  EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '0008-ap-global-cycles'
    AND column_name = 'status'
  ) AS status_column_exists;
