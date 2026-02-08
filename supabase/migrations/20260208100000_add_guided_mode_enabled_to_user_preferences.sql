-- Add guided_mode_enabled column to user preferences table
-- This controls whether the Alignment Escort coaching layer is shown
-- during the Weekly Alignment ritual flow

ALTER TABLE "0008-ap-user-preferences"
ADD COLUMN IF NOT EXISTS guided_mode_enabled BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN "0008-ap-user-preferences".guided_mode_enabled IS 'Controls whether the Alignment Guide coaching layer is shown during Weekly Alignment ritual';
