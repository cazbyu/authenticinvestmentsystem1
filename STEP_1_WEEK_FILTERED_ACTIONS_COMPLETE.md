# Step 1 Complete: GoalDetailView Now Uses Week-Filtered Actions ✓

## Overview
Successfully updated `components/goals/GoalDetailView.tsx` to use week-filtered actions from `fetchGoalActionsForWeek` instead of the old method. This ensures:
- Only actions scheduled for the displayed week are shown
- Correct `weeklyTarget` values from the week plan are used
- Proper date calculations for the displayed week

---

## Changes Applied

### 1a. Updated Imports ✓
**Line 23:** Added import for `fetchGoalActionsForWeek` and `TaskWithLogs`

```tsx
import { fetchGoalActionsForWeek, TaskWithLogs } from '@/hooks/fetchGoalActionsForWeek';
```

---

### 1b. Added State for Week-Filtered Actions ✓
**Lines 84-85:** Added new state to store week-specific actions

```tsx
// Week-specific actions from fetchGoalActionsForWeek (has correct weeklyTarget)
const [weekFilteredActions, setWeekFilteredActions] = useState<TaskWithLogs[]>([]);
```

---

### 1c. Updated fetchActions Function ✓
**Lines 342-381:** Completely rewrote function to fetch week-filtered actions

**Key Changes:**
- Still fetches ALL actions first (needed for one-time/boost actions)
- Then fetches week-specific recurring actions using `fetchGoalActionsForWeek`
- Passes correct parameters: goalIds, weekNumber, timeline info, cycleWeeks
- Stores week-filtered results in new state
- Includes detailed console logging for debugging

```tsx
// Fetch week-specific recurring actions if we have timeline info
if (timeline && cycleWeeks.length > 0) {
  const weekResult = await fetchGoalActionsForWeek(
    [currentGoal.id],
    displayedWeekNumber,
    { id: timeline.id, source: timeline.source },
    cycleWeeks
  );
  
  const actionsForGoal = weekResult[currentGoal.id] || [];
  setWeekFilteredActions(actionsForGoal);
}
```

---

### 1d. Updated useEffect Dependencies ✓
**Line 340:** Added new dependencies to trigger refetch when week changes

```tsx
}, [currentGoal.id, activeTab, refreshTrigger, timeRange, displayedWeekNumber, timeline, cycleWeeks]);
```

**Impact:** Actions now refetch automatically when user navigates between weeks

---

### 1e. Updated getScheduledDaysFromRRule ✓
**Lines 1197-1214:** Fixed handling of missing BYDAY in RRULE

**Before:**
- Returned empty array `[]` if no BYDAY found
- This caused all days to appear disabled for preset frequencies

**After:**
- Returns all 7 days `[0,1,2,3,4,5,6]` if no BYDAY found
- This allows any day to be toggled for preset frequencies like "5 days/week"

```tsx
// If no BYDAY specified, ALL days are available
// This happens when user selects preset frequency like "5 days" (any 5 days)
if (!byDayMatch) {
  return [0, 1, 2, 3, 4, 5, 6]; // All days available
}
```

**Critical Fix:** This resolves the issue where preset frequency actions appeared broken

---

### 1f. Added New Render Functions ✓
**Lines 1289-1376:** Added two new functions to handle week-filtered actions

#### renderWeekFilteredActionCard()
- Renders action cards using `TaskWithLogs` type (has correct weeklyTarget)
- Gets completed days from `action.logs` array
- Uses `handleToggleDayForWeek` for day toggling
- Shows available vs completed bubbles correctly

```tsx
const renderWeekFilteredActionCard = (action: TaskWithLogs) => {
  const scheduledDays = getScheduledDaysFromRRule(action.recurrence_rule || '');
  const completedDays = action.logs?.map(log => new Date(log.measured_on).getDay()) || [];
  const targetDays = action.weeklyTarget || 1;
  const completionCount = action.weeklyActual || 0;
  // ... render card
}
```

#### handleToggleDayForWeek()
- Calculates correct date for the displayed week
- Finds week from cycleWeeks using displayedWeekNumber
- Calculates target date: week start + day offset
- Checks completion status from action.logs
- Calls handleToggleCompletion with correct date

```tsx
const handleToggleDayForWeek = async (actionId: string, dayIndex: number) => {
  const week = cycleWeeks.find(w => w.week_number === displayedWeekNumber);
  const weekStart = new Date(week.start_date);
  const targetDate = new Date(weekStart);
  targetDate.setDate(weekStart.getDate() + dayIndex);
  // ... toggle completion
}
```

---

### 1g. Updated renderActTab to Use weekFilteredActions ✓
**Lines 1416-1426:** Changed section to render week-filtered actions

**Before:**
```tsx
{recurringActions.map(action => renderLeadingIndicatorCard(action))}
```

**After:**
```tsx
{weekFilteredActions.map(action => renderWeekFilteredActionCard(action))}
```

**Impact:** Act tab now shows ONLY actions scheduled for the displayed week

---

### 1h. Updated Empty State Check ✓
**Line 1480:** Changed condition to check weekFilteredActions

**Before:**
```tsx
{recurringActions.length === 0 && oneTimeActions.length === 0 && (
```

**After:**
```tsx
{weekFilteredActions.length === 0 && oneTimeActions.length === 0 && (
```

**Impact:** Empty state appears when no actions exist for the displayed week

---

## How It Works Now

### Week Navigation Flow:
1. User navigates to a goal
2. `fetchTimelineAndWeeks` loads timeline and cycle weeks
3. `fetchActions` fetches ALL actions + week-filtered actions
4. Act tab renders `weekFilteredActions` for displayed week
5. User clicks previous/next week arrow
6. `displayedWeekNumber` updates
7. useEffect triggers (sees dependency change)
8. `fetchActions` runs again with new week number
9. New week-filtered actions loaded and displayed

### Day Toggling Flow:
1. User taps a day bubble
2. `handleToggleDayForWeek` called with actionId and dayIndex
3. Finds correct week from cycleWeeks
4. Calculates date: week.start_date + dayIndex
5. Checks if day is currently completed from action.logs
6. Calls `handleToggleCompletion` with correct date
7. Actions refetch after completion
8. UI updates with new completion state

---

## Technical Details

### Data Flow:
```
fetchGoalActionsForWeek
  ↓
Returns: { [goalId]: TaskWithLogs[] }
  ↓
TaskWithLogs includes:
  - weeklyTarget (from week plan)
  - weeklyActual (calculated)
  - logs (completion dates)
  - selectedWeeks (week numbers)
  ↓
renderWeekFilteredActionCard
  ↓
Displays card with correct target/actual
```

### Date Calculations:
- Old method: Used "today" and offset
- New method: Uses week.start_date + day offset
- Benefit: Works for ANY displayed week, not just current week

---

## Build Status

✅ Build completed successfully with no errors

---

## File Modified

**File:** `components/goals/GoalDetailView.tsx`

**Total Lines Changed:** ~150 lines added/modified

**Key Sections:**
- Imports (line 23)
- State declarations (lines 84-85)
- fetchActions function (lines 342-381)
- useEffect dependencies (line 340)
- getScheduledDaysFromRRule (lines 1197-1214)
- New render functions (lines 1289-1376)
- renderActTab update (lines 1416-1426)
- Empty state update (line 1480)

---

## Testing Checklist

To verify this works:

- [ ] Navigate to a goal with recurring actions
- [ ] Verify only actions for displayed week show
- [ ] Navigate between weeks - verify actions update
- [ ] Toggle day completion - verify it updates
- [ ] Check weeklyTarget matches action setup
- [ ] Test preset frequencies (e.g., "5 days") - all days should be available
- [ ] Check console logs for week-filtered actions data

---

## Next Steps

This completes Step 1 of 5. The GoalDetailView now:
- Shows correct actions for each week
- Uses correct weeklyTarget from week plan
- Handles preset frequencies properly
- Calculates dates correctly for any week

Ready for Step 2.
