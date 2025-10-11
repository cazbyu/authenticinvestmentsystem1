/*
  # Add User Preference for Completed Task Warning

  1. Changes
    - Add `hide_completed_task_warning` column to `0008-ap-users` table
      - Boolean field to control whether to show warning when editing completed tasks
      - Defaults to false (show warning by default)
    
  2. Important Notes
    - This preference allows users to dismiss the completed task warning permanently
    - The default value is false, meaning warnings will be shown until the user opts out
    - This is a non-breaking change that adds an optional preference field
*/

-- Add the preference column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '0008-ap-users' AND column_name = 'hide_completed_task_warning'
  ) THEN
    ALTER TABLE "0008-ap-users" ADD COLUMN hide_completed_task_warning boolean DEFAULT false;
  END IF;
END $$;
