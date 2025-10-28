# Midnight Task Display and Blocking Implementation

## Overview
This implementation ensures that recurring tasks appear at **12:01 AM (00:01) local time** on their due date, and implements blocking logic where **ALL future occurrences are hidden if ANY previous occurrence is incomplete**.

## What Was Implemented

### 1. Database Functions (Migration: `20251028230000_implement_midnight_task_display_and_blocking.sql`)

#### Function: `fn_get_local_midnight_boundary(p_user_id UUID)`
- **Purpose**: Returns the start of the current day (00:00:00) in the user's local timezone
- **How it works**:
  - Retrieves the user's timezone from the `0008-ap-users` table
  - Converts `CURRENT_TIMESTAMP` to the user's timezone
  - Truncates to midnight (00:00:00)
  - Returns a timezone-aware timestamp
- **Default**: Uses 'UTC' if user timezone is not set

#### Function: `fn_has_incomplete_previous_occurrences(p_source_task_id UUID, p_current_occurrence_date DATE)`
- **Purpose**: Checks if there are any incomplete previous occurrences that should block future dates
- **How it works**:
  - Queries `v_tasks_with_recurrence_expanded` to find all virtual occurrences before the current date
  - For each previous occurrence, checks if it has been:
    - Completed (exists in `0008-ap-tasks` with `status = 'completed'`)
    - Manually deleted (exists in the `recurrence_exceptions` array)
  - Returns `TRUE` if any previous occurrence is incomplete and not deleted
  - Returns `FALSE` if all previous occurrences are either completed or in recurrence_exceptions
- **Key feature**: Manual deletions (via `recurrence_exceptions`) do NOT block future dates

### 2. Updated Database View: `v_dashboard_next_occurrences`

The view now implements two-layer filtering:

#### Layer 1: Time-Based Filtering (12:01 AM Threshold)
```sql
(occurrence_date::TIMESTAMP + TIME '00:01:00') <= CURRENT_TIMESTAMP AT TIME ZONE user_timezone
```
- Adds 1 minute (00:01) to the occurrence date
- Compares against current timestamp in the user's local timezone
- Only shows tasks after 12:01 AM on their due date

#### Layer 2: Blocking Logic
```sql
AND NOT fn_has_incomplete_previous_occurrences(source_task_id, occurrence_date)
```
- Calls the blocking function for each recurring task occurrence
- Hides ALL future occurrences if ANY previous occurrence is incomplete
- Respects manual deletions (recurrence_exceptions)

#### Non-Recurring Tasks
- Non-recurring tasks (where `recurrence_rule IS NULL`) are included via UNION ALL
- They bypass both time-based and blocking filters
- They appear immediately when created, regardless of time

### 3. Performance Optimizations

Two composite indexes were added:

```sql
CREATE INDEX idx_tasks_parent_due_status
ON "0008-ap-tasks" (parent_task_id, due_date, status)
WHERE deleted_at IS NULL;

CREATE INDEX idx_tasks_source_occurrence
ON "0008-ap-tasks" (parent_task_id, due_date)
WHERE status = 'completed' AND deleted_at IS NULL;
```

These indexes optimize:
- Looking up completed occurrences for blocking checks
- Filtering by parent_task_id and due_date
- Excluding soft-deleted tasks

### 4. Frontend: Automatic Midnight Refresh

Added to `app/(tabs)/dashboard.tsx`:

```typescript
useEffect(() => {
  const scheduleNextMidnightRefresh = () => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 1, 0, 0); // Set to 12:01 AM

    const msUntilMidnight = tomorrow.getTime() - now.getTime();

    const timeoutId = setTimeout(() => {
      console.log('[Dashboard] Midnight refresh triggered - fetching new tasks');
      fetchData();
      scheduleNextMidnightRefresh(); // Schedule next refresh
    }, msUntilMidnight);

    return timeoutId;
  };

  let midnightTimeoutId: NodeJS.Timeout | null = null;
  if (activeView === 'deposits') {
    midnightTimeoutId = scheduleNextMidnightRefresh();
  }

  return () => {
    if (midnightTimeoutId) {
      clearTimeout(midnightTimeoutId);
    }
  };
}, [activeView, fetchData]);
```

**How it works**:
- Calculates milliseconds until 12:01 AM local time
- Sets a timeout to trigger `fetchData()` at exactly 12:01 AM
- After refresh, automatically schedules the next midnight refresh
- Only active when viewing the 'deposits' tab
- Cleans up timeout on component unmount

## Behavior Examples

### Example 1: Daily Recurring Task
**Setup**: Task repeats daily at 8:00 AM
**Timeline**:
- Monday 12:00 AM: Task not yet visible
- Monday 12:01 AM: Task appears on dashboard
- Monday 9:00 AM: User completes the task
- Tuesday 12:01 AM: Next occurrence appears automatically

### Example 2: Blocking Due to Incomplete Task
**Setup**: Task repeats daily
**Timeline**:
- Monday 12:01 AM: Monday's occurrence appears
- Monday 11:59 PM: User did NOT complete Monday's task
- Tuesday 12:01 AM: Tuesday's occurrence does NOT appear (blocked by incomplete Monday)
- Tuesday 9:00 AM: User completes Monday's occurrence
- Tuesday 9:00 AM: Tuesday's occurrence immediately appears (unblocked)

### Example 3: Manual Deletion Does Not Block
**Setup**: Task repeats daily
**Timeline**:
- Monday 12:01 AM: Monday's occurrence appears
- Monday 10:00 AM: User manually deletes Monday's occurrence
- Monday 10:00 AM: Date added to `recurrence_exceptions` array
- Tuesday 12:01 AM: Tuesday's occurrence appears normally (not blocked)

### Example 4: Timezone Handling
**Setup**: User timezone is "America/New_York" (EST)
**Timeline**:
- Server time: 05:01 UTC (Tuesday)
- User's local time: 00:01 EST (Tuesday)
- Task scheduled for Tuesday appears at user's 12:01 AM EST
- Database correctly converts UTC to EST for comparison

## Technical Details

### Timezone Handling
- All time calculations respect the user's timezone from `0008-ap-users.timezone`
- If timezone is NULL, defaults to 'UTC'
- Uses PostgreSQL's `AT TIME ZONE` for accurate timezone conversion
- Handles daylight saving time transitions automatically

### Recurrence Exceptions
- Stored as a DATE array in `0008-ap-tasks.recurrence_exceptions`
- When user deletes a single occurrence, the date is added to this array
- The blocking function checks this array before marking an occurrence as incomplete
- Allows users to skip occurrences without blocking future dates

### Performance Considerations
- Database-level filtering reduces data transfer to frontend
- Composite indexes speed up occurrence lookups
- Frontend only refreshes once per day (at midnight)
- View calculations are cached by PostgreSQL

## Testing Recommendations

### Test Scenarios
1. **Basic midnight appearance**: Verify tasks appear at 12:01 AM local time
2. **Blocking behavior**: Skip a task and verify future occurrences are hidden
3. **Unblocking**: Complete the skipped task and verify future occurrences appear
4. **Manual deletion**: Delete an occurrence and verify it doesn't block future dates
5. **Timezone changes**: Change user timezone and verify midnight refresh adjusts
6. **Multiple incomplete**: Skip multiple days and verify ALL future dates remain hidden
7. **Non-recurring tasks**: Verify they appear immediately regardless of time
8. **Dashboard refresh**: Stay on dashboard past midnight and verify auto-refresh

### Manual Testing
```sql
-- Check your timezone setting
SELECT timezone FROM "0008-ap-users" WHERE id = 'your-user-id';

-- Check midnight boundary calculation
SELECT fn_get_local_midnight_boundary('your-user-id');

-- Check if a task has incomplete previous occurrences
SELECT fn_has_incomplete_previous_occurrences('task-id', 'YYYY-MM-DD');

-- View all recurring tasks and their next occurrences
SELECT * FROM v_dashboard_next_occurrences
WHERE user_id = 'your-user-id' AND recurrence_rule IS NOT NULL;
```

## Migration Details

**File**: `/supabase/migrations/20251028230000_implement_midnight_task_display_and_blocking.sql`

**Applied**: Successfully applied to database

**Verification Output**:
```
✓ Function fn_get_local_midnight_boundary created
✓ Function fn_has_incomplete_previous_occurrences created
✓ View v_dashboard_next_occurrences recreated with midnight and blocking logic
✓ Performance indexes added

Tasks will now appear at 12:01 AM local time on their due date
Future occurrences are hidden if ANY previous occurrence is incomplete
Manual deletions (recurrence_exceptions) do not block future dates
```

## Compatibility

### Database Requirements
- PostgreSQL with timezone support
- Existing `v_tasks_with_recurrence_expanded` view
- `0008-ap-users` table with `timezone` column
- `0008-ap-tasks` table with `recurrence_exceptions` column

### Frontend Requirements
- React with hooks support (useState, useEffect, useCallback)
- Browser setTimeout/clearTimeout support
- Date object for time calculations

### Backward Compatibility
- Non-recurring tasks work exactly as before
- Existing completed occurrences are not affected
- Manual deletions (recurrence_exceptions) continue to work
- Users without timezone set default to UTC

## Future Enhancements

Potential improvements for future versions:

1. **Visual indicators**: Show users when future occurrences are blocked
2. **Blocked count**: Display how many future occurrences are hidden
3. **Override option**: Allow users to manually show blocked occurrences
4. **Smart notifications**: Remind users about incomplete blocking tasks
5. **Batch completion**: Allow completing multiple incomplete occurrences at once
6. **Grace period**: Option to allow a short delay before blocking kicks in
7. **Analytics**: Track blocking frequency to identify problematic tasks

## Support

For issues or questions about this implementation:
- Check database function logs for timezone/blocking issues
- Verify user timezone is set correctly in `0008-ap-users`
- Confirm `recurrence_exceptions` array is properly formatted
- Test blocking logic with sample data first
- Review console logs for midnight refresh timing

## Summary

This implementation provides a robust, timezone-aware system for displaying recurring tasks at exactly 12:01 AM local time with intelligent blocking logic that prevents future occurrences from appearing when previous ones are incomplete. The system respects manual deletions, performs efficiently with proper indexing, and automatically refreshes the dashboard at midnight to ensure users always see the correct tasks for the current day.
