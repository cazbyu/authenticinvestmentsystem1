/*
  # Update Weekly Alignments Table for Scoring v1.0

  This migration updates the existing 0008-ap-weekly-alignments table to support
  the comprehensive scoring system.
*/

-- Add scoring columns to weekly alignments table
ALTER TABLE "0008-ap-weekly-alignments"
ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS "alignment_points" INTEGER DEFAULT 50,
ADD COLUMN IF NOT EXISTS "consistency_points" INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS "keystone_points" INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS "milestone_points" INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS "execution_points" INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS "days_met_target" INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS "keystone_completed" BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS "milestones_hit" INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS "execution_percentage" INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS "total_weekly_points" INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ DEFAULT NOW();

-- Add comments
COMMENT ON COLUMN "0008-ap-weekly-alignments"."alignment_points" IS 'Fixed +50 for completing weekly alignment';
COMMENT ON COLUMN "0008-ap-weekly-alignments"."consistency_points" IS '+5 per day target met (max +35)';
COMMENT ON COLUMN "0008-ap-weekly-alignments"."keystone_points" IS '+20 for 100% adherence to weekly focus';
COMMENT ON COLUMN "0008-ap-weekly-alignments"."milestone_points" IS '+10 per milestone hit';
COMMENT ON COLUMN "0008-ap-weekly-alignments"."execution_points" IS 'Tiered: 85%+=+25, 70%+=+10, 50%+=+5 (12-week goals only)';

-- Update trigger
CREATE OR REPLACE FUNCTION update_weekly_alignment_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_weekly_alignment_timestamp ON "0008-ap-weekly-alignments";

CREATE TRIGGER set_weekly_alignment_timestamp
  BEFORE UPDATE ON "0008-ap-weekly-alignments"
  FOR EACH ROW
  EXECUTE FUNCTION update_weekly_alignment_timestamp();