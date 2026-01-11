/*
  # Create Aspirations Table

  Table for tracking daily aspirations with tiered point rewards
*/

CREATE TABLE IF NOT EXISTS "0008-ap-aspirations" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  "content" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ DEFAULT NOW(),
  "points_awarded" INTEGER DEFAULT 0
);

COMMENT ON TABLE "0008-ap-aspirations" IS 'Daily aspirations with tiered point rewards (5, 3, 1)';
COMMENT ON COLUMN "0008-ap-aspirations"."points_awarded" IS 'Points awarded: 1st=5, 2nd=3, 3rd=1';

-- RLS policies
ALTER TABLE "0008-ap-aspirations" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own aspirations"
  ON "0008-ap-aspirations"
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own aspirations"
  ON "0008-ap-aspirations"
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own aspirations"
  ON "0008-ap-aspirations"
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own aspirations"
  ON "0008-ap-aspirations"
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Index
CREATE INDEX IF NOT EXISTS idx_aspirations_user_date
  ON "0008-ap-aspirations" (user_id, created_at DESC);