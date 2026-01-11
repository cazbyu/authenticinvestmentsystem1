/*
  # Recreate Morning Spark Follow-Ups View

  1. Purpose
     - Drop existing simple view
     - Create comprehensive unified view for all follow-up items
     - Fetches from universal follow-up join table
     - Includes parent item details from tasks, deposit ideas, and reflections
     - Filters by follow_up_date <= today and status = pending

  2. Columns
     - follow_up_id: Follow-up record ID
     - user_id: User ID
     - parent_type: Type of parent item
     - parent_id: ID of parent item
     - title: Title of parent item
     - follow_up_date: Date of follow-up
     - status: Follow-up status
     - reason_type: Reason for follow-up
     - reason: Free-text reason
     - created_at: Follow-up creation date
     - completed_at: Parent completion date (for tasks/events)
     - archived: Parent archived status
*/

-- Drop existing view
DROP VIEW IF EXISTS v_morning_spark_follow_ups;

-- Create comprehensive view
CREATE OR REPLACE VIEW v_morning_spark_follow_ups AS
SELECT
  fu.id AS follow_up_id,
  fu.user_id,
  fu.parent_type,
  fu.parent_id,
  fu.follow_up_date,
  fu.status,
  fu.reason_type,
  fu.reason,
  fu.created_at,
  CASE
    WHEN fu.parent_type IN ('task', 'event') THEN t.title
    WHEN fu.parent_type = 'depositIdea' THEN di.title
    WHEN fu.parent_type = 'reflection' THEN r.reflection_title
    ELSE NULL
  END AS title,
  CASE
    WHEN fu.parent_type IN ('task', 'event') THEN t.completed_at
    ELSE NULL
  END AS completed_at,
  CASE
    WHEN fu.parent_type = 'depositIdea' THEN di.archived
    WHEN fu.parent_type = 'reflection' THEN r.archived
    ELSE false
  END AS archived
FROM "0008-ap-universal-follow-up-join" fu
LEFT JOIN "0008-ap-tasks" t
  ON fu.parent_type IN ('task', 'event')
  AND fu.parent_id = t.id
LEFT JOIN "0008-ap-deposit-ideas" di
  ON fu.parent_type = 'depositIdea'
  AND fu.parent_id = di.id
LEFT JOIN "0008-ap-reflections" r
  ON fu.parent_type = 'reflection'
  AND fu.parent_id = r.id
WHERE fu.status = 'pending'
  AND fu.follow_up_date <= CURRENT_DATE;

COMMENT ON VIEW v_morning_spark_follow_ups IS
  'Comprehensive unified view of all pending follow-ups for Morning Spark. Includes tasks, events, deposit ideas, and reflections with full metadata.';
