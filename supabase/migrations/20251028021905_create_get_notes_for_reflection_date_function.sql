/*
  # Create function to get notes for reflection date
  
  1. New Function
    - `get_notes_for_reflection_date` - Gets all notes from tasks/items completed on a specific date
  
  2. Purpose
    - Fetch notes from completed tasks, deposit ideas, and other items that match the reflection date
    - Used to show contextual notes in the Reflections view
*/

CREATE OR REPLACE FUNCTION get_notes_for_reflection_date(
  p_user_id uuid,
  p_date date
)
RETURNS TABLE (
  id uuid,
  content text,
  created_at timestamptz
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    n.id,
    n.content,
    n.created_at
  FROM "0008-ap-notes" n
  JOIN "0008-ap-universal-notes-join" unj ON unj.note_id = n.id
  LEFT JOIN "0008-ap-tasks" t ON t.id = unj.parent_id AND unj.parent_type = 'task'
  LEFT JOIN "0008-ap-deposit-ideas" di ON di.id = unj.parent_id AND unj.parent_type = 'depositIdea'
  LEFT JOIN "0008-ap-withdrawals" w ON w.id = unj.parent_id AND unj.parent_type = 'withdrawal'
  WHERE 
    n.user_id = p_user_id
    AND (
      (unj.parent_type = 'task' AND DATE(t.completed_at) = p_date)
      OR (unj.parent_type = 'depositIdea' AND DATE(di.created_at) = p_date)
      OR (unj.parent_type = 'withdrawal' AND DATE(w.withdrawn_at) = p_date)
    )
  ORDER BY n.created_at DESC;
END;
$$;