-- Add skipped_at to weekly-alignments so users can skip a week
-- and stop the compass from spinning without completing the full ritual.
ALTER TABLE "0008-ap-weekly-alignments"
ADD COLUMN IF NOT EXISTS skipped_at TIMESTAMPTZ;

COMMENT ON COLUMN "0008-ap-weekly-alignments".skipped_at IS 'Timestamp when user chose to skip this weeks alignment';

-- Add skipped flag to daily-sparks so users can skip today's spark
ALTER TABLE "0008-ap-daily-sparks"
ADD COLUMN IF NOT EXISTS skipped BOOLEAN DEFAULT false;

COMMENT ON COLUMN "0008-ap-daily-sparks".skipped IS 'Whether user chose to skip this days morning spark';
