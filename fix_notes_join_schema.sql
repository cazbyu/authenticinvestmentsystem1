/*
  # Fix 0008-ap-universal-notes-join Schema
  
  1. Issues Fixed
     - Remove duplicate CHECK constraints with conflicting definitions
     - Add 'event' as a valid parent_type option
     - Clean up duplicate indexes
  
  2. Changes
     - Drop duplicate constraint
     - Create single constraint with all valid parent types including 'event'
     - Remove redundant indexes
     - Update get_notes_for_reflection_date function to return parent_type
*/

-- Step 1: Drop the duplicate CHECK constraints
ALTER TABLE "0008-ap-universal-notes-join" 
  DROP CONSTRAINT IF EXISTS "0008-ap-universal-notes-join_parent_type_check";

-- Step 2: Add the corrected CHECK constraint with all valid parent types including 'event'
ALTER TABLE "0008-ap-universal-notes-join"
  ADD CONSTRAINT "0008-ap-universal-notes-join_parent_type_check" 
  CHECK (
    parent_type = ANY (
      ARRAY[
        'task'::text,
        'event'::text,
        'depositIdea'::text,
        'withdrawal'::text,
        'goal'::text,
        'custom_goal'::text,
        '1y_goal'::text,
        'reflection'::text
      ]
    )
  );

-- Step 3: Remove duplicate indexes (keep the most descriptive one)
DROP INDEX IF EXISTS "notes_join_parent_type_id_idx";
DROP INDEX IF EXISTS "notes_join_ptype_pid_idx";

-- Keep: "0008-ap-universal-notes-join_parent_id_parent_type_idx"
-- Keep: "0008-ap-universal-notes-join_note_id_idx"
-- Keep: "0008-ap-universal-notes-join_user_id_idx"

-- Step 4: Update the get_notes_for_reflection_date function to return parent_type
CREATE OR REPLACE FUNCTION get_notes_for_reflection_date(
  p_user_id uuid,
  p_date date
)
RETURNS TABLE (
  id uuid,
  content text,
  created_at timestamptz,
  parent_type text
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    n.id,
    n.content,
    n.created_at,
    unj.parent_type
  FROM "0008-ap-notes" n
  JOIN "0008-ap-universal-notes-join" unj ON unj.note_id = n.id
  LEFT JOIN "0008-ap-tasks" t ON t.id = unj.parent_id AND unj.parent_type IN ('task', 'event')
  LEFT JOIN "0008-ap-deposit-ideas" di ON di.id = unj.parent_id AND unj.parent_type = 'depositIdea'
  LEFT JOIN "0008-ap-withdrawals" w ON w.id = unj.parent_id AND unj.parent_type = 'withdrawal'
  WHERE 
    n.user_id = p_user_id
    AND (
      (unj.parent_type IN ('task', 'event') AND DATE(t.completed_at) = p_date)
      OR (unj.parent_type = 'depositIdea' AND DATE(di.created_at) = p_date)
      OR (unj.parent_type = 'withdrawal' AND DATE(w.withdrawn_at) = p_date)
    )
  ORDER BY n.created_at DESC;
END;
$$;

-- Step 5: Add comment for clarity
COMMENT ON FUNCTION get_notes_for_reflection_date(uuid, date) IS 
  'Returns notes for a specific date with their parent_type (task, event, depositIdea, withdrawal)';

-- Verification queries (optional - comment out if not needed)
-- SELECT constraint_name, check_clause 
-- FROM information_schema.check_constraints 
-- WHERE constraint_name LIKE '%universal-notes-join%';

-- SELECT indexname, indexdef 
-- FROM pg_indexes 
-- WHERE tablename = '0008-ap-universal-notes-join';
