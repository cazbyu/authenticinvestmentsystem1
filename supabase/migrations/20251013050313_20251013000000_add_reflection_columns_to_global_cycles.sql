/*
  # Add Reflection Columns to Global Cycles

  ## Summary
  Adds reflection_start and reflection_end columns to the global cycles table.
  These columns define the reflection/planning window at the end of each 12-week cycle.

  ## Changes Made
  1. Add reflection_start date column
  2. Add reflection_end date column
  3. Update existing cycles with calculated reflection dates
     - reflection_start = end_date - 6 days (last week starts)
     - reflection_end = end_date (last day of cycle)

  ## Security
  - No RLS changes needed
*/

-- Add reflection columns if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '0008-ap-global-cycles' AND column_name = 'reflection_start'
  ) THEN
    ALTER TABLE "0008-ap-global-cycles"
    ADD COLUMN reflection_start date;
    
    RAISE NOTICE 'Added reflection_start column to 0008-ap-global-cycles';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '0008-ap-global-cycles' AND column_name = 'reflection_end'
  ) THEN
    ALTER TABLE "0008-ap-global-cycles"
    ADD COLUMN reflection_end date;
    
    RAISE NOTICE 'Added reflection_end column to 0008-ap-global-cycles';
  END IF;
END $$;

-- Update existing cycles with reflection dates
-- The last week (week 13) is the reflection week
-- reflection_start = end_date - 6 days (start of last week)
-- reflection_end = end_date (end of cycle)
UPDATE "0008-ap-global-cycles"
SET 
  reflection_start = end_date - INTERVAL '6 days',
  reflection_end = end_date
WHERE reflection_start IS NULL OR reflection_end IS NULL;

COMMENT ON COLUMN "0008-ap-global-cycles".reflection_start IS 
  'Start date of the reflection week (last week of the 12-week cycle)';

COMMENT ON COLUMN "0008-ap-global-cycles".reflection_end IS 
  'End date of the reflection week (same as cycle end_date)';
