/*
  # Daily History Items Function

  Provides a per-day list of reflections and note-backed items that align with
  the monthly history summary. Items are anchored to the local calendar day of
  the note's created_at timestamp so the Daily view, History index, and monthly
  totals remain consistent.
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
      fn.*,
      ROW_NUMBER() OVER (
        PARTITION BY fn.parent_type, fn.parent_id
        ORDER BY fn.created_at DESC, fn.note_id
      ) AS rn,
      COUNT(*) OVER (PARTITION BY fn.parent_type, fn.parent_id) AS notes_that_day
    FROM filtered_notes fn
  ),
  latest_notes AS (
    SELECT
      parent_type,
      parent_id,
      note_id,
      content,
      created_at,
      notes_that_day
    FROM ranked_notes
    WHERE rn = 1
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
      ln.note_id,
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
    SELECT
      'depositIdea'::text AS item_type,
      d.id AS parent_id,
      d.title AS item_title,
      ln.content AS item_content,
      ln.created_at AS item_created_at,
      ln.note_id,
      NULL::text AS parent_task_type,
      NULL::timestamptz AS parent_completed_at,
      NULL::boolean AS parent_is_urgent,
      NULL::boolean AS parent_is_important,
      d.archived AS parent_archived,
      COALESCE(d.is_active, true) AS parent_is_active,
      NULL::timestamptz AS parent_withdrawn_at,
      ln.notes_that_day AS notes_count
    FROM "0008-ap-deposit-ideas" d
    JOIN latest_notes ln
      ON ln.parent_id = d.id
     AND ln.parent_type = 'depositIdea'
    WHERE d.user_id = v_user_id
      AND d.archived = false
      AND COALESCE(d.is_active, true) = true
  ),
  withdrawal_rows AS (
    SELECT
      'withdrawal'::text AS item_type,
      w.id AS parent_id,
      COALESCE(NULLIF(btrim(w.title), ''), 'Withdrawal') AS item_title,
      ln.content AS item_content,
      ln.created_at AS item_created_at,
      ln.note_id,
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
  SELECT * FROM reflection_rows
  UNION ALL
  SELECT * FROM task_rows
  UNION ALL
  SELECT * FROM deposit_idea_rows
  UNION ALL
  SELECT * FROM withdrawal_rows
  ORDER BY item_created_at DESC;
END;
$$;

COMMENT ON FUNCTION get_daily_history_items(date, uuid) IS
  'Returns daily reflections and note-backed items anchored to the note''s local created_at date so all history views stay consistent.';

GRANT EXECUTE ON FUNCTION get_daily_history_items(date, uuid) TO authenticated;
