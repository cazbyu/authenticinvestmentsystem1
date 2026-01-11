/*
  # Add Weekly Alignment Keystone Focus Columns

  1. Schema Changes
    - Add columns to `0008-ap-weekly-alignments` table:
      - `keystone_focus` (text, the ONE focus for the week)
      - `execution_score` (numeric, % of tasks completed during the week)
      - `lagging_metrics` (jsonb, for future use - stores additional metrics)
      - `keystone_achieved` (boolean, whether the keystone was achieved)

  2. Migration Notes
    - Remove old `content` column as it's being replaced by structured fields
    - execution_score and keystone_achieved are nullable (calculated at week end)
    - keystone_focus is required at creation time

  3. Security
    - RLS policies already exist from previous migration
    - No changes needed to policies
*/

-- Remove old content column
ALTER TABLE "0008-ap-weekly-alignments"
  DROP COLUMN IF EXISTS content;

-- Add new structured columns
ALTER TABLE "0008-ap-weekly-alignments"
  ADD COLUMN IF NOT EXISTS keystone_focus text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS execution_score numeric,
  ADD COLUMN IF NOT EXISTS lagging_metrics jsonb,
  ADD COLUMN IF NOT EXISTS keystone_achieved boolean;

-- Add check constraint to ensure keystone_focus is not empty when set
ALTER TABLE "0008-ap-weekly-alignments"
  ADD CONSTRAINT keystone_focus_not_empty CHECK (LENGTH(TRIM(keystone_focus)) > 0);