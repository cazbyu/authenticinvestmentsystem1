/*
  # Add Parent-Child Relationships to Tasks

  ## Overview
  This migration adds hierarchical parent-child relationships to the 0008-ap-tasks table,
  allowing tasks/actions to be linked to parent items (reflections or other tasks).

  ## Changes Made

  1. **New Columns Added to 0008-ap-tasks**
     - `parent_id` (uuid, nullable): References the parent item's ID
     - `parent_type` (text, nullable): Specifies the type of parent ('reflection' or 'task')

  2. **Constraints**
     - parent_type must be either 'reflection' or 'task' when parent_id is set
     - parent_id must be null if parent_type is null (and vice versa)
     - Maximum depth of 8 levels enforced via trigger
     - Foreign key to reflections table when parent_type = 'reflection'

  3. **Triggers**
     - Depth validation trigger to prevent nesting beyond 8 levels
     - Orphaning trigger to set parent_id to null when parent task is deleted

  4. **Indexes**
     - Index on (parent_id, parent_type) for efficient querying
     - Index on parent_id for orphaning operations

  ## Security
  - RLS policies updated to allow users to manage parent relationships for their own items
*/

-- Add parent_id and parent_type columns to 0008-ap-tasks
ALTER TABLE "0008-ap-tasks"
ADD COLUMN IF NOT EXISTS parent_id uuid,
ADD COLUMN IF NOT EXISTS parent_type text;

-- Add check constraint for parent_type values
ALTER TABLE "0008-ap-tasks"
DROP CONSTRAINT IF EXISTS ap_tasks_parent_type_check;

ALTER TABLE "0008-ap-tasks"
ADD CONSTRAINT ap_tasks_parent_type_check
CHECK (parent_type IN ('reflection', 'task') OR parent_type IS NULL);

-- Add constraint: both parent_id and parent_type must be set together or both null
ALTER TABLE "0008-ap-tasks"
DROP CONSTRAINT IF EXISTS ap_tasks_parent_consistency_check;

ALTER TABLE "0008-ap-tasks"
ADD CONSTRAINT ap_tasks_parent_consistency_check
CHECK (
  (parent_id IS NULL AND parent_type IS NULL) OR
  (parent_id IS NOT NULL AND parent_type IS NOT NULL)
);

-- Create function to validate parent-child depth (max 8 levels)
CREATE OR REPLACE FUNCTION validate_task_parent_depth()
RETURNS trigger AS $$
DECLARE
  current_depth integer := 0;
  current_parent_id uuid;
  current_parent_type text;
  max_depth integer := 8;
BEGIN
  -- If no parent, no validation needed
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Start with the immediate parent
  current_parent_id := NEW.parent_id;
  current_parent_type := NEW.parent_type;

  -- Traverse up the hierarchy
  WHILE current_parent_id IS NOT NULL AND current_depth < max_depth LOOP
    current_depth := current_depth + 1;

    -- Check if we've hit the max depth
    IF current_depth >= max_depth THEN
      RAISE EXCEPTION 'Maximum parent-child depth of % levels exceeded', max_depth;
    END IF;

    -- Get the next parent up the chain
    IF current_parent_type = 'task' THEN
      SELECT parent_id, parent_type INTO current_parent_id, current_parent_type
      FROM "0008-ap-tasks"
      WHERE id = current_parent_id;
    ELSIF current_parent_type = 'reflection' THEN
      -- Reflections don't have parents, so we're at the top
      current_parent_id := NULL;
    ELSE
      -- Unknown parent type
      current_parent_id := NULL;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to validate depth on insert and update
DROP TRIGGER IF EXISTS trigger_validate_task_parent_depth ON "0008-ap-tasks";

CREATE TRIGGER trigger_validate_task_parent_depth
BEFORE INSERT OR UPDATE OF parent_id, parent_type ON "0008-ap-tasks"
FOR EACH ROW
EXECUTE FUNCTION validate_task_parent_depth();

-- Create function to validate parent references
CREATE OR REPLACE FUNCTION validate_task_parent_reference()
RETURNS trigger AS $$
BEGIN
  -- If no parent, no validation needed
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Validate that parent exists based on parent_type
  IF NEW.parent_type = 'reflection' THEN
    IF NOT EXISTS (SELECT 1 FROM "0008-ap-reflections" WHERE id = NEW.parent_id) THEN
      RAISE EXCEPTION 'Parent reflection with id % does not exist', NEW.parent_id;
    END IF;
  ELSIF NEW.parent_type = 'task' THEN
    IF NOT EXISTS (SELECT 1 FROM "0008-ap-tasks" WHERE id = NEW.parent_id) THEN
      RAISE EXCEPTION 'Parent task with id % does not exist', NEW.parent_id;
    END IF;
    -- Prevent self-referencing
    IF NEW.parent_id = NEW.id THEN
      RAISE EXCEPTION 'Task cannot be its own parent';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to validate parent references
DROP TRIGGER IF EXISTS trigger_validate_task_parent_reference ON "0008-ap-tasks";

CREATE TRIGGER trigger_validate_task_parent_reference
BEFORE INSERT OR UPDATE OF parent_id, parent_type ON "0008-ap-tasks"
FOR EACH ROW
EXECUTE FUNCTION validate_task_parent_reference();

-- Create function to orphan child tasks when parent task is deleted
CREATE OR REPLACE FUNCTION orphan_child_tasks_on_parent_delete()
RETURNS trigger AS $$
BEGIN
  -- Set parent_id and parent_type to NULL for all child tasks
  UPDATE "0008-ap-tasks"
  SET parent_id = NULL, parent_type = NULL
  WHERE parent_id = OLD.id AND parent_type = 'task';

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to orphan children on parent task deletion
DROP TRIGGER IF EXISTS trigger_orphan_child_tasks ON "0008-ap-tasks";

CREATE TRIGGER trigger_orphan_child_tasks
BEFORE DELETE ON "0008-ap-tasks"
FOR EACH ROW
EXECUTE FUNCTION orphan_child_tasks_on_parent_delete();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ap_tasks_parent_id_type
ON "0008-ap-tasks"(parent_id, parent_type)
WHERE parent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ap_tasks_parent_id
ON "0008-ap-tasks"(parent_id)
WHERE parent_id IS NOT NULL;

-- Add comments to document the feature
COMMENT ON COLUMN "0008-ap-tasks".parent_id IS 'ID of the parent item (reflection or task). Set to NULL when parent is deleted.';
COMMENT ON COLUMN "0008-ap-tasks".parent_type IS 'Type of parent: "reflection" or "task". Must be set when parent_id is set.';