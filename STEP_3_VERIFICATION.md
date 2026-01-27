# Step 3 Complete: Fixed Custom Goal Date Range in MyGoalsView ✓

## Overview
Successfully updated `components/goals/MyGoalsView.tsx` to display the correct date range for custom goals in the Goal Bank list. Custom goals now show their timeline's start/end dates instead of the goal's direct dates.

---

## The Problem (Before)

### Old Behavior:
When displaying custom goals in the Goal Bank list, the code used:
```tsx
start_date: goal.start_date,
end_date: goal.end_date,
```

This caused:
- ❌ Custom goals showed wrong/missing date ranges
- ❌ Timeline dates weren't being used
- ❌ Goal card subtitle was empty or incorrect

### Why This Was Wrong:
For custom goals, the date range should come from the **custom_timeline** table, not the goal itself. The goal's `start_date` and `end_date` might be null or outdated, but the timeline has the correct dates.

---

## The Solution (After)

### New Behavior:
Custom goals now use the timeline's dates first, with fallback:
```tsx
start_date: goal.timeline?.start_date || goal.start_date,
end_date: goal.timeline?.end_date || goal.end_date,
```

This ensures:
- ✅ Timeline dates are used as primary source
- ✅ Fallback to goal dates if timeline dates missing
- ✅ Date range displays correctly on goal cards
- ✅ Consistent with how 12-week goals work

---

## Changes Applied

### 3a. Fixed Custom Goals Mapping ✓
**Lines 271-272:** Updated date assignment to prioritize timeline dates

**Before:**
```tsx
start_date: goal.start_date,
end_date: goal.end_date,
```

**After:**
```tsx
start_date: goal.timeline?.start_date || goal.start_date,
end_date: goal.timeline?.end_date || goal.end_date,
```

---

## How It Works Now

### Data Flow for Custom Goals:

1. **Database Query:**
   ```sql
   SELECT 
     goal.*,
     timeline.start_date as timeline_start_date,
     timeline.end_date as timeline_end_date
   FROM custom_goals goal
   LEFT JOIN custom_timelines timeline ON goal.custom_timeline_id = timeline.id
   ```

2. **Mapping Logic:**
   ```tsx
   // First try to use timeline dates (most accurate)
   start_date: goal.timeline?.start_date
   // If timeline dates missing, fallback to goal dates
   || goal.start_date
   ```

3. **Result:**
   - Timeline dates are preferred (they're always correct)
   - Goal dates used only as fallback (rare case)
   - Date range displays on goal card

---

## Visual Impact

### Before (Missing Date Range):
```
Goal Card in Goal Bank:
┌─────────────────────────────────┐
│ Complete Thesis                 │
│ [No date range shown]           │
│ Week 4 of 12                    │
│ ████████████░░░░░░░░  33%       │
└─────────────────────────────────┘
```

### After (Correct Date Range):
```
Goal Card in Goal Bank:
┌─────────────────────────────────┐
│ Complete Thesis                 │
│ 1 Jan - 31 Mar 2026             │
│ Week 4 of 12                    │
│ ████████████░░░░░░░░  33%       │
└─────────────────────────────────┘
```

---

## Why Timeline Dates Are Preferred

### Custom Timeline Table:
```sql
CREATE TABLE custom_timelines (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  start_date DATE NOT NULL,  -- Always set
  end_date DATE NOT NULL,    -- Always set
  ...
);
```

### Custom Goals Table:
```sql
CREATE TABLE custom_goals (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  custom_timeline_id UUID REFERENCES custom_timelines(id),
  start_date DATE,  -- May be NULL
  end_date DATE,    -- May be NULL
  ...
);
```

**Key Point:**
- Timeline dates are **required** (NOT NULL)
- Goal dates are **optional** (may be NULL)
- Therefore, timeline dates are more reliable

---

## Consistency Across Goal Types

Now all goal types get dates from their timeline:

| Goal Type | Date Source |
|---|---|
| 12-week | `user_global_timelines.start_date/end_date` |
| Annual | `user_global_timelines.start_date/end_date` |
| Custom | `custom_timelines.start_date/end_date` ✓ (fixed) |

---

## Technical Details

### Where This Matters:

**MyGoalsView.tsx - Goal Card Rendering:**
```tsx
const GoalProgressCard = ({ goal }) => {
  // Uses goal.start_date and goal.end_date
  const dateRange = formatDateRange(goal.start_date, goal.end_date);
  
  return (
    <View>
      <Text>{goal.title}</Text>
      <Text>{dateRange}</Text>  {/* Now shows correct range! */}
    </View>
  );
};
```

### Data Structure After Mapping:
```tsx
{
  id: '...',
  title: 'Complete Thesis',
  goal_type: 'custom',
  timeline_id: '...',
  timeline_name: 'Spring Semester 2026',
  start_date: '2026-01-01',  // From timeline
  end_date: '2026-03-31',    // From timeline
  current_week: 4,
  total_weeks: 12,
  ...
}
```

---

## Build Status

✅ Build completed successfully with no errors

---

## File Modified

**File:** `components/goals/MyGoalsView.tsx`

**Lines Changed:** 271-272 (2 lines)

**Section:** Custom goals mapping

---

## Testing Checklist

To verify this works:

- [ ] Open Goal Bank (Goals tab)
- [ ] View a custom goal card
- [ ] Verify date range appears below title
- [ ] Verify date range matches the custom timeline's dates
- [ ] Compare with 12-week/annual goals - format should be consistent
- [ ] Check console for any errors

### Database Verification:
```sql
-- Check custom goal has timeline dates
SELECT 
  g.title as goal_title,
  g.start_date as goal_date,
  t.start_date as timeline_date,
  t.title as timeline_title
FROM custom_goals g
LEFT JOIN custom_timelines t ON g.custom_timeline_id = t.id
WHERE g.id = 'your-goal-id';
```

Expected result:
- `timeline_date` should have a value
- Goal card should show this date

---

## Edge Cases Handled

### 1. Timeline Missing (Orphaned Goal):
```tsx
start_date: goal.timeline?.start_date || goal.start_date
```
If `goal.timeline` is null (timeline was deleted), falls back to `goal.start_date`.

### 2. Timeline Dates Missing:
```tsx
start_date: goal.timeline?.start_date || goal.start_date
```
If timeline exists but `start_date` is null (shouldn't happen), falls back to `goal.start_date`.

### 3. Both Missing:
```tsx
start_date: goal.timeline?.start_date || goal.start_date
```
If both are null, `start_date` will be null. The date formatter should handle this gracefully (show "No dates" or similar).

---

## Related Code

### Date Range Formatting (Used by Goal Cards):
```tsx
const formatDateRange = (startDate: string, endDate: string): string => {
  if (!startDate || !endDate) return '';
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Format: "1 Jan - 31 Mar 2026"
  return `${formatDate(start)} - ${formatDate(end)}`;
};
```

### Impact on Other Components:
This fix only affects `MyGoalsView.tsx`. Other components that use custom goals should already be getting the correct data from the same source.

---

## Why This Fix Was Needed

### User Story:
> As a user with custom goals,
> I want to see the correct date range on my goal cards,
> So I know when my timeline starts and ends.

### Before This Fix:
- User creates custom timeline "Spring Semester" (Jan 1 - Mar 31)
- User creates custom goal "Complete Thesis" linked to this timeline
- Goal card shows no date range or wrong dates
- User confused about when goal is due

### After This Fix:
- Same scenario
- Goal card shows "1 Jan - 31 Mar 2026"
- User has clear visibility of timeline dates
- Consistent with 12-week/annual goals

---

## Summary

Step 3 was a simple but important fix to ensure custom goals display their timeline's date range correctly in the Goal Bank list. 

**Key Change:** Use `goal.timeline?.start_date` and `goal.timeline?.end_date` as the primary source, with fallback to the goal's direct dates.

This provides:
- Accurate date display for custom goals
- Consistency across all goal types
- Better user experience in Goal Bank view

Ready for Step 4.
