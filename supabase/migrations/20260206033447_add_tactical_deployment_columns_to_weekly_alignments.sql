/*
  # Add tactical deployment columns to weekly alignments

  1. Modified Tables
    - `0008-ap-weekly-alignments`
      - `committed_tasks` (jsonb, default '[]') - Array of committed task IDs from Step 5
      - `committed_events` (jsonb, default '[]') - Array of committed event IDs from Step 5
      - `delegated_tasks` (jsonb, default '[]') - Array of task IDs delegated during Step 5
      - `signed_at` (timestamptz) - Timestamp when the weekly contract was signed
      - `completed_at` (timestamptz) - Timestamp when the full alignment was completed

  2. Notes
    - These columns support the Tactical Deployment step (Step 5) of Weekly Alignment
    - Uses IF NOT EXISTS for safe idempotent application
    - All jsonb columns default to empty arrays
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '0008-ap-weekly-alignments' AND column_name = 'committed_tasks'
  ) THEN
    ALTER TABLE "0008-ap-weekly-alignments" ADD COLUMN "committed_tasks" JSONB DEFAULT '[]'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '0008-ap-weekly-alignments' AND column_name = 'committed_events'
  ) THEN
    ALTER TABLE "0008-ap-weekly-alignments" ADD COLUMN "committed_events" JSONB DEFAULT '[]'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '0008-ap-weekly-alignments' AND column_name = 'delegated_tasks'
  ) THEN
    ALTER TABLE "0008-ap-weekly-alignments" ADD COLUMN "delegated_tasks" JSONB DEFAULT '[]'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '0008-ap-weekly-alignments' AND column_name = 'signed_at'
  ) THEN
    ALTER TABLE "0008-ap-weekly-alignments" ADD COLUMN "signed_at" TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '0008-ap-weekly-alignments' AND column_name = 'completed_at'
  ) THEN
    ALTER TABLE "0008-ap-weekly-alignments" ADD COLUMN "completed_at" TIMESTAMPTZ;
  END IF;
END $$;