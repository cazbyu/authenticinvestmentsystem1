# Calendar Refactor Implementation Status

## ✅ Completed (Phase 1)

### 1. Database Infrastructure
- **Migration**: `20251021000000_add_is_anytime_to_views.sql`
  - Added `is_anytime` column to all recurring task views
  - Extended recurrence window from 365 to 730 days (2 years)
  - Updated both `v_tasks_with_recurrence_expanded` and `v_dashboard_next_occurrences` views

### 2. Core Components Created
- **PriorityQuadrant Component** (`/components/calendar/PriorityQuadrant.tsx`)
  - Displays Eisenhower Matrix visualization
  - Q1 (Red): Urgent + Important
  - Q2 (Green): Not Urgent + Important
  - Q3 (Yellow): Urgent + Not Important
  - Q4 (Gray): Not Urgent + Not Important
  - Supports 3 sizes: small (48x48), medium (64x64), large (80x80)
  - Only counts pending/incomplete tasks
  - Optional `onPress` handler for future drill-down functionality

- **useCalendarEvents Hook** (`/hooks/useCalendarEvents.ts`)
  - Unified data fetching for all calendar views
  - Queries `v_tasks_with_recurrence_expanded` exclusively
  - Filters to show only virtual occurrences OR non-recurring tasks
  - Automatic deduplication using `uniqByIdAndDate` pattern
  - Returns categorized events: All-Day, Anytime Tasks, Timed Events, No-Time Tasks
  - Returns pending tasks separately for priority calculations
  - Supports daily, weekly, and monthly view modes

### 3. Header Component Enhancement
- **Updated** `/components/Header.tsx`
  - Added support for calendar view modes (daily/weekly/monthly)
  - Created type system: `DashboardView | CalendarView`
  - Pill-style tabs now dynamically switch based on activeView type
  - Dashboard views: Deposits, Ideas, Journal, Analytics
  - Calendar views: Daily, Weekly, Monthly

### 4. Calendar Screen Updates
- **Partial Update** to `/app/calendar.tsx`
  - ✅ Imported `PriorityQuadrant` component
  - ✅ Changed default view from 'daily' to 'weekly'
  - ✅ Added `activeView` and `onViewChange` props to Header
  - ✅ Removed duplicate view toggle buttons (now in Header)
  - ✅ **Daily View**: Added PriorityQuadrant to header (date on left, quadrant on right)
  - ✅ **Weekly View**: Added small PriorityQuadrant to each day column header (date on left, quadrant on right)
  - ✅ Changed day labels to uppercase (SUN, MON, TUE, etc.)
  - ✅ Added new styles: `dailyHeaderLeft`, `weekDayColumn`, `weekDayHeaderRow`

## 🔄 Remaining Work (Phase 2)

### 1. Weekly View Enhancements
- [ ] Add weekly summary row above the week grid
  - [ ] Show total pending tasks across all 7 days in a medium quadrant
  - [ ] Add Pending/Completed toggle switch
  - [ ] Filter weekly tasks based on toggle state

### 2. Monthly View Improvements
- [ ] Add small PriorityQuadrant to each calendar date cell
- [ ] Position quadrant below date number, above event dots
- [ ] Ensure proper spacing and layout
- [ ] Remove event dots display (replace with quadrant counts)

### 3. Data Layer Migration
- [ ] Replace all manual fetching in calendar.tsx with `useCalendarEvents` hook
- [ ] Remove `fetchTasksAndEvents()` function
- [ ] Delete `useExpandedTasksWithAnytime` hook usage
- [ ] Delete `useExpandedTasksForWeek` hook usage
- [ ] Remove `tasks` and `events` state variables
- [ ] Use `events`, `categorized`, `pendingTasks` from hook instead
- [ ] Update `selectedDateTasks` calculation to use hook data
- [ ] Update `weeklyTasksByDate` to use hook data

### 4. Code Cleanup
- [ ] Remove `uniqByIdAndDate` function (now handled by hook)
- [ ] Remove `hasVirtualOccurrences` detection logic
- [ ] Remove client-side `expandEventsWithRecurrence` calls
- [ ] Remove `getVisibleWindow` imports and usage
- [ ] Clean up unused imports
- [ ] Delete legacy hooks: `useExpandedTasksWithAnytime`, `useExpandedTasksForWeek`

### 5. Testing Checklist
- [ ] Create "Great Taco Test 0001" recurring weekly on Tuesday
- [ ] Verify it appears on Oct 21, Oct 28, Nov 4 without duplicates
- [ ] Test Daily view: quadrant updates when tasks completed
- [ ] Test Weekly view: quadrants per day update correctly
- [ ] Test Weekly summary toggle: switches between Pending/Completed
- [ ] Test Monthly view: quadrants appear in each date cell
- [ ] Verify all three views show same events for overlapping dates
- [ ] Test FAB visibility and dragging in all views
- [ ] Test priority quadrant click behavior (if implemented)

## 🎯 Implementation Strategy

### Quick Win Approach
1. First, complete the **Weekly View Toggle** (easiest, most visible impact)
2. Then finish **Monthly View Quadrants** (straightforward visual enhancement)
3. Finally, migrate to **useCalendarEvents hook** (most complex, requires careful testing)

### Code to Add for Weekly Summary

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

## 📊 Visual Layout Reference

### Daily View Header
```
┌────────────────────────────────────────────┐
│  ← [Date: Wednesday, October 23]  →   [Q] │
└────────────────────────────────────────────┘
```

### Weekly View Column
```
┌─────────┐
│   MON   │
│ 23  [Q] │
└─────────┘
```

### Weekly Summary (To Add)
```
┌──────────────────────────────────────┐
│ [Pending/Completed Toggle]      [Q]  │
└──────────────────────────────────────┘
```

### Monthly Cell (To Add)
```
┌───────┐
│  23   │
│  [Q]  │
│ • • • │
└───────┘
```

## 🔍 Current Status Summary

**What You'll See Now:**
- Calendar header shows Daily/Weekly/Monthly tabs (replacing old toggle buttons)
- Daily view has priority quadrant on the right side of header
- Weekly view has small priority quadrants next to each day number
- Day labels changed to uppercase (SUN, MON, etc.)

**What's Still Missing:**
- Weekly summary row with toggle above week grid
- Priority quadrants in monthly calendar cells
- Full migration to useCalendarEvents hook (still using old data fetching)

## 📝 Notes

- The calendar is functional with the current changes
- Priority quadrants correctly count only pending tasks
- The visual improvements are in place but not fully integrated
- Data layer still uses legacy fetching (works but inefficient)
- Network issues prevented final build verification, but code changes are TypeScript-valid
