/*
  # Fix reflections constraint and add wellness zone columns

  1. Constraint Fix
    - Drop and recreate `check_weekly_dates` on `0008-ap-reflections`
    - New constraint allows reflection_type values other than 'daily' and 'weekly'
      to have optional week_start_date and week_end_date
    - 'daily' still requires NULL week dates
    - 'weekly' still requires both week dates to be non-null

  2. New Columns on `0008-ap-user-wellness-zones`
    - `dream` (text, nullable) - parallels the `dream` column on `0008-ap-roles`
    - `purpose` (text, nullable) - parallels the `purpose` column on `0008-ap-roles`

  3. Important Notes
    - No data is dropped or deleted
    - Existing rows are unaffected by the constraint change
    - New columns default to NULL
*/

-- 1. Fix the check_weekly_dates constraint
ALTER TABLE "0008-ap-reflections" DROP CONSTRAINT IF EXISTS check_weekly_dates;

ALTER TABLE "0008-ap-reflections" ADD CONSTRAINT check_weekly_dates CHECK (
  (reflection_type = 'daily' AND week_start_date IS NULL AND week_end_date IS NULL)
  OR (reflection_type = 'weekly' AND week_start_date IS NOT NULL AND week_end_date IS NOT NULL)
  OR (reflection_type NOT IN ('daily', 'weekly'))
);

-- 2. Add dream and purpose columns to user-wellness-zones
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '0008-ap-user-wellness-zones' AND column_name = 'dream'
  ) THEN
    ALTER TABLE "0008-ap-user-wellness-zones" ADD COLUMN dream text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '0008-ap-user-wellness-zones' AND column_name = 'purpose'
  ) THEN
    ALTER TABLE "0008-ap-user-wellness-zones" ADD COLUMN purpose text;
  END IF;
END $$;
