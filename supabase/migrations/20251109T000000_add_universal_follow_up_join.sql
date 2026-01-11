-- 20251109T000000_add_universal_follow_up_join.sql
-- Purpose:
--   Create a universal follow-up table that can attach follow-ups to
--   reflections, tasks, events, deposit ideas, withdrawals, and goals.
--   This becomes the single backbone for "things I need to see again"
--   across the app (GTD-style follow-ups / tickler file).

-----------------------------
-- 1. TABLE DEFINITION
-----------------------------

CREATE TABLE IF NOT EXISTS public."0008-ap-universal-follow-up-join" (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  parent_type text NOT NULL,
  parent_id uuid NOT NULL,
  follow_up_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  reason_type text NULL,   -- 'review' | 'decide' | 'check_outcome' | 'waiting_for' | 'other'
  reason text NULL,        -- free-text explanation
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz NULL,

  CONSTRAINT "0008-ap-universal-follow-up-join_pkey"
    PRIMARY KEY (id),

  -- Restrict to known parent types in your ecosystem
  CONSTRAINT "0008-ap-universal-follow-up-join_parent_type_check"
    CHECK (
      parent_type = ANY (ARRAY[
        'task'::text,
        'event'::text,
        'depositIdea'::text,
        'withdrawal'::text,
        'goal'::text,
        'custom_goal'::text,
        '1y_goal'::text,
        'reflection'::text
      ])
    ),

  -- Status lifecycle for GTD-like behavior
  CONSTRAINT "0008-ap-universal-follow-up-join_status_check"
    CHECK (
      status = ANY (ARRAY[
        'pending'::text,
        'snoozed'::text,
        'done'::text,
        'cancelled'::text
      ])
    ),

  -- Optional typed reason (GTD-style "why does this exist?")
  CONSTRAINT "0008-ap-universal-follow-up-join_reason_type_check"
    CHECK (
      reason_type IS NULL OR reason_type = ANY (ARRAY[
        'review'::text,
        'decide'::text,
        'check_outcome'::text,
        'waiting_for'::text,
        'other'::text
      ])
    )
);

-----------------------------
-- 2. INDEXES
-----------------------------

-- Fast lookup for a specific parent (reflection, task, etc.)
CREATE INDEX IF NOT EXISTS "0008-ap-universal-follow-up-join_parent_id_parent_type_idx"
ON public."0008-ap-universal-follow-up-join" (parent_id, parent_type);

-- Fast queries for a user's upcoming follow-ups
CREATE INDEX IF NOT EXISTS "0008-ap-universal-follow-up-join_user_date_status_idx"
ON public."0008-ap-universal-follow-up-join" (user_id, follow_up_date, status);

-- General user_id index
CREATE INDEX IF NOT EXISTS "0008-ap-universal-follow-up-join_user_id_idx"
ON public."0008-ap-universal-follow-up-join" (user_id);

-----------------------------
-- 3. RLS: ROW LEVEL SECURITY
-----------------------------

ALTER TABLE public."0008-ap-universal-follow-up-join"
  ENABLE ROW LEVEL SECURITY;

-- Users can SELECT only their own follow-ups
CREATE POLICY "select_own_follow_ups"
ON public."0008-ap-universal-follow-up-join"
FOR SELECT
USING (user_id = auth.uid());

-- Users can INSERT only follow-ups that belong to themselves
CREATE POLICY "insert_own_follow_ups"
ON public."0008-ap-universal-follow-up-join"
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Users can UPDATE only their own follow-ups
CREATE POLICY "update_own_follow_ups"
ON public."0008-ap-universal-follow-up-join"
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Optional: allow users to DELETE their own follow-ups
CREATE POLICY "delete_own_follow_ups"
ON public."0008-ap-universal-follow-up-join"
FOR DELETE
USING (user_id = auth.uid());

-----------------------------
-- 4. OPTIONAL: PARENT VALIDATION TRIGGER
-----------------------------
-- If you already use a validate_universal_notes_parent() function,
-- you can create a similar one for follow-ups to ensure parent_id +
-- parent_type actually points at a real row in the appropriate table.
--
-- This is OPTIONAL but nice for integrity. If you don't want it now,
-- you can skip this section.

-- Example stub (adapt/expand as needed):
CREATE OR REPLACE FUNCTION public.validate_universal_follow_up_parent()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  _exists boolean;
BEGIN
  -- Check that the parent exists in the appropriate table.
  -- Extend this CASE as needed when you add more parent types.

  CASE NEW.parent_type
    WHEN 'task' THEN
      SELECT TRUE INTO _exists
      FROM public."0008-ap-tasks"
      WHERE id = NEW.parent_id;

    WHEN 'event' THEN
      SELECT TRUE INTO _exists
      FROM public."0008-ap-tasks"
      WHERE id = NEW.parent_id AND type = 'event';

    WHEN 'depositIdea' THEN
      SELECT TRUE INTO _exists
      FROM public."0008-ap-tasks"
      WHERE id = NEW.parent_id AND type = 'depositIdea';

    WHEN 'withdrawal' THEN
      SELECT TRUE INTO _exists
      FROM public."0008-ap-withdrawals"
      WHERE id = NEW.parent_id;

    WHEN 'goal' THEN
      SELECT TRUE INTO _exists
      FROM public."0008-ap-goals-12wk"
      WHERE id = NEW.parent_id;

    WHEN 'custom_goal' THEN
      SELECT TRUE INTO _exists
      FROM public."0008-ap-goals-custom"
      WHERE id = NEW.parent_id;

    WHEN '1y_goal' THEN
      SELECT TRUE INTO _exists
      FROM public."0008-ap-goals-1y"
      WHERE id = NEW.parent_id;

    WHEN 'reflection' THEN
      SELECT TRUE INTO _exists
      FROM public."0008-ap-reflections"
      WHERE id = NEW.parent_id;

    ELSE
      _exists := FALSE;
  END CASE;

  IF NOT COALESCE(_exists, FALSE) THEN
    RAISE EXCEPTION 'Invalid parent_id % for parent_type % in universal follow-up join',
      NEW.parent_id, NEW.parent_type;
  END IF;

  RETURN NEW;
END;
$$;

-- Create constraint trigger (deferrable like your notes join)
CREATE CONSTRAINT TRIGGER trg_validate_universal_follow_up_parent
AFTER INSERT OR UPDATE ON public."0008-ap-universal-follow-up-join"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.validate_universal_follow_up_parent();

-----------------------------
-- 5. BACKFILL EXISTING REFLECTION FOLLOW-UPS
-----------------------------
-- If you already have follow_up + follow_up_date on 0008-ap-reflections,
-- migrate those into the new universal table as PENDING reflection follow-ups.

INSERT INTO public."0008-ap-universal-follow-up-join" (
  user_id,
  parent_type,
  parent_id,
  follow_up_date,
  status,
  reason_type,
  reason
)
SELECT
  r.user_id,
  'reflection'::text AS parent_type,
  r.id AS parent_id,
  r.follow_up_date::date,
  'pending'::text AS status,
  NULL::text AS reason_type,
  NULL::text AS reason
FROM public."0008-ap-reflections" r
WHERE r.follow_up = true
  AND r.follow_up_date IS NOT NULL
  AND r.archived = false;

-- (Optional) You can later stop writing follow_up/follow_up_date on reflections
-- in your app code once everything uses this table.
