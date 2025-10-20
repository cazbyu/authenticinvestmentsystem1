/*
  # Add Missing Columns to Roles and Global Cycles Tables

  ## Summary
  Adds missing columns to 0008-ap-roles and updates 0008-ap-global-cycles
  to support the complete schema expected by the frontend application.

  ## Changes Made
  1. **0008-ap-roles table updates**
     - Add category column for role categorization
     - Add icon column for visual representation
     - Add is_active column for soft deletion
     - Add sort_order column for custom ordering
     - Add source column to track role origin (user-created vs system-provided)

  2. **0008-ap-global-cycles table updates**
     - Convert is_active boolean to status enum for more granular control
     - Add migration for existing data (is_active=true → status='active', is_active=false → status='archived')

  ## Impact
  - Frontend queries that rely on these columns will now work correctly
  - Existing data is preserved and migrated appropriately
*/

-- ============================================================================
-- STEP 1: Add Missing Columns to 0008-ap-roles
-- ============================================================================

-- Add category column for categorizing roles (personal, professional, etc.)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '0008-ap-roles' AND column_name = 'category'
  ) THEN
    ALTER TABLE "0008-ap-roles" ADD COLUMN category text;
  END IF;
END $$;

-- Add icon column for storing icon identifier
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '0008-ap-roles' AND column_name = 'icon'
  ) THEN
    ALTER TABLE "0008-ap-roles" ADD COLUMN icon text;
  END IF;
END $$;

-- Add is_active column for soft deletion
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '0008-ap-roles' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE "0008-ap-roles" ADD COLUMN is_active boolean DEFAULT true;
  END IF;
END $$;

-- Add sort_order column for custom ordering
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '0008-ap-roles' AND column_name = 'sort_order'
  ) THEN
    ALTER TABLE "0008-ap-roles" ADD COLUMN sort_order integer;
  END IF;
END $$;

-- Add source column to track origin (e.g., 'user', 'system', 'imported')
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '0008-ap-roles' AND column_name = 'source'
  ) THEN
    ALTER TABLE "0008-ap-roles" ADD COLUMN source text DEFAULT 'user';
  END IF;
END $$;

-- Add index for sort_order queries
CREATE INDEX IF NOT EXISTS idx_roles_sort_order ON "0008-ap-roles"(sort_order) WHERE sort_order IS NOT NULL;

-- Add index for is_active queries
CREATE INDEX IF NOT EXISTS idx_roles_is_active ON "0008-ap-roles"(is_active) WHERE is_active = true;

COMMENT ON COLUMN "0008-ap-roles".category IS 'Role category for grouping (e.g., personal, professional, family)';
COMMENT ON COLUMN "0008-ap-roles".icon IS 'Icon identifier for visual representation';
COMMENT ON COLUMN "0008-ap-roles".is_active IS 'Whether the role is active (soft delete flag)';
COMMENT ON COLUMN "0008-ap-roles".sort_order IS 'Custom sort order for displaying roles';
COMMENT ON COLUMN "0008-ap-roles".source IS 'Origin of the role: user-created, system-provided, or imported';

-- ============================================================================
-- STEP 2: Update 0008-ap-global-cycles Status System
-- ============================================================================

-- Add status column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '0008-ap-global-cycles' AND column_name = 'status'
  ) THEN
    -- Add the status column with a constraint
    ALTER TABLE "0008-ap-global-cycles"
      ADD COLUMN status text DEFAULT 'active'
      CHECK (status IN ('active', 'draft', 'completed', 'archived'));

    -- Migrate existing is_active values to status
    UPDATE "0008-ap-global-cycles"
    SET status = CASE
      WHEN is_active = true THEN 'active'
      ELSE 'archived'
    END
    WHERE status IS NULL;
  END IF;
END $$;

-- Add index for status queries
CREATE INDEX IF NOT EXISTS idx_global_cycles_status ON "0008-ap-global-cycles"(status);

COMMENT ON COLUMN "0008-ap-global-cycles".status IS 'Cycle status: active (current/ongoing), draft (not yet started), completed (finished), archived (historical)';

-- Note: We keep is_active column for backward compatibility but status is now the primary field
-- Applications should use status column going forward

-- ============================================================================
-- STEP 3: Add user_global_timeline_id to Goals and Tasks Tables
-- ============================================================================

-- Add user_global_timeline_id to 0008-ap-goals-12wk
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '0008-ap-goals-12wk' AND column_name = 'user_global_timeline_id'
  ) THEN
    ALTER TABLE "0008-ap-goals-12wk"
      ADD COLUMN user_global_timeline_id uuid REFERENCES "0008-ap-user-global-timelines"(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add user_global_timeline_id to 0008-ap-tasks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '0008-ap-tasks' AND column_name = 'user_global_timeline_id'
  ) THEN
    ALTER TABLE "0008-ap-tasks"
      ADD COLUMN user_global_timeline_id uuid REFERENCES "0008-ap-user-global-timelines"(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add indexes for timeline queries
CREATE INDEX IF NOT EXISTS idx_goals_12wk_user_global_timeline ON "0008-ap-goals-12wk"(user_global_timeline_id) WHERE user_global_timeline_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_user_global_timeline ON "0008-ap-tasks"(user_global_timeline_id) WHERE user_global_timeline_id IS NOT NULL;

COMMENT ON COLUMN "0008-ap-goals-12wk".user_global_timeline_id IS 'Links goal to a specific activated global timeline instance for the user';
COMMENT ON COLUMN "0008-ap-tasks".user_global_timeline_id IS 'Links task/event to a specific activated global timeline instance for the user (replaces generic global_timeline_id)';
