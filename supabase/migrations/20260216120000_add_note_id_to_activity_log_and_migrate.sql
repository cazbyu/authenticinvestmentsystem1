-- Migration: Integrate activity log notes into universal notes system
-- Adds note_id column to link activity log entries to 0008-ap-notes
-- Migrates existing inline notes to the universal notes system

-- ============================================================
-- 1. Add note_id column to 0008-ap-activity-log
-- ============================================================

ALTER TABLE "0008-ap-activity-log"
  ADD COLUMN IF NOT EXISTS note_id uuid DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_activity_log_note_id
  ON "0008-ap-activity-log"(note_id);

-- ============================================================
-- 2. Migrate existing inline notes to universal notes system
-- ============================================================
-- For each activity log row with notes, create a universal note
-- linked to the parent task via the join table.
-- Idempotent: skips rows that already have a note_id.

DO $$
DECLARE
  r RECORD;
  v_note_id uuid;
  v_enriched_content text;
BEGIN
  FOR r IN
    SELECT al.id, al.user_id, al.task_id, al.log_date, al.template_type, al.notes
    FROM "0008-ap-activity-log" al
    WHERE al.notes IS NOT NULL
      AND btrim(al.notes) != ''
      AND al.note_id IS NULL
  LOOP
    -- Build enriched content with context prefix
    v_enriched_content := '[Activity Log - ' ||
      to_char(r.log_date, 'Mon DD, YYYY') || ' | ' ||
      initcap(replace(r.template_type, '_', ' ')) || '] ' || r.notes;

    -- Insert into universal notes table
    INSERT INTO "0008-ap-notes" (user_id, content)
    VALUES (r.user_id, v_enriched_content)
    RETURNING id INTO v_note_id;

    -- Link to parent task via join table
    INSERT INTO "0008-ap-universal-notes-join" (parent_id, parent_type, note_id, user_id)
    VALUES (r.task_id, 'task', v_note_id, r.user_id);

    -- Update activity log row with the note reference
    UPDATE "0008-ap-activity-log"
    SET note_id = v_note_id
    WHERE id = r.id;
  END LOOP;
END $$;
