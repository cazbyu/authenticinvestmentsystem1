/*
  # Update Theme Color System

  1. Schema Changes
     - Rename `primary_color` to `theme_color` in `0008-ap-users` table
     - Remove `accent_color` column from `0008-ap-users` table
     - Preserve existing primary_color values as theme_color

  2. Data Migration
     - Copy all primary_color values to theme_color
     - Drop accent_color column

  3. Important Notes
     - This consolidates the dual-color system into a single theme color
     - Users will have one theme color that controls headers, buttons, and primary UI elements
     - Role colors remain independent and customizable per role
*/

-- Add the new theme_color column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '0008-ap-users' AND column_name = 'theme_color'
  ) THEN
    ALTER TABLE "0008-ap-users" ADD COLUMN theme_color text DEFAULT '#0078d4';
  END IF;
END $$;

-- Copy existing primary_color values to theme_color
UPDATE "0008-ap-users"
SET theme_color = COALESCE(primary_color, '#0078d4')
WHERE theme_color IS NULL OR theme_color = '#0078d4';

-- Drop the primary_color column if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '0008-ap-users' AND column_name = 'primary_color'
  ) THEN
    ALTER TABLE "0008-ap-users" DROP COLUMN primary_color;
  END IF;
END $$;

-- Drop the accent_color column if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '0008-ap-users' AND column_name = 'accent_color'
  ) THEN
    ALTER TABLE "0008-ap-users" DROP COLUMN accent_color;
  END IF;
END $$;
