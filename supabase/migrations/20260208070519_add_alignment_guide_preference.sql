/*
  # Add Alignment Guide Preference

  1. Changes
    - Add `alignment_guide_enabled` column to user_preferences table
    - Defaults to true (enabled by default)
    - Allows users to toggle the Alignment Escort feature on/off

  2. Purpose
    - Controls whether users see coaching prompts and week plan accumulation during Weekly Alignment
    - When enabled: Shows AlignmentEscortCard prompts, NorthStarBadge in header, WeekPlanReview in Step 5
    - When disabled: Standard Weekly Alignment flow without guided features
*/

-- Add alignment guide preference column
ALTER TABLE "0008-ap-user-preferences"
ADD COLUMN IF NOT EXISTS "alignment_guide_enabled" BOOLEAN DEFAULT TRUE;

COMMENT ON COLUMN "0008-ap-user-preferences"."alignment_guide_enabled" IS 'Enable/disable Alignment Escort guided mode with coaching prompts and week plan';

-- Update existing users to have it enabled by default (opt-out model)
UPDATE "0008-ap-user-preferences"
SET "alignment_guide_enabled" = TRUE
WHERE "alignment_guide_enabled" IS NULL;