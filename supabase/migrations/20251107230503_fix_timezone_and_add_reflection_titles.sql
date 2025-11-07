/*
  # Fix Timezone Date Grouping and Add Reflection Title Columns

  1. Changes
    - Fix timezone handling in get_month_dates_with_items to use user's timezone (America/Denver)
    - Add reflection_title, title_generated_at, and title_generation_method columns
    - Update function to include reflection titles in content summary
    - Fix date grouping to convert UTC timestamps to user's local date before grouping

  2. New Columns
    - `reflection_title` (TEXT, nullable) - AI-generated or manual title for reflection
    - `title_generated_at` (TIMESTAMPTZ, nullable) - When the title was generated
    - `title_generation_method` (TEXT, default 'ai') - How title was created ('ai' or 'manual')

  3. Security
    - RLS policies automatically cover new columns (same table)
    - Function maintains existing auth.uid() filtering

  4. Performance
    - Add index on reflection_title for search functionality
    - Timezone conversion is efficient with indexed created_at column
*/

-- Add reflection title columns to 0008-ap-reflections table
ALTER TABLE "0008-ap-reflections"
ADD COLUMN IF NOT EXISTS reflection_title TEXT,
ADD COLUMN IF NOT EXISTS title_generated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS title_generation_method TEXT DEFAULT 'ai';

-- Add index on reflection_title for search performance
CREATE INDEX IF NOT EXISTS idx_reflections_title
  ON "0008-ap-reflections"(reflection_title)
  WHERE reflection_title IS NOT NULL;

-- Add comment to explain the columns
COMMENT ON COLUMN "0008-ap-reflections".reflection_title IS
  'AI-generated or manually entered title for the reflection (max 60 chars recommended)';
COMMENT ON COLUMN "0008-ap-reflections".title_generated_at IS
  'Timestamp when the title was generated';
COMMENT ON COLUMN "0008-ap-reflections".title_generation_method IS
  'Method used to create title: "ai" (OpenAI generated) or "manual" (user entered)';

-- Drop and recreate get_month_dates_with_items with proper timezone handling
CREATE OR REPLACE FUNCTION get_month_dates_with_items(
  p_year integer,
  p_month integer,
  p_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  item_date date,
  reflections_count bigint,
  tasks_count bigint,
  events_count bigint,
  deposit_ideas_count bigint,
  withdrawals_count bigint,
  notes_count bigint,
  content_summary text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_user_timezone text;
  v_start_date date;
  v_end_date date;
BEGIN
  -- Get user ID
  v_user_id := COALESCE(p_user_id, auth.uid());

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User ID is required';
  END IF;

  -- Get user's timezone from their profile (defaults to UTC if not set)
  SELECT COALESCE(timezone, 'UTC')
  INTO v_user_timezone
  FROM "0008-ap-users"
  WHERE id = v_user_id;

  -- If user doesn't have a profile yet, use UTC as default
  v_user_timezone := COALESCE(v_user_timezone, 'UTC');

  -- Calculate date range for the requested month
  v_start_date := make_date(p_year, p_month, 1);
  v_end_date := (v_start_date + INTERVAL '1 month')::date;

  RETURN QUERY
  WITH daily_reflections AS (
    SELECT
      -- Convert UTC timestamp to user's timezone, then cast to date
      (created_at AT TIME ZONE v_user_timezone)::date AS date_val,
      COUNT(*) AS count_val,
      -- Prioritize reflection_title over content snippet
      STRING_AGG(
        COALESCE(reflection_title, SUBSTRING(content, 1, 50)),
        ' | '
      ) AS summary_val
    FROM "0008-ap-reflections"
    WHERE user_id = v_user_id
      AND archived = false
      AND (created_at AT TIME ZONE v_user_timezone)::date >= v_start_date
      AND (created_at AT TIME ZONE v_user_timezone)::date < v_end_date
    GROUP BY (created_at AT TIME ZONE v_user_timezone)::date
  ),
  daily_tasks AS (
    SELECT
      -- Use completed_at if available, otherwise created_at, both converted to user timezone
      (COALESCE(completed_at, created_at) AT TIME ZONE v_user_timezone)::date AS date_val,
      COUNT(*) AS count_val,
      STRING_AGG(title, ', ') AS summary_val
    FROM "0008-ap-tasks"
    WHERE user_id = v_user_id
      AND type = 'task'
      AND deleted_at IS NULL
      AND (COALESCE(completed_at, created_at) AT TIME ZONE v_user_timezone)::date >= v_start_date
      AND (COALESCE(completed_at, created_at) AT TIME ZONE v_user_timezone)::date < v_end_date
    GROUP BY (COALESCE(completed_at, created_at) AT TIME ZONE v_user_timezone)::date
  ),
  daily_events AS (
    SELECT
      (COALESCE(completed_at, created_at) AT TIME ZONE v_user_timezone)::date AS date_val,
      COUNT(*) AS count_val,
      STRING_AGG(title, ', ') AS summary_val
    FROM "0008-ap-tasks"
    WHERE user_id = v_user_id
      AND type = 'event'
      AND deleted_at IS NULL
      AND (COALESCE(completed_at, created_at) AT TIME ZONE v_user_timezone)::date >= v_start_date
      AND (COALESCE(completed_at, created_at) AT TIME ZONE v_user_timezone)::date < v_end_date
    GROUP BY (COALESCE(completed_at, created_at) AT TIME ZONE v_user_timezone)::date
  ),
  daily_deposit_ideas AS (
    SELECT
      (created_at AT TIME ZONE v_user_timezone)::date AS date_val,
      COUNT(*) AS count_val,
      STRING_AGG(title, ', ') AS summary_val
    FROM "0008-ap-deposit-ideas"
    WHERE user_id = v_user_id
      AND (created_at AT TIME ZONE v_user_timezone)::date >= v_start_date
      AND (created_at AT TIME ZONE v_user_timezone)::date < v_end_date
    GROUP BY (created_at AT TIME ZONE v_user_timezone)::date
  ),
  daily_withdrawals AS (
    SELECT
      (withdrawn_at AT TIME ZONE v_user_timezone)::date AS date_val,
      COUNT(*) AS count_val,
      STRING_AGG(COALESCE(title, 'Withdrawal'), ', ') AS summary_val
    FROM "0008-ap-withdrawals"
    WHERE user_id = v_user_id
      AND (withdrawn_at AT TIME ZONE v_user_timezone)::date >= v_start_date
      AND (withdrawn_at AT TIME ZONE v_user_timezone)::date < v_end_date
    GROUP BY (withdrawn_at AT TIME ZONE v_user_timezone)::date
  ),
  daily_notes AS (
    SELECT
      (n.created_at AT TIME ZONE v_user_timezone)::date AS date_val,
      COUNT(DISTINCT n.id) AS count_val,
      STRING_AGG(DISTINCT SUBSTRING(n.content, 1, 30), ', ') AS summary_val
    FROM "0008-ap-notes" n
    INNER JOIN "0008-ap-universal-notes-join" unj ON unj.note_id = n.id
    WHERE unj.user_id = v_user_id
      AND (n.created_at AT TIME ZONE v_user_timezone)::date >= v_start_date
      AND (n.created_at AT TIME ZONE v_user_timezone)::date < v_end_date
    GROUP BY (n.created_at AT TIME ZONE v_user_timezone)::date
  ),
  all_dates AS (
    SELECT DISTINCT date_val FROM daily_reflections
    UNION
    SELECT DISTINCT date_val FROM daily_tasks
    UNION
    SELECT DISTINCT date_val FROM daily_events
    UNION
    SELECT DISTINCT date_val FROM daily_deposit_ideas
    UNION
    SELECT DISTINCT date_val FROM daily_withdrawals
    UNION
    SELECT DISTINCT date_val FROM daily_notes
  )
  SELECT
    ad.date_val AS item_date,
    COALESCE(dr.count_val, 0) AS reflections_count,
    COALESCE(dt.count_val, 0) AS tasks_count,
    COALESCE(de.count_val, 0) AS events_count,
    COALESCE(ddi.count_val, 0) AS deposit_ideas_count,
    COALESCE(dw.count_val, 0) AS withdrawals_count,
    COALESCE(dn.count_val, 0) AS notes_count,
    COALESCE(
      CONCAT_WS(' • ',
        NULLIF(dr.summary_val, ''),
        NULLIF(dt.summary_val, ''),
        NULLIF(de.summary_val, ''),
        NULLIF(ddi.summary_val, ''),
        NULLIF(dw.summary_val, ''),
        NULLIF(dn.summary_val, '')
      ),
      'No content'
    ) AS content_summary
  FROM all_dates ad
  LEFT JOIN daily_reflections dr ON dr.date_val = ad.date_val
  LEFT JOIN daily_tasks dt ON dt.date_val = ad.date_val
  LEFT JOIN daily_events de ON de.date_val = ad.date_val
  LEFT JOIN daily_deposit_ideas ddi ON ddi.date_val = ad.date_val
  LEFT JOIN daily_withdrawals dw ON dw.date_val = ad.date_val
  LEFT JOIN daily_notes dn ON dn.date_val = ad.date_val
  ORDER BY ad.date_val ASC;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_month_dates_with_items TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION get_month_dates_with_items IS
  'Returns dates with content counts for a specific month. Converts all UTC timestamps to user timezone before date grouping. Includes AI-generated reflection titles in content summary.';
