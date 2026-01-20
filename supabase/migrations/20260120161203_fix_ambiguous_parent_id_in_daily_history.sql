/*
  # Fix Ambiguous Column Reference in get_daily_history_items

  Fixes PostgreSQL error 42702: "column reference 'parent_id' is ambiguous"

  The issue was that column names in RETURNS TABLE were conflicting with
  column names used in JOINs within the CTEs.

  Changes:
  - Fully qualify all column references with table/CTE aliases
  - Ensure no ambiguity between RETURNS TABLE columns and CTE columns
*/

CREATE OR REPLACE FUNCTION get_daily_history_items(
  p_target_date date,
  p_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  item_type text,
  parent_id uuid,
  item_title text,
  item_content text,
  item_created_at timestamptz,
  note_id uuid,
  parent_task_type text,
  parent_completed_at timestamptz,
  parent_is_urgent boolean,
  parent_is_important boolean,
  parent_archived boolean,
  parent_is_active boolean,
  parent_withdrawn_at timestamptz,
  notes_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_user_timezone text;
  v_target_date date;
BEGIN
  v_user_id := COALESCE(p_user_id, auth.uid());

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User ID is required';
  END IF;

  IF p_target_date IS NULL THEN
    RAISE EXCEPTION 'Target date is required';
  END IF;

  SELECT COALESCE(timezone, 'UTC')
  INTO v_user_timezone
  FROM "0008-ap-users"
  WHERE id = v_user_id;

  v_user_timezone := COALESCE(v_user_timezone, 'UTC');
  v_target_date := p_target_date;

  RETURN QUERY
  WITH note_candidates AS (
    SELECT
      j.parent_type,
      j.parent_id,
      n.id AS note_id,
      n.content,
      n.created_at,
      (n.created_at AT TIME ZONE v_user_timezone)::date AS note_local_date
    FROM "0008-ap-universal-notes-join" j
    JOIN "0008-ap-notes" n ON n.id = j.note_id
    LEFT JOIN "0008-ap-note-attachments" na ON na.note_id = n.id
    WHERE j.user_id = v_user_id
      AND n.user_id = v_user_id
      AND (
        (n.content IS NOT NULL AND btrim(n.content) <> '')
        OR na.id IS NOT NULL
      )
  ),
  filtered_notes AS (
    SELECT
      nc.parent_type,
      nc.parent_id,
      nc.note_id,
      nc.content,
      nc.created_at,
      nc.note_local_date
    FROM note_candidates nc
    WHERE nc.note_local_date = v_target_date
  ),
  ranked_notes AS (
    SELECT
      fn.parent_type,
      fn.parent_id,
      fn.note_id,
      fn.content,
      fn.created_at,
      ROW_NUMBER() OVER (
        PARTITION BY fn.parent_type, fn.parent_id
        ORDER BY fn.created_at DESC, fn.note_id
      ) AS rn,
      COUNT(*) OVER (PARTITION BY fn.parent_type, fn.parent_id) AS notes_that_day
    FROM filtered_notes fn
  ),
  latest_notes AS (
    SELECT
      rn.parent_type,
      rn.parent_id,
      rn.note_id,
      rn.content,
      rn.created_at,
      rn.notes_that_day
    FROM ranked_notes rn
    WHERE rn.rn = 1
  ),
  reflection_rows AS (
    SELECT
      'reflection'::text AS item_type,
      r.id AS parent_id,
      COALESCE(NULLIF(btrim(r.reflection_title), ''), 'Reflection') AS item_title,
      r.content AS item_content,
      r.created_at AS item_created_at,
      NULL::uuid AS note_id,
      NULL::text AS parent_task_type,
      NULL::timestamptz AS parent_completed_at,
      NULL::boolean AS parent_is_urgent,
      NULL::boolean AS parent_is_important,
      NULL::boolean AS parent_archived,
      NULL::boolean AS parent_is_active,
      NULL::timestamptz AS parent_withdrawn_at,
      1 AS notes_count
    FROM "0008-ap-reflections" r
    WHERE r.user_id = v_user_id
      AND r.archived = false
      AND (r.created_at AT TIME ZONE v_user_timezone)::date = v_target_date
  ),
  task_rows AS (
    SELECT
      t.type AS item_type,
      t.id AS parent_id,
      t.title AS item_title,
      ln.content AS item_content,
      ln.created_at AS item_created_at,
      ln.note_id AS note_id,
      t.type AS parent_task_type,
      t.completed_at AS parent_completed_at,
      t.is_urgent AS parent_is_urgent,
      t.is_important AS parent_is_important,
      NULL::boolean AS parent_archived,
      NULL::boolean AS parent_is_active,
      NULL::timestamptz AS parent_withdrawn_at,
      ln.notes_that_day AS notes_count
    FROM "0008-ap-tasks" t
    JOIN latest_notes ln
      ON ln.parent_id = t.id
     AND ln.parent_type IN ('task', 'event')
    WHERE t.user_id = v_user_id
      AND t.deleted_at IS NULL
  ),
  deposit_idea_rows AS (
    -- Show ALL deposit ideas (activated AND not activated)
    SELECT
      'depositIdea'::text AS item_type,
      d.id AS parent_id,
      d.title AS item_title,
      ln.content AS item_content,
      ln.created_at AS item_created_at,
      ln.note_id AS note_id,
      NULL::text AS parent_task_type,
      NULL::timestamptz AS parent_completed_at,
      NULL::boolean AS parent_is_urgent,
      NULL::boolean AS parent_is_important,
      d.archived AS parent_archived,
      COALESCE(d.is_active, false) AS parent_is_active,
      NULL::timestamptz AS parent_withdrawn_at,
      ln.notes_that_day AS notes_count
    FROM "0008-ap-deposit-ideas" d
    JOIN latest_notes ln
      ON ln.parent_id = d.id
     AND ln.parent_type = 'depositIdea'
    WHERE d.user_id = v_user_id
      AND d.archived = false
  ),
  withdrawal_rows AS (
    SELECT
      'withdrawal'::text AS item_type,
      w.id AS parent_id,
      COALESCE(NULLIF(btrim(w.title), ''), 'Withdrawal') AS item_title,
      ln.content AS item_content,
      ln.created_at AS item_created_at,
      ln.note_id AS note_id,
      NULL::text AS parent_task_type,
      NULL::timestamptz AS parent_completed_at,
      NULL::boolean AS parent_is_urgent,
      NULL::boolean AS parent_is_important,
      NULL::boolean AS parent_archived,
      NULL::boolean AS parent_is_active,
      COALESCE(w.withdrawn_at, w.created_at) AS parent_withdrawn_at,
      ln.notes_that_day AS notes_count
    FROM "0008-ap-withdrawals" w
    JOIN latest_notes ln
      ON ln.parent_id = w.id
     AND ln.parent_type = 'withdrawal'
    WHERE w.user_id = v_user_id
  )
  SELECT
    rr.item_type,
    rr.parent_id,
    rr.item_title,
    rr.item_content,
    rr.item_created_at,
    rr.note_id,
    rr.parent_task_type,
    rr.parent_completed_at,
    rr.parent_is_urgent,
    rr.parent_is_important,
    rr.parent_archived,
    rr.parent_is_active,
    rr.parent_withdrawn_at,
    rr.notes_count
  FROM reflection_rows rr
  UNION ALL
  SELECT
    tr.item_type,
    tr.parent_id,
    tr.item_title,
    tr.item_content,
    tr.item_created_at,
    tr.note_id,
    tr.parent_task_type,
    tr.parent_completed_at,
    tr.parent_is_urgent,
    tr.parent_is_important,
    tr.parent_archived,
    tr.parent_is_active,
    tr.parent_withdrawn_at,
    tr.notes_count
  FROM task_rows tr
  UNION ALL
  SELECT
    dir.item_type,
    dir.parent_id,
    dir.item_title,
    dir.item_content,
    dir.item_created_at,
    dir.note_id,
    dir.parent_task_type,
    dir.parent_completed_at,
    dir.parent_is_urgent,
    dir.parent_is_important,
    dir.parent_archived,
    dir.parent_is_active,
    dir.parent_withdrawn_at,
    dir.notes_count
  FROM deposit_idea_rows dir
  UNION ALL
  SELECT
    wr.item_type,
    wr.parent_id,
    wr.item_title,
    wr.item_content,
    wr.item_created_at,
    wr.note_id,
    wr.parent_task_type,
    wr.parent_completed_at,
    wr.parent_is_urgent,
    wr.parent_is_important,
    wr.parent_archived,
    wr.parent_is_active,
    wr.parent_withdrawn_at,
    wr.notes_count
  FROM withdrawal_rows wr
  ORDER BY item_created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_daily_history_items(date, uuid) TO authenticated;