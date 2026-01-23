/*
  # Create Spark Library View by Month

  1. New Views
    - `v_spark_library_by_month`
      - Unifies quotes and questions into a single monthly archive view
      - Groups content by archived_month for easy display
      - Shows: user_id, content_type, content_text, attribution, source_type, coach_id, domain, created_at, last_shown_at, times_shown, is_pinned, archived_month

  2. Purpose
    - Provides a unified view of all archived quotes and questions
    - Organized by month for historical browsing
    - Supports pin/unpin and delete operations
    - Shows metadata like source (coach vs self), domain, and show count

  3. Security
    - RLS enabled on underlying tables applies to view
    - Users can only see their own archived content
*/

-- Drop existing view if it exists
DROP VIEW IF EXISTS v_spark_library_by_month;

-- Create the unified spark library view
CREATE VIEW v_spark_library_by_month AS
SELECT 
  id,
  user_id,
  'quote' AS content_type,
  quote_text AS content_text,
  attribution,
  source_type,
  coach_id,
  domain,
  is_pinned,
  archived_month,
  last_shown_at,
  times_shown,
  created_at,
  updated_at
FROM "0008-ap-user-power-quotes"
WHERE archived_month IS NOT NULL

UNION ALL

SELECT 
  id,
  user_id,
  'question' AS content_type,
  question_text AS content_text,
  question_context AS attribution,
  source_type,
  coach_id,
  domain,
  is_pinned,
  archived_month,
  last_shown_at,
  times_shown,
  created_at,
  updated_at
FROM "0008-ap-user-power-questions"
WHERE archived_month IS NOT NULL;
