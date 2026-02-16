-- Migration: Create activity log system for sub-task detail tracking
-- Adds tracking_template and data_schema columns to 0008-ap-tasks
-- Creates 0008-ap-activity-log table for structured detail logging

-- ============================================================
-- 1. Add columns to 0008-ap-tasks
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '0008-ap-tasks' AND column_name = 'tracking_template'
  ) THEN
    ALTER TABLE "0008-ap-tasks" ADD COLUMN tracking_template text DEFAULT NULL
      CHECK (tracking_template IN ('workout', 'financial', 'measurement', 'journal', 'checklist'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '0008-ap-tasks' AND column_name = 'data_schema'
  ) THEN
    ALTER TABLE "0008-ap-tasks" ADD COLUMN data_schema jsonb DEFAULT NULL;
  END IF;
END $$;

-- ============================================================
-- 2. Create 0008-ap-activity-log table
-- ============================================================

CREATE TABLE IF NOT EXISTS "0008-ap-activity-log" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES "0008-ap-tasks"(id) ON DELETE CASCADE,
  log_date date NOT NULL,
  template_type text NOT NULL
    CHECK (template_type IN ('workout', 'financial', 'measurement', 'journal', 'checklist')),
  primary_metric numeric DEFAULT NULL,
  details jsonb NOT NULL DEFAULT '{}',
  notes text DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 3. Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_activity_log_user_id
  ON "0008-ap-activity-log"(user_id);

CREATE INDEX IF NOT EXISTS idx_activity_log_task_id
  ON "0008-ap-activity-log"(task_id);

CREATE INDEX IF NOT EXISTS idx_activity_log_task_date
  ON "0008-ap-activity-log"(task_id, log_date);

CREATE INDEX IF NOT EXISTS idx_activity_log_date
  ON "0008-ap-activity-log"(log_date);

-- ============================================================
-- 4. Row Level Security
-- ============================================================

ALTER TABLE "0008-ap-activity-log" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own activity logs"
  ON "0008-ap-activity-log"
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 5. Updated_at trigger
-- ============================================================

CREATE OR REPLACE FUNCTION update_activity_log_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'update_activity_log_updated_at_trigger'
    ) THEN
        CREATE TRIGGER update_activity_log_updated_at_trigger
          BEFORE UPDATE ON "0008-ap-activity-log"
          FOR EACH ROW
          EXECUTE FUNCTION update_activity_log_updated_at();
    END IF;
END $$;
