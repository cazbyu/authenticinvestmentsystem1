/*
  # Add Previous Cycle Reflection Start to v_global_cycles View

  ## Summary
  Updates the v_global_cycles view to include the previous cycle's reflection_start date.
  This enables the UI to correctly display when a 2nd_in_line timeline becomes available
  for activation (during the previous cycle's reflection week, not its own reflection week).

  ## Changes Made
  1. **Add previous_cycle_reflection_start Column**
     - For 2nd_in_line cycles: contains the active cycle's reflection_start date
     - For all other positions: NULL (not applicable)
     - Enables correct "Available starting" message in UI

  ## Example
  - Fall 2025: 28 Sep 2025 - 20 Dec 2025 (reflection: 14 Dec - 20 Dec)
  - Winter 2026: 28 Dec 2025 - 21 Mar 2026 (2nd in line)
  - Winter 2026 shows: "Available starting Dec 14" (Fall's reflection_start)
  - NOT: "Available starting Mar 22" (Winter's own reflection_start)

  ## Security
  - View maintains same RLS behavior as before
  - No new permissions required
*/

-- ============================================================
-- Recreate v_global_cycles view with previous cycle info
-- ============================================================
DROP VIEW IF EXISTS v_global_cycles CASCADE;

CREATE OR REPLACE VIEW v_global_cycles AS
WITH ordered_cycles AS (
  SELECT
    gc.id AS global_cycle_id,
    gc.title,
    gc.start_date,
    gc.end_date,
    gc.reflection_start,
    gc.reflection_end,
    COALESCE(gc.status, 'active') AS status,
    gc.created_at,
    ROW_NUMBER() OVER (ORDER BY gc.start_date) AS row_num
  FROM "0008-ap-global-cycles" AS gc
  WHERE COALESCE(gc.status, 'active') = 'active'
),
current_cycle AS (
  SELECT row_num
  FROM ordered_cycles
  WHERE CURRENT_DATE BETWEEN start_date AND reflection_end
  LIMIT 1
)
SELECT
  oc.global_cycle_id,
  oc.title,
  oc.start_date,
  oc.end_date,
  oc.reflection_start,
  oc.reflection_end,
  oc.status,
  oc.created_at,

  -- Determine cycle position
  CASE
    WHEN CURRENT_DATE BETWEEN oc.start_date AND oc.reflection_end THEN 'active'
    WHEN oc.row_num < COALESCE((SELECT row_num FROM current_cycle), 0) THEN 'archived'
    WHEN oc.row_num = COALESCE((SELECT row_num FROM current_cycle), 0) + 1 THEN '2nd_in_line'
    WHEN oc.row_num = COALESCE((SELECT row_num FROM current_cycle), 0) + 2 THEN '3rd_in_line'
    WHEN oc.row_num = COALESCE((SELECT row_num FROM current_cycle), 0) + 3 THEN '4th_in_line'
    ELSE 'future'
  END AS cycle_position,

  -- Determine if can activate
  -- Only 'active' and '2nd_in_line' can be activated
  -- '2nd_in_line' requires current date >= active timeline's reflection_start
  CASE
    -- Current active timeline can always be activated
    WHEN CURRENT_DATE BETWEEN oc.start_date AND oc.reflection_end THEN TRUE

    -- 2nd in line can be activated if we're in the reflection window of the previous (active) timeline
    WHEN oc.row_num = COALESCE((SELECT row_num FROM current_cycle), 0) + 1 THEN
      CASE
        WHEN CURRENT_DATE >= (
          SELECT reflection_start
          FROM ordered_cycles prev
          WHERE prev.row_num = COALESCE((SELECT row_num FROM current_cycle), 0)
        ) THEN TRUE
        ELSE FALSE
      END

    -- All other positions (3rd, 4th, archived, future) cannot be activated
    ELSE FALSE
  END AS can_activate,

  -- Add previous cycle's reflection_start for 2nd_in_line cycles
  -- This is when the 2nd_in_line cycle becomes available for activation
  CASE
    WHEN oc.row_num = COALESCE((SELECT row_num FROM current_cycle), 0) + 1 THEN
      (
        SELECT reflection_start
        FROM ordered_cycles prev
        WHERE prev.row_num = COALESCE((SELECT row_num FROM current_cycle), 0)
      )
    ELSE NULL
  END AS previous_cycle_reflection_start

FROM ordered_cycles AS oc
ORDER BY oc.start_date;

COMMENT ON VIEW v_global_cycles IS
  'Dynamic view that calculates global cycle positions and activation eligibility based on dates. Includes previous_cycle_reflection_start for 2nd_in_line cycles to show correct availability date in UI.';
