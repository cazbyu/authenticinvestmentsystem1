/*
  # Expand Parent Type Constraints for Follow-Through System
  
  1. Changes
    - Drop existing CHECK constraints on parent_type columns
    - Create new CHECK constraints allowing all item types: task, event, reflection, rose, thorn, depositIdea
    - Ensures follow-through system can properly link all types of items
  
  2. Security
    - Maintains existing RLS policies
    - No changes to data access permissions
*/

-- Drop existing parent_type constraints
ALTER TABLE "0008-ap-tasks" 
  DROP CONSTRAINT IF EXISTS ap_tasks_parent_type_check;

ALTER TABLE "0008-ap-reflections" 
  DROP CONSTRAINT IF EXISTS ap_reflections_parent_type_check;

-- Add new expanded constraints for tasks table
ALTER TABLE "0008-ap-tasks" 
  ADD CONSTRAINT ap_tasks_parent_type_check 
  CHECK (
    parent_type IS NULL OR 
    parent_type IN ('task', 'event', 'reflection', 'rose', 'thorn', 'depositIdea')
  );

-- Add new expanded constraints for reflections table
ALTER TABLE "0008-ap-reflections" 
  ADD CONSTRAINT ap_reflections_parent_type_check 
  CHECK (
    parent_type IS NULL OR 
    parent_type IN ('task', 'event', 'reflection', 'rose', 'thorn', 'depositIdea')
  );

-- Create indexes for efficient querying if they don't exist
CREATE INDEX IF NOT EXISTS idx_tasks_parent_id ON "0008-ap-tasks"(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_parent_type ON "0008-ap-tasks"(parent_type) WHERE parent_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reflections_parent_id ON "0008-ap-reflections"(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reflections_parent_type ON "0008-ap-reflections"(parent_type) WHERE parent_type IS NOT NULL;
