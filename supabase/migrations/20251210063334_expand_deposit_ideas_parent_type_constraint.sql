/*
  # Expand Deposit Ideas Parent Type Constraint
  
  Updates the parent_type constraint on the 0008-ap-deposit-ideas table to allow
  all valid parent types, matching the constraints on tasks and reflections tables.
  
  ## Changes
  - Drop existing restrictive constraint (only allowed 'reflection', 'task')
  - Add new constraint allowing: 'task', 'event', 'reflection', 'rose', 'thorn', 'depositIdea'
  
  ## Impact
  This allows deposit ideas to be properly linked as children of events, roses, and thorns.
*/

-- Drop the existing restrictive constraint
ALTER TABLE "0008-ap-deposit-ideas"
DROP CONSTRAINT IF EXISTS ap_deposit_ideas_parent_type_check;

-- Add the expanded constraint to match tasks and reflections
ALTER TABLE "0008-ap-deposit-ideas"
ADD CONSTRAINT ap_deposit_ideas_parent_type_check
CHECK (
  (parent_type IS NULL) OR 
  (parent_type = ANY (ARRAY['task'::text, 'event'::text, 'reflection'::text, 'rose'::text, 'thorn'::text, 'depositIdea'::text]))
);