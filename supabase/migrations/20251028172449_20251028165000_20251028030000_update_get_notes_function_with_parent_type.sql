/*
  # Update get_notes_for_reflection_date to return parent_type (FIXED)

  1. Changes
    - Add parent_type column to return table
    - Return actual task type (task or event) from 0008-ap-tasks.type column with proper casting
    - Return parent_type for depositIdea and withdrawal as-is

  2. Purpose
    - Enable UI to display correct badges (Task vs Event vs Deposit Idea vs Withdrawal)
    - Distinguish between tasks and events which are both stored in 0008-ap-tasks table

  3. Fix
    - Cast t.type::text to handle ENUM type properly
*/

CREATE OR REPLACE FUNCTION get_notes_for_reflection_date(
  p_user_id uuid,
  p_date date
)
RETURNS TABLE (
  id uuid,
  parent_id uuid,
  content text,
  created_at timestamptz,
  parent_type text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Enforce deleted/archived parent filtering here so downstream UI never
  -- receives orphaned notes.
  RETURN QUERY
  SELECT DISTINCT
    n.id,
    unj.parent_id,
    n.content,
    n.created_at,
    -- Return the actual type from tasks table for tasks/events, or the join table parent_type for others
    CASE
      WHEN unj.parent_type = 'task' THEN t.type::text
      ELSE unj.parent_type
    END AS parent_type
  FROM "0008-ap-notes" n
  JOIN "0008-ap-universal-notes-join" unj ON unj.note_id = n.id
  LEFT JOIN "0008-ap-tasks" t ON t.id = unj.parent_id AND unj.parent_type = 'task'
  LEFT JOIN "0008-ap-deposit-ideas" di ON di.id = unj.parent_id AND unj.parent_type = 'depositIdea'
  LEFT JOIN "0008-ap-withdrawals" w ON w.id = unj.parent_id AND unj.parent_type = 'withdrawal'
  WHERE
    n.user_id = p_user_id
    AND (
      (
        unj.parent_type = 'task'
        AND t.deleted_at IS NULL
        AND DATE(t.completed_at) = p_date
      )
      OR (
        unj.parent_type = 'depositIdea'
        AND di.archived = false
        AND COALESCE(di.is_active, true) = true
        AND DATE(di.created_at) = p_date
      )
      OR (
        unj.parent_type = 'withdrawal'
        AND DATE(w.withdrawn_at) = p_date
      )
    )
  ORDER BY n.created_at DESC;
END;
$$;