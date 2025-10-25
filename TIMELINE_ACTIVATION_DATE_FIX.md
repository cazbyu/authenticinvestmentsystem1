# Timeline Activation Date Fix Summary

## Issue Description

The "Available starting" message for 2nd in line timelines was displaying the incorrect date. Specifically:

- **Winter 2026** timeline (28 Dec 2025 - 21 Mar 2026) was showing "Available starting Mar 22"
- This date (Mar 22) is AFTER Winter 2026 ends (Mar 21), making it useless
- The correct date should be **Dec 21** - when the previous cycle (Fall 2025) enters its reflection week

## Root Cause

In `ManageGlobalTimelinesContent.tsx` line 488, the locked message was using the 2nd in line cycle's own `reflection_start` date instead of the previous (active) cycle's `reflection_start` date.

```typescript
// INCORRECT - was using the cycle's own reflection_start
const reflectionStart = cycle.global_cycle?.reflection_start || cycle.reflection_start;

// CORRECT - now uses the previous cycle's reflection_start
const reflectionStart = cycle.global_cycle?.previous_cycle_reflection_start || cycle.previous_cycle_reflection_start;
```

## Solution Implemented

### 1. Database View Update (Migration: 20251016020000)

Updated `v_global_cycles` view to include a new calculated field:
- `previous_cycle_reflection_start` - Contains the active cycle's reflection_start date for 2nd_in_line cycles
- Returns NULL for all other cycle positions (not applicable)

### 2. Frontend Component Updates

Updated `ManageGlobalTimelinesContent.tsx`:
- Added `previous_cycle_reflection_start?: string` to the `GlobalCycle` interface
- Updated `fetchAvailableCycles()` to map this new field from the database view
- Modified the locked message logic to use `previous_cycle_reflection_start` instead of the cycle's own `reflection_start`

## Verification

Query results confirm the fix is working:

```sql
SELECT title, cycle_position, previous_cycle_reflection_start
FROM v_global_cycles
WHERE title = 'Winter 2026';
```

Result:
- **Winter 2026**: `previous_cycle_reflection_start = "2025-12-21"`
- This is Fall 2025's reflection_start date, which is correct

## Expected Behavior After Fix

- **Winter 2026** will now display: "Available starting Dec 21 (during current cycle's reflection week)"
- This correctly indicates that Winter 2026 can be activated starting Dec 21, 2025 (during Fall 2025's reflection week)
- Users can plan for Winter 2026 during Fall 2025's reflection period, making the timeline useful

## Related Note: Reflection Date Calculation

During verification, discovered that some cycles have reflection_start dates that don't follow the expected formula:
- Expected: `reflection_start = end_date - 6 days` (last 7 days of cycle)
- Actual database values vary and some are after the end_date

This appears to be a separate data integrity issue that may need to be addressed in a future update. However, it doesn't affect the current fix since we're now correctly using the previous cycle's reflection_start (whatever it may be) rather than the wrong cycle's date.

## Files Modified

1. `/supabase/migrations/20251016020000_add_previous_cycle_reflection_to_view.sql` - New migration
2. `/components/timelines/ManageGlobalTimelinesContent.tsx` - Updated interface and logic

## Testing Recommendations

1. Verify Winter 2026 shows "Available starting Dec 21" instead of "Mar 22"
2. Test that the activation button remains locked until Dec 21
3. Verify other 2nd in line cycles show correct previous cycle reflection dates
4. Test cycle progression: when 2nd becomes active, verify 3rd becomes 2nd with updated date
