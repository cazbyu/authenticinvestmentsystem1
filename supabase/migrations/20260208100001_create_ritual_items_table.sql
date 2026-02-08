-- Create ritual items table to track items created during ritual flows
-- This stores the week plan items created during the Weekly Alignment ritual
-- (tasks, events, and ideas captured during steps 2-4)

CREATE TABLE IF NOT EXISTS "0008-ap-ritual-items" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ritual_type TEXT NOT NULL DEFAULT 'weekly_alignment',
  item_type TEXT NOT NULL CHECK (item_type IN ('task', 'event', 'idea')),
  title TEXT NOT NULL,
  source_step INTEGER NOT NULL CHECK (source_step BETWEEN 1 AND 5),
  source_context TEXT,
  aligned_to TEXT,
  week_start_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_ritual_items_user_week 
  ON "0008-ap-ritual-items" (user_id, week_start_date);

CREATE INDEX IF NOT EXISTS idx_ritual_items_ritual_type 
  ON "0008-ap-ritual-items" (ritual_type);

-- Enable RLS
ALTER TABLE "0008-ap-ritual-items" ENABLE ROW LEVEL SECURITY;

-- Users can only see/modify their own ritual items
CREATE POLICY "Users can manage own ritual items" 
  ON "0008-ap-ritual-items" 
  FOR ALL 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE "0008-ap-ritual-items" IS 'Tracks items (tasks, events, ideas) created during ritual flows like Weekly Alignment';
COMMENT ON COLUMN "0008-ap-ritual-items".source_step IS 'Which step of the ritual created this item (1-5)';
COMMENT ON COLUMN "0008-ap-ritual-items".source_context IS 'Context where the item was created, e.g., Role: Father, Wellness: Physical';
COMMENT ON COLUMN "0008-ap-ritual-items".aligned_to IS 'Which North Star element this item connects to';
