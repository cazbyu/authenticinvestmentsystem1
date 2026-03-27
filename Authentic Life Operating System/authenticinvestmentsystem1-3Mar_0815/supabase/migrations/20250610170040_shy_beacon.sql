-- Migration: shy_beacon (recovered from remote)
-- Originally applied: 2025-06-10
-- Creates onboarding responses and goals tables

-- Create onboarding responses table
CREATE TABLE IF NOT EXISTS onboarding_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  why_here text,
  area_of_focus text,
  current_challenge text,
  vision_statement text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create onboarding goals table
CREATE TABLE IF NOT EXISTS onboarding_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  goal_text text NOT NULL,
  goal_type text NOT NULL CHECK (goal_type IN ('one_year', 'twelve_week')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE onboarding_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_goals ENABLE ROW LEVEL SECURITY;

-- Create policies for onboarding_responses
CREATE POLICY "Users can read own onboarding responses"
  ON onboarding_responses
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own onboarding responses"
  ON onboarding_responses
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own onboarding responses"
  ON onboarding_responses
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create policies for onboarding_goals
CREATE POLICY "Users can read own onboarding goals"
  ON onboarding_goals
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own onboarding goals"
  ON onboarding_goals
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own onboarding goals"
  ON onboarding_goals
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own onboarding goals"
  ON onboarding_goals
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Add updated_at trigger for onboarding_responses
CREATE TRIGGER update_onboarding_responses_updated_at
  BEFORE UPDATE ON onboarding_responses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add updated_at trigger for onboarding_goals
CREATE TRIGGER update_onboarding_goals_updated_at
  BEFORE UPDATE ON onboarding_goals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
