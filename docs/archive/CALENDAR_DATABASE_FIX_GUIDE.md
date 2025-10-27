# Calendar Database Fix Guide

## Overview

This guide explains the database fixes needed to resolve the issue where tasks/events don't show up in the CalendarView when navigating to past dates.

## Problem Analysis

The `v_tasks_with_recurrence_expanded` view had a filter that only returned occurrences where `occurrence_date >= CURRENT_DATE`. This prevented the calendar from displaying:
- Tasks from yesterday
- Events from last week
- Historical recurring task occurrences

When users navigated to past dates in the calendar, no tasks/events would appear.

## Solution

The fix involves two main changes:

### 1. Update `fn_expand_recurrence_dates` Function
Add a new parameter `p_max_past_days` (default 90 days) to support expanding recurring tasks into the past.

**Key Changes**:
- New parameter: `p_max_past_days integer DEFAULT 90`
- New variable: `v_start_window date` set to `CURRENT_DATE - p_max_past_days`
- All frequency types (DAILY, WEEKLY, MONTHLY, YEARLY) now check both start and end of the expansion window

### 2. Update `v_tasks_with_recurrence_expanded` View
Modify the view to pass the new parameter and remove the restrictive date filter.

**Key Changes**:
- Pass `90` as the 6th parameter to `fn_expand_recurrence_dates`
- This expands recurring tasks to show occurrences from the past 90 days
- Removed the `occurrence_date >= CURRENT_DATE` filter that was blocking historical dates

## SQL Script Location

The complete SQL script is provided in the previous message. Copy it into the Supabase SQL Editor and run it.

## Expansion Window

After applying the fix, the calendar will display:
- **Past dates**: 90 days back from today
- **Future dates**: 365 days forward from today
- **Total window**: ~455 days of task/event data

These values can be adjusted if needed:
- To show more history: Increase `90` in the view definition
- To show more future: Increase `365` in the view definition

## Performance Considerations

The 90-day past window is a reasonable trade-off between:
- **User needs**: Most calendar navigation stays within ±30 days
- **Performance**: Keeps the expansion calculation efficient
- **Database load**: Limits the number of virtual occurrences generated

## Testing After SQL Fix

### Manual Tests in Supabase SQL Editor:

```sql
-- Test 1: Verify function accepts new parameter
SELECT * FROM fn_expand_recurrence_dates(
  '2025-01-01'::date,
  'FREQ=DAILY;INTERVAL=1',
  NULL,
  '[]'::jsonb,
  30,  -- future days
  30   -- past days
);

-- Test 2: Check view returns past occurrences
SELECT
  title,
  occurrence_date,
  is_virtual_occurrence,
  recurrence_rule
FROM v_tasks_with_recurrence_expanded
WHERE recurrence_rule IS NOT NULL
  AND occurrence_date >= CURRENT_DATE - INTERVAL '7 days'
  AND occurrence_date <= CURRENT_DATE + INTERVAL '7 days'
ORDER BY occurrence_date;

-- Test 3: Verify no duplicate occurrences
SELECT
  source_task_id,
  occurrence_date,
  COUNT(*) as count
FROM v_tasks_with_recurrence_expanded
WHERE recurrence_rule IS NOT NULL
GROUP BY source_task_id, occurrence_date
HAVING COUNT(*) > 1;
```

### App-Level Tests:

1. **Daily View**:
   - Navigate to yesterday - should show tasks
   - Navigate to last week - should show tasks

2. **Weekly View**:
   - View last week - should show all tasks from that week
   - Navigate back 2-3 weeks - should still show tasks

3. **Monthly View**:
   - Select a date from last month - should show tasks
   - Click on dots in calendar - should display task list

4. **Recurring Tasks**:
   - Create a daily recurring task starting 30 days ago
   - Navigate to dates in the past - should see occurrences
   - Navigate to dates in the future - should see occurrences

## Rollback Plan

If issues arise, you can rollback by running this SQL:

```sql
-- Revert to original function (5 parameters)
CREATE OR REPLACE FUNCTION fn_expand_recurrence_dates(
  p_start_date date,
  p_recurrence_rule text,
  p_recurrence_end_date date,
  p_recurrence_exceptions jsonb DEFAULT '[]'::jsonb,
  p_max_future_days integer DEFAULT 365
)
-- ... (original function code from migration 20251019220255)
```

However, this will bring back the original issue where past dates don't show tasks.

## Related Files

- **Database**: `supabase/migrations/20251019220255_add_recurring_tasks_system.sql` (original)
- **Frontend**: `app/calendar.tsx` (queries the view)
- **Utilities**: `lib/recurrenceUtils.ts` (client-side expansion, not affected)

## Notes

- The frontend code in `calendar.tsx` doesn't need changes - it already queries by date range
- The `useRecurrenceCache` hooks will automatically benefit from the expanded view
- Dashboard views use `v_dashboard_next_occurrences` which only shows future dates (unchanged)
- Completed occurrences are still filtered out by the `NOT EXISTS` clause in the view
