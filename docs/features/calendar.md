# Calendar Feature Guide

Comprehensive documentation for the calendar feature, including database fixes, refactoring status, and optimization work.

---

## Table of Contents

1. [Database Fixes](#database-fixes)
2. [Refactor Implementation Status](#refactor-implementation-status)
3. [Optimization Work](#optimization-work)
4. [Testing](#testing)
5. [Related Files](#related-files)

---

## Database Fixes

### Problem Analysis

The `v_tasks_with_recurrence_expanded` view had a filter that only returned occurrences where `occurrence_date >= CURRENT_DATE`. This prevented the calendar from displaying:
- Tasks from yesterday
- Events from last week
- Historical recurring task occurrences

When users navigated to past dates in the calendar, no tasks/events would appear.

### Solution

The fix involves two main changes:

#### 1. Update `fn_expand_recurrence_dates` Function

Add a new parameter `p_max_past_days` (default 90 days) to support expanding recurring tasks into the past.

**Key Changes**:
- New parameter: `p_max_past_days integer DEFAULT 90`
- New variable: `v_start_window date` set to `CURRENT_DATE - p_max_past_days`
- All frequency types (DAILY, WEEKLY, MONTHLY, YEARLY) now check both start and end of the expansion window

#### 2. Update `v_tasks_with_recurrence_expanded` View

Modify the view to pass the new parameter and remove the restrictive date filter.

**Key Changes**:
- Pass `90` as the 6th parameter to `fn_expand_recurrence_dates`
- This expands recurring tasks to show occurrences from the past 90 days
- Removed the `occurrence_date >= CURRENT_DATE` filter that was blocking historical dates

### SQL Script Location

See: `sql/database-updates/CALENDAR_FIX_WITH_PAST_DATES.sql`

### Expansion Window

After applying the fix, the calendar will display:
- **Past dates**: 90 days back from today
- **Future dates**: 365 days forward from today
- **Total window**: ~455 days of task/event data

These values can be adjusted if needed:
- To show more history: Increase `90` in the view definition
- To show more future: Increase `365` in the view definition

### Performance Considerations

The 90-day past window is a reasonable trade-off between:
- **User needs**: Most calendar navigation stays within ±30 days
- **Performance**: Keeps the expansion calculation efficient
- **Database load**: Limits the number of virtual occurrences generated

### Database Testing

Manual tests in Supabase SQL Editor:

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

### Rollback Plan

If issues arise, you can rollback by reverting to the original function with 5 parameters (from migration 20251019220255). However, this will bring back the original issue where past dates don't show tasks.

---

## Refactor Implementation Status

### ✅ Completed (Phase 1)

#### 1. Database Infrastructure
- **Migration**: `20251021000000_add_is_anytime_to_views.sql`
  - Added `is_anytime` column to all recurring task views
  - Extended recurrence window from 365 to 730 days (2 years)
  - Updated both `v_tasks_with_recurrence_expanded` and `v_dashboard_next_occurrences` views

#### 2. Core Components Created

**PriorityQuadrant Component** (`components/calendar/PriorityQuadrant.tsx`)
- Displays Eisenhower Matrix visualization
- Q1 (Red): Urgent + Important
- Q2 (Green): Not Urgent + Important
- Q3 (Yellow): Urgent + Not Important
- Q4 (Gray): Not Urgent + Not Important
- Supports 3 sizes: small (48x48), medium (64x64), large (80x80)
- Only counts pending/incomplete tasks
- Optional `onPress` handler for future drill-down functionality

**useCalendarEvents Hook** (`hooks/useCalendarEvents.ts`)
- Unified data fetching for all calendar views
- Queries `v_tasks_with_recurrence_expanded` exclusively
- Filters to show only virtual occurrences OR non-recurring tasks
- Automatic deduplication using `uniqByIdAndDate` pattern
- Returns categorized events: All-Day, Anytime Tasks, Timed Events, No-Time Tasks
- Returns pending tasks separately for priority calculations
- Supports daily, weekly, and monthly view modes

#### 3. Header Component Enhancement

Updated `components/Header.tsx`:
- Added support for calendar view modes (daily/weekly/monthly)
- Created type system: `DashboardView | CalendarView`
- Pill-style tabs now dynamically switch based on activeView type
- Dashboard views: Deposits, Ideas, Journal, Analytics
- Calendar views: Daily, Weekly, Monthly

#### 4. Calendar Screen Updates

Partial update to `app/calendar.tsx`:
- ✅ Imported `PriorityQuadrant` component
- ✅ Changed default view from 'daily' to 'weekly'
- ✅ Added `activeView` and `onViewChange` props to Header
- ✅ Removed duplicate view toggle buttons (now in Header)
- ✅ **Daily View**: Added PriorityQuadrant to header (date on left, quadrant on right)
- ✅ **Weekly View**: Added small PriorityQuadrant to each day column header (date on left, quadrant on right)
- ✅ Changed day labels to uppercase (SUN, MON, TUE, etc.)
- ✅ Added new styles: `dailyHeaderLeft`, `weekDayColumn`, `weekDayHeaderRow`

### 🔄 Remaining Work (Phase 2)

#### 1. Weekly View Enhancements
- [ ] Add weekly summary row above the week grid
  - [ ] Show total pending tasks across all 7 days in a medium quadrant
  - [ ] Add Pending/Completed toggle switch
  - [ ] Filter weekly tasks based on toggle state

#### 2. Monthly View Improvements
- [ ] Add small PriorityQuadrant to each calendar date cell
- [ ] Position quadrant below date number, above event dots
- [ ] Ensure proper spacing and layout
- [ ] Remove event dots display (replace with quadrant counts)

#### 3. Data Layer Migration
- [ ] Replace all manual fetching in calendar.tsx with `useCalendarEvents` hook
- [ ] Remove `fetchTasksAndEvents()` function
- [ ] Delete `useExpandedTasksWithAnytime` hook usage
- [ ] Delete `useExpandedTasksForWeek` hook usage
- [ ] Remove `tasks` and `events` state variables
- [ ] Use `events`, `categorized`, `pendingTasks` from hook instead
- [ ] Update `selectedDateTasks` calculation to use hook data
- [ ] Update `weeklyTasksByDate` to use hook data

#### 4. Code Cleanup
- [ ] Remove `uniqByIdAndDate` function (now handled by hook)
- [ ] Remove `hasVirtualOccurrences` detection logic
- [ ] Remove client-side `expandEventsWithRecurrence` calls
- [ ] Remove `getVisibleWindow` imports and usage
- [ ] Clean up unused imports
- [ ] Delete legacy hooks: `useExpandedTasksWithAnytime`, `useExpandedTasksForWeek`

#### 5. Testing Checklist
- [ ] Create "Great Taco Test 0001" recurring weekly on Tuesday
- [ ] Verify it appears on Oct 21, Oct 28, Nov 4 without duplicates
- [ ] Test Daily view: quadrant updates when tasks completed
- [ ] Test Weekly view: quadrants per day update correctly
- [ ] Test Weekly summary toggle: switches between Pending/Completed
- [ ] Test Monthly view: quadrants appear in each date cell
- [ ] Verify all three views show same events for overlapping dates
- [ ] Test FAB visibility and dragging in all views
- [ ] Test priority quadrant click behavior (if implemented)

### Implementation Strategy

#### Quick Win Approach
1. First, complete the **Weekly View Toggle** (easiest, most visible impact)
2. Then finish **Monthly View Quadrants** (straightforward visual enhancement)
3. Finally, migrate to **useCalendarEvents hook** (most complex, requires careful testing)

#### Code to Add for Weekly Summary

```tsx
// Add state for toggle
const [showCompleted, setShowCompleted] = useState(false);

// Filter tasks based on toggle
const weeklyTasks = useMemo(() => {
  const start = formatLocalDate(weekDates[0]);
  const end = formatLocalDate(weekDates[6]);
  const weekTasks = tasks.filter(t => {
    const date = t.occurrence_date || t.due_date || t.start_date;
    return date >= start && date <= end;
  });
  return showCompleted ?
    weekTasks.filter(t => t.status === 'completed') :
    weekTasks.filter(t => t.status !== 'completed');
}, [tasks, weekDates, showCompleted]);

// Add to weekly view JSX (before weekGrid)
<View style={styles.weeklySummary}>
  <View style={styles.weeklyToggle}>
    <Text style={styles.toggleLabel}>
      {showCompleted ? 'Completed' : 'Pending'}
    </Text>
    <Switch
      value={showCompleted}
      onValueChange={setShowCompleted}
      trackColor={{ false: '#d1d5db', true: '#0078d4' }}
    />
  </View>
  <PriorityQuadrant tasks={weeklyTasks} size="medium" />
</View>
```

### Visual Layout Reference

**Daily View Header**
```
┌────────────────────────────────────────────┐
│  ← [Date: Wednesday, October 23]  →   [Q] │
└────────────────────────────────────────────┘
```

**Weekly View Column**
```
┌─────────┐
│   MON   │
│ 23  [Q] │
└─────────┘
```

**Weekly Summary (To Add)**
```
┌──────────────────────────────────────┐
│ [Pending/Completed Toggle]      [Q]  │
└──────────────────────────────────────┘
```

**Monthly Cell (To Add)**
```
┌───────┐
│  23   │
│  [Q]  │
│ • • • │
└───────┘
```

### Current Status Summary

**What You'll See Now:**
- Calendar header shows Daily/Weekly/Monthly tabs (replacing old toggle buttons)
- Daily view has priority quadrant on the right side of header
- Weekly view has small priority quadrants next to each day number
- Day labels changed to uppercase (SUN, MON, etc.)

**What's Still Missing:**
- Weekly summary row with toggle above week grid
- Priority quadrants in monthly calendar cells
- Full migration to useCalendarEvents hook (still using old data fetching)

---

## Optimization Work

### Problems Addressed

#### 1. Excessive Console Logging
**Issue**: The calendar was generating 3+ MB of console logs during basic navigation operations, making debugging impossible and slowing down the application.

**Root Cause**:
- Every recurrence expansion logged start/end messages
- Every view render logged its state
- Every component render logged detailed information
- Logs were duplicated hundreds of times for the same recurring events

#### 2. Inefficient Data Queries
**Issue**: The app was fetching 455 days worth of data (90 days past + 365 days future) on every load, regardless of the current view.

**Impact**:
- Massive data transfers from Supabase
- Slow initial load times
- Wasted bandwidth and processing

#### 3. Redundant Recurrence Calculations
**Issue**: Recurring events were being expanded multiple times during each render cycle, with no caching.

**Impact**:
- Hundreds of identical expansions per view change
- Severe performance degradation
- Laggy UI during navigation

#### 4. Goal Action Tasks in Calendar
**Issue**: Tasks that are actions for goals were showing up in the calendar view, cluttering the interface.

### Solutions Implemented

#### 1. Logging System Overhaul

**Created**: `lib/logger.ts`
- Implemented proper log levels (ERROR, WARN, INFO, DEBUG)
- Added environment-based conditional logging
- Only errors log by default in production
- Debug mode can be enabled when needed

**Removed**: All `console.log` statements from:
- `lib/recurrenceUtils.ts`
- `app/calendar.tsx`
- `components/calendar/HourlyCalendarGrid.tsx`

**Result**: Console is now clean with only essential error messages visible.

#### 2. Smart Query Optimization

**Changes in `app/calendar.tsx`**:
```typescript
// Before: Always fetched 455 days
startRange.setDate(startRange.getDate() - 90);
endRange.setDate(endRange.getDate() + 365);

// After: View-specific ranges
switch (viewMode) {
  case 'daily':
    startRange.setDate(startRange.getDate() - 7);
    endRange.setDate(endRange.getDate() + 7);
    break;
  case 'weekly':
    startRange.setDate(startRange.getDate() - 14);
    endRange.setDate(endRange.getDate() + 14);
    break;
  case 'monthly':
    startRange.setMonth(startRange.getMonth() - 1);
    endRange.setMonth(endRange.getMonth() + 1);
    break;
}
```

**Benefits**:
- Daily view: 14 days of data (93% reduction)
- Weekly view: 28 days of data (94% reduction)
- Monthly view: ~60 days of data (87% reduction)

**Query Refetch**: Added `viewMode` to the useEffect dependency array, so data refreshes when changing views.

#### 3. Recurrence Expansion Caching

**Created**: `hooks/useRecurrenceCache.ts`

Three optimized hooks:
1. `useExpandedTasksForDate` - Memoized single-date expansion
2. `useExpandedTasksForWeek` - Batch expansion for entire week (prevents 7 separate expansions)
3. `useExpandedTasksWithAnytime` - Combines recurring and anytime tasks

**Implementation**:
```typescript
// Before: Computed on every render
const dailyExpandedTasks = useMemo(() => {
  const expandedEvents = expandEventsForDate(tasks, selectedDate);
  const anytimeTasks = tasks.filter(...);
  return uniqByIdAndDate([...expandedEvents, ...anytimeTasks]);
}, [tasks, selectedDate]);

// After: Single cached hook call
const dailyExpandedTasks = useExpandedTasksWithAnytime(tasks, selectedDate, true);
```

**Result**: Recurrence expansion now happens once per unique date + tasks combination, with results cached.

#### 4. Goal Action Task Filtering

**Changes in `app/calendar.tsx`**:
```typescript
// Transform tasks and filter out goal action tasks
const transformedTasks = tasksData
  .map(task => {
    const taskGoals = goalsData?.filter(g => g.parent_id === task.id)...;
    return {
      ...task,
      isGoalActionTask: taskGoals.length > 0,
    };
  })
  .filter(task => !task.isGoalActionTask);
```

**Result**: Calendar now shows only standalone tasks and events, not goal action items.

#### 5. Component Render Optimization

**HourlyCalendarGrid.tsx**:
- Wrapped component in `React.memo()` with custom comparison function
- Memoized expensive calculations with `useMemo`:
  - `noTimeItemsAsMidnight` - Task transformation
  - `allTimedEvents` - Array merging
  - `eventsWithLayout` - Layout calculation
  - `hours` - Static array generation

**Calendar.tsx**:
- Wrapped event handlers in `useCallback`:
  - `handleCompleteTask`
  - `handleTaskPress`
  - `navigateDate`

**Result**: Components only re-render when their actual props change, not on every parent render.

#### 6. Weekly View Batch Optimization

**Before**: The weekly view mapped over 7 days, calling `expandEventsForDate` for each day individually.

**After**: Single call to `useExpandedTasksForWeek` that batches all 7 days at once with a single memoized calculation.

```typescript
// Before: 7 separate expansions
{weekDates.map((date) => {
  const expandedEvents = expandEventsForDate(tasks, dateString); // Called 7 times
  ...
})}

// After: 1 batched expansion
const weeklyTasksByDate = useExpandedTasksForWeek(tasks, weekDates);
{weekDates.map((date) => {
  const expandedTasks = weeklyTasksByDate[dateString]; // Just a lookup
  ...
})}
```

### Performance Impact

**Before Optimization:**
- Console logs: 3+ MB per view change
- Data fetched: 455 days on every load
- Recurrence expansions: 100-1000+ redundant calculations
- Load time: 2-5+ seconds
- View transitions: Laggy and unresponsive

**After Optimization:**
- Console logs: Near zero (only errors)
- Data fetched: 14-60 days depending on view
- Recurrence expansions: Cached, calculated once per unique query
- Load time: Expected <1 second
- View transitions: Should be instant

### Files Modified

**New Files Created**:
- `lib/logger.ts` - Proper logging utility
- `hooks/useRecurrenceCache.ts` - Memoized recurrence expansion hooks

**Modified Files**:
- `lib/recurrenceUtils.ts` - Removed all console.log statements
- `app/calendar.tsx` - Query optimization, caching hooks, useCallback
- `components/calendar/HourlyCalendarGrid.tsx` - React.memo, useMemo optimizations

### Future Enhancements

1. **Prefetching**: Pre-load adjacent view data on idle
2. **Virtual Scrolling**: For very long lists of events
3. **IndexedDB Caching**: Cache expanded events client-side
4. **Worker Thread Expansion**: Move recurrence calculations to web worker
5. **Lazy Loading**: Only load visible week/day data

---

## Testing

### App-Level Tests

#### Daily View
- Navigate to yesterday - should show tasks
- Navigate to last week - should show tasks
- Verify priority quadrant updates when tasks completed

#### Weekly View
- View last week - should show all tasks from that week
- Navigate back 2-3 weeks - should still show tasks
- Verify quadrants per day update correctly
- Test weekly summary toggle (when implemented)

#### Monthly View
- Select a date from last month - should show tasks
- Click on dots in calendar - should display task list
- Verify quadrants appear in each date cell (when implemented)

#### Recurring Tasks
- Create a daily recurring task starting 30 days ago
- Navigate to dates in the past - should see occurrences
- Navigate to dates in the future - should see occurrences
- Verify no duplicate occurrences

### Performance Testing
1. **Console Verification**: Open dev tools and navigate between calendar views - should see minimal/no logs
2. **Load Time**: Measure time from clicking a view tab to content appearing - should be near-instant for cached data
3. **Network Monitoring**: Check network tab to see reduced payload sizes
4. **Memory Profiling**: Monitor memory usage during extended calendar navigation
5. **Goal Task Filtering**: Verify goal action tasks don't appear in calendar

---

## Related Files

### Components
- `app/calendar.tsx` - Main calendar screen
- `components/calendar/HourlyCalendarGrid.tsx` - Hourly view grid
- `components/calendar/WeeklyTimeGrid.tsx` - Weekly view grid
- `components/calendar/MonthlyCalendarGrid.tsx` - Monthly view grid
- `components/calendar/PriorityQuadrant.tsx` - Eisenhower matrix visualization
- `components/calendar/WeekColumnHeader.tsx` - Week day column headers
- `components/calendar/CalendarEventDisplay.tsx` - Event display component
- `components/calendar/QuadrantTasksModal.tsx` - Task list modal

### Hooks
- `hooks/useCalendarEvents.ts` - Unified calendar data fetching
- `hooks/useRecurrenceCache.ts` - Recurrence expansion caching

### Utilities
- `lib/recurrenceUtils.ts` - Recurrence calculation utilities (client-side)
- `lib/rruleUtils.ts` - RRule parsing utilities
- `lib/dateUtils.ts` - Date formatting and manipulation
- `lib/logger.ts` - Logging system

### Database
- `supabase/migrations/20251019220255_add_recurring_tasks_system.sql` - Original recurring tasks migration
- `supabase/migrations/20251020000000_add_past_date_support_to_recurrence.sql` - Past date support
- `supabase/migrations/20251021000000_add_is_anytime_to_views.sql` - Anytime tasks support
- `sql/database-updates/CALENDAR_FIX_WITH_PAST_DATES.sql` - Past dates fix script

---

**Last Updated:** November 2025
**Status:** Phase 1 complete, Phase 2 in progress
**Consolidated from:** CALENDAR_DATABASE_FIX_GUIDE.md, CALENDAR_REFACTOR_STATUS.md, CALENDAR_OPTIMIZATION_SUMMARY.md
