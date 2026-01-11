# Monthly History Function Fix Summary

**Date:** December 2, 2025
**Issue:** "No items recorded" appearing for all months despite having data

## Root Causes Identified

### 1. Boolean Comparison Error
**Problem:** Function was comparing boolean columns (`daily_rose`, `daily_thorn`) with empty strings
```sql
-- BROKEN
WHEN daily_rose <> '' THEN 'rose'  -- Invalid: comparing boolean to string

-- FIXED
WHEN daily_rose = true THEN 'rose'  -- Correct: boolean comparison
```
**Error:** `invalid input syntax for type boolean: ""`

### 2. STRING_AGG with DISTINCT and ORDER BY
**Problem:** PostgreSQL doesn't allow ORDER BY in STRING_AGG when using DISTINCT
```sql
-- BROKEN
STRING_AGG(DISTINCT '• ' || title, E'\n' ORDER BY title)

-- FIXED
STRING_AGG('• ' || title, E'\n' ORDER BY title)  -- Removed DISTINCT
```
**Error:** `in an aggregate with DISTINCT, ORDER BY expressions must appear in argument list`

### 3. Note Filter Date Logic
**Problem:** Function filtered notes by creation date within the month, causing items with retroactively-added notes to not appear
```sql
-- BROKEN: Only shows tasks if notes were created in the same month
WHERE (n.created_at AT TIME ZONE v_user_timezone)::date >= v_start_date
  AND (n.created_at AT TIME ZONE v_user_timezone)::date < v_end_date

-- FIXED: Shows tasks based on task date, regardless of when notes were added
-- Removed date filter from note_filter CTE entirely
```

### 4. Timezone Understanding
**Key Insight:** Tasks are displayed in the month they occurred in the user's timezone, not UTC
- Task created at `2025-10-01 04:00:20 UTC`
- User timezone: `America/Denver` (UTC-6/7)
- Displays as: `2025-09-30` (September 30th)

## Migrations Applied

1. **20251202230000_fix_boolean_comparison_in_monthly_history.sql**
   - Fixed boolean comparisons for `daily_rose` and `daily_thorn`

2. **20251202231500_fix_string_agg_distinct_order_by.sql**
   - Removed DISTINCT from STRING_AGG calls to allow ORDER BY

3. **20251202232000_fix_note_filter_date_logic.sql**
   - Removed note creation date filter from `note_filter` CTE
   - Items now appear based on when they occurred, not when notes were added

## Migration Cleanup

Archived 4 superseded migration files to `_archived/monthly_history_functions/`:
- `20251107031048_fix_monthly_dates_function_ambiguous_column.sql`
- `20251107230503_fix_timezone_and_add_reflection_titles.sql`
- `20251111120000_update_monthly_history_notes_filter.sql`
- `20251112090000_filter_monthly_history_to_real_notes.sql`

Kept only:
- `20251107030016_create_monthly_history_functions.sql` (original)
- `20251202221646_add_item_types_to_monthly_history.sql` (base for fixes)

## Current Behavior

The `get_month_dates_with_items` function now:

✅ Returns items based on when they occurred in the user's timezone
✅ Allows notes to be added retroactively without affecting item placement
✅ Properly handles boolean reflection types (rose/thorn/reflection)
✅ Only shows tasks/events/deposit ideas/withdrawals that have notes with content or attachments
✅ Always shows reflections (no note requirement)

## Testing

```sql
-- Test with September 2025
SELECT * FROM get_month_dates_with_items(2025, 9, 'user-id');

-- Returns:
-- item_date: 2025-09-30
-- tasks_count: 1
-- content_summary: "• Dummy Task"
-- item_details: [{"type":"note","title":"Dummy Task"}]
```

## Why "No items" Was Showing

Users were seeing "No items recorded" because:
1. Function had SQL syntax errors preventing execution
2. Notes date filter excluded items with retroactively-added notes
3. Timezone conversion caused items to appear in unexpected months

All issues are now resolved.
