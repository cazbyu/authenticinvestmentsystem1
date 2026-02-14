-- Add fuel_3_why column to daily-sparks
-- Stores the reason when user selects full energy (level 3)
-- Helps distinguish true sprint energy from over-enthusiasm
ALTER TABLE "0008-ap-daily-sparks"
ADD COLUMN IF NOT EXISTS fuel_3_why TEXT;

COMMENT ON COLUMN "0008-ap-daily-sparks".fuel_3_why IS 'Reason for high energy (level 3). Values: true_sprint, post_rest_energy, exciting_day, over_enthusiasm, caffeine_boost';
