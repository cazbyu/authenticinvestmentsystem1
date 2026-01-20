/*
  # Fix Deposit Ideas is_active Default Value

  1. Changes
     - Change default value of is_active from true to false
     - New deposit ideas should not show as "activated" by default
     - Only show activated badge when explicitly activated

  2. Notes
     - This ensures new deposit ideas don't incorrectly show the "Activated" badge
     - Activation only happens when user clicks "Activate" button
*/

-- Change the default value for is_active to false
ALTER TABLE "0008-ap-deposit-ideas"
  ALTER COLUMN is_active SET DEFAULT false;
