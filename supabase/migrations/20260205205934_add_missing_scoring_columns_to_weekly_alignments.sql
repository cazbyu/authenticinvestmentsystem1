/*
  # Add missing scoring columns to weekly alignments

  1. Modified Tables
    - `0008-ap-weekly-alignments`
      - `alignment_points` (integer, default 50) - Fixed points for completing weekly alignment
      - `consistency_points` (integer, default 0) - Points per day target met
      - `keystone_points` (integer, default 0) - Points for keystone adherence
      - `milestone_points` (integer, default 0) - Points per milestone hit
      - `execution_points` (integer, default 0) - Tiered execution points
      - `days_met_target` (integer, default 0) - Number of days meeting target
      - `keystone_completed` (boolean, default false) - Whether keystone was completed
      - `milestones_hit` (integer, default 0) - Number of milestones hit
      - `execution_percentage` (integer, default 0) - Execution percentage
      - `total_weekly_points` (integer, default 0) - Total weekly points sum

  2. Notes
    - These columns were defined in a prior migration that was recorded but did not persist
    - Uses IF NOT EXISTS to safely add only missing columns
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '0008-ap-weekly-alignments' AND column_name = 'alignment_points'
  ) THEN
    ALTER TABLE "0008-ap-weekly-alignments" ADD COLUMN "alignment_points" INTEGER DEFAULT 50;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '0008-ap-weekly-alignments' AND column_name = 'consistency_points'
  ) THEN
    ALTER TABLE "0008-ap-weekly-alignments" ADD COLUMN "consistency_points" INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '0008-ap-weekly-alignments' AND column_name = 'keystone_points'
  ) THEN
    ALTER TABLE "0008-ap-weekly-alignments" ADD COLUMN "keystone_points" INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '0008-ap-weekly-alignments' AND column_name = 'milestone_points'
  ) THEN
    ALTER TABLE "0008-ap-weekly-alignments" ADD COLUMN "milestone_points" INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '0008-ap-weekly-alignments' AND column_name = 'execution_points'
  ) THEN
    ALTER TABLE "0008-ap-weekly-alignments" ADD COLUMN "execution_points" INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '0008-ap-weekly-alignments' AND column_name = 'days_met_target'
  ) THEN
    ALTER TABLE "0008-ap-weekly-alignments" ADD COLUMN "days_met_target" INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '0008-ap-weekly-alignments' AND column_name = 'keystone_completed'
  ) THEN
    ALTER TABLE "0008-ap-weekly-alignments" ADD COLUMN "keystone_completed" BOOLEAN DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '0008-ap-weekly-alignments' AND column_name = 'milestones_hit'
  ) THEN
    ALTER TABLE "0008-ap-weekly-alignments" ADD COLUMN "milestones_hit" INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '0008-ap-weekly-alignments' AND column_name = 'execution_percentage'
  ) THEN
    ALTER TABLE "0008-ap-weekly-alignments" ADD COLUMN "execution_percentage" INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '0008-ap-weekly-alignments' AND column_name = 'total_weekly_points'
  ) THEN
    ALTER TABLE "0008-ap-weekly-alignments" ADD COLUMN "total_weekly_points" INTEGER DEFAULT 0;
  END IF;
END $$;