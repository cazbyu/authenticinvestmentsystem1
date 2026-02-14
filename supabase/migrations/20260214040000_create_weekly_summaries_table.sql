-- Phase 1C: Create weekly summaries table for 3-month data summarization
-- After 3 months, daily detail data is summarized by week so AI context stays lean
-- Original records remain accessible but aren't loaded into AI context

CREATE TABLE IF NOT EXISTS "0008-ap-weekly-summaries" (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,

  -- Aggregated counts
  tasks_completed INTEGER DEFAULT 0,
  tasks_created INTEGER DEFAULT 0,
  events_attended INTEGER DEFAULT 0,
  reflections_count INTEGER DEFAULT 0,
  brain_dumps_count INTEGER DEFAULT 0,
  roses_count INTEGER DEFAULT 0,
  thorns_count INTEGER DEFAULT 0,

  -- Scores
  avg_daily_score NUMERIC(5,2),
  avg_target_score NUMERIC(5,2),
  total_points INTEGER DEFAULT 0,
  win_days INTEGER DEFAULT 0,
  loss_days INTEGER DEFAULT 0,

  -- Role/wellness engagement
  roles_engaged JSONB DEFAULT '[]'::jsonb,         -- [{role_id, task_count, name}]
  wellness_zones_engaged JSONB DEFAULT '[]'::jsonb, -- [{wz_id, task_count, name}]
  goals_progressed JSONB DEFAULT '[]'::jsonb,       -- [{goal_id, tasks_done, name}]

  -- Dominant patterns
  dominant_cardinal TEXT,           -- most frequent cardinal direction for the week
  fuel_levels JSONB DEFAULT '[]'::jsonb,  -- [1,2,3,2,3,2,1] daily fuel levels

  -- AI-generated summary (populated by alignment-coach edge function)
  summary_text TEXT,                -- Natural language summary for AI context
  summary_json JSONB,              -- Structured summary data

  -- Metadata
  source_period_start DATE,        -- earliest record date included
  source_period_end DATE,          -- latest record date included
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,

  -- Prevent duplicate summaries for same user+week
  UNIQUE(user_id, week_start)
);

-- Enable RLS
ALTER TABLE "0008-ap-weekly-summaries" ENABLE ROW LEVEL SECURITY;

-- RLS policies: users can only see/modify their own summaries
CREATE POLICY "Users can view own weekly summaries"
  ON "0008-ap-weekly-summaries"
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own weekly summaries"
  ON "0008-ap-weekly-summaries"
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own weekly summaries"
  ON "0008-ap-weekly-summaries"
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Service role can manage all summaries (for background summarization jobs)
CREATE POLICY "Service role can manage all weekly summaries"
  ON "0008-ap-weekly-summaries"
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Index for fast lookups by user and date range
CREATE INDEX IF NOT EXISTS idx_weekly_summaries_user_week
  ON "0008-ap-weekly-summaries" (user_id, week_start DESC);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_weekly_summaries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_weekly_summaries_updated_at
  BEFORE UPDATE ON "0008-ap-weekly-summaries"
  FOR EACH ROW
  EXECUTE FUNCTION update_weekly_summaries_updated_at();

-- Comment
COMMENT ON TABLE "0008-ap-weekly-summaries" IS
  'Weekly aggregated summaries for 3-month data lifecycle. After 3 months, daily detail is summarized here so AI context stays lean while preserving insights.';
