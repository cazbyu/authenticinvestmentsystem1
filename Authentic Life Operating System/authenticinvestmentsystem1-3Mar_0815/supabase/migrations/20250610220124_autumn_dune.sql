-- Migration: autumn_dune (recovered from remote)
-- Originally applied: 2025-06-10
-- Creates 12-week goals system tables

-- Create main 12-week goals table
CREATE TABLE IF NOT EXISTS "0007-ap-goals_12wk_main" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  status text DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'cancelled')),
  progress integer DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  start_date date,
  end_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create goal-domain junction table
CREATE TABLE IF NOT EXISTS "0007-ap-goal_domains" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id uuid NOT NULL,
  domain_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(goal_id, domain_id)
);

-- Create goal-role junction table
CREATE TABLE IF NOT EXISTS "0007-ap-goal_roles" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id uuid NOT NULL,
  role_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(goal_id, role_id)
);

-- Create weekly goals table
CREATE TABLE IF NOT EXISTS "0007-ap-goal_weekly_goals" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id uuid NOT NULL,
  week_number integer NOT NULL CHECK (week_number >= 1 AND week_number <= 13),
  title text NOT NULL,
  description text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  progress integer DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(goal_id, week_number, title)
);

-- Create goal tasks table
CREATE TABLE IF NOT EXISTS "0007-ap-goal_tasks" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id uuid NOT NULL,
  weekly_goal_id uuid,
  task_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(goal_id, task_id)
);

-- Add foreign key constraints
ALTER TABLE "0007-ap-goal_domains"
ADD CONSTRAINT fk_goal_domains_goal
FOREIGN KEY (goal_id) REFERENCES "0007-ap-goals_12wk_main"(id) ON DELETE CASCADE;

ALTER TABLE "0007-ap-goal_domains"
ADD CONSTRAINT fk_goal_domains_domain
FOREIGN KEY (domain_id) REFERENCES "0007-ap-domains"(id) ON DELETE CASCADE;

ALTER TABLE "0007-ap-goal_roles"
ADD CONSTRAINT fk_goal_roles_goal
FOREIGN KEY (goal_id) REFERENCES "0007-ap-goals_12wk_main"(id) ON DELETE CASCADE;

ALTER TABLE "0007-ap-goal_roles"
ADD CONSTRAINT fk_goal_roles_role
FOREIGN KEY (role_id) REFERENCES "0007-ap-roles"(id) ON DELETE CASCADE;

ALTER TABLE "0007-ap-goal_weekly_goals"
ADD CONSTRAINT fk_weekly_goals_goal
FOREIGN KEY (goal_id) REFERENCES "0007-ap-goals_12wk_main"(id) ON DELETE CASCADE;

ALTER TABLE "0007-ap-goal_tasks"
ADD CONSTRAINT fk_goal_tasks_goal
FOREIGN KEY (goal_id) REFERENCES "0007-ap-goals_12wk_main"(id) ON DELETE CASCADE;

ALTER TABLE "0007-ap-goal_tasks"
ADD CONSTRAINT fk_goal_tasks_weekly_goal
FOREIGN KEY (weekly_goal_id) REFERENCES "0007-ap-goal_weekly_goals"(id) ON DELETE CASCADE;

ALTER TABLE "0007-ap-goal_tasks"
ADD CONSTRAINT fk_goal_tasks_task
FOREIGN KEY (task_id) REFERENCES "0007-ap-tasks"(id) ON DELETE CASCADE;

-- Enable RLS on all tables
ALTER TABLE "0007-ap-goals_12wk_main" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "0007-ap-goal_domains" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "0007-ap-goal_roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "0007-ap-goal_weekly_goals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "0007-ap-goal_tasks" ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for main goals table
CREATE POLICY "Users can manage their own 12-week goals"
  ON "0007-ap-goals_12wk_main"
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create RLS policies for goal-domain junction
CREATE POLICY "Users can manage their own goal domains"
  ON "0007-ap-goal_domains"
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "0007-ap-goals_12wk_main"
      WHERE id = goal_id AND user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "0007-ap-goals_12wk_main"
      WHERE id = goal_id AND user_id = auth.uid()
    )
  );

-- Create RLS policies for goal-role junction
CREATE POLICY "Users can manage their own goal roles"
  ON "0007-ap-goal_roles"
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "0007-ap-goals_12wk_main"
      WHERE id = goal_id AND user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "0007-ap-goals_12wk_main"
      WHERE id = goal_id AND user_id = auth.uid()
    )
  );

-- Create RLS policies for weekly goals
CREATE POLICY "Users can manage their own weekly goals"
  ON "0007-ap-goal_weekly_goals"
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "0007-ap-goals_12wk_main"
      WHERE id = goal_id AND user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "0007-ap-goals_12wk_main"
      WHERE id = goal_id AND user_id = auth.uid()
    )
  );

-- Create RLS policies for goal tasks
CREATE POLICY "Users can manage their own goal tasks"
  ON "0007-ap-goal_tasks"
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "0007-ap-goals_12wk_main"
      WHERE id = goal_id AND user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "0007-ap-goals_12wk_main"
      WHERE id = goal_id AND user_id = auth.uid()
    )
  );

-- Add updated_at triggers
CREATE TRIGGER update_0007_ap_goals_12wk_main_updated_at
  BEFORE UPDATE ON "0007-ap-goals_12wk_main"
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_0007_ap_goal_weekly_goals_updated_at
  BEFORE UPDATE ON "0007-ap-goal_weekly_goals"
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_goals_12wk_main_user_id ON "0007-ap-goals_12wk_main"(user_id);
CREATE INDEX IF NOT EXISTS idx_goal_domains_goal_id ON "0007-ap-goal_domains"(goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_roles_goal_id ON "0007-ap-goal_roles"(goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_weekly_goals_goal_id ON "0007-ap-goal_weekly_goals"(goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_tasks_goal_id ON "0007-ap-goal_tasks"(goal_id);
