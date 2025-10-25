# Week Start Day Implementation

## Overview

When users activate a global timeline in the 12-week goal system, they can now choose whether their weeks start on **Sunday** or **Monday**. This choice affects all week boundaries throughout the entire 12-week cycle.

## How It Works

### User Selection Impact

**Sunday Preference (Default):**
- Uses the original `start_date` from `0008-ap-global-cycles`
- No date adjustment applied
- Week 1 starts on the cycle's original start date

**Monday Preference:**
- Adds **+1 day** to the original `start_date`
- All 12 weeks are shifted forward by 1 day
- Week 1 starts on the day after the cycle's original start date

### Example

For the "Fall 2025 12 Week Timeline" with original start date of `2025-09-28`:

**Sunday Start (No Offset):**
- Week 1: 2025-09-28 to 2025-10-04
- Week 2: 2025-10-05 to 2025-10-11
- Week 3: 2025-10-12 to 2025-10-18

**Monday Start (+1 Day Offset):**
- Week 1: 2025-09-29 to 2025-10-05
- Week 2: 2025-10-06 to 2025-10-12
- Week 3: 2025-10-13 to 2025-10-19

## Database Implementation

### New Function: `generate_adjusted_global_weeks`

This function:
1. Reads the user's `week_start_day` preference from `0008-ap-user-global-timelines`
2. Retrieves the global cycle's `start_date` from `0008-ap-global-cycles`
3. Calculates the day offset:
   - `'sunday'` → 0 days offset
   - `'monday'` → +1 day offset
4. Generates all 12 weeks with the adjusted dates
5. Populates the `0008-ap-global-weeks` table

### Updated Function: `fn_activate_user_global_timeline`

When a user activates a timeline:
1. Creates the user timeline record with the selected `week_start_day`
2. Automatically calls `generate_adjusted_global_weeks()`
3. Pre-populates all week boundaries in the database
4. Returns the new timeline ID

### Automatic Trigger: `trg_generate_global_weeks`

A trigger automatically generates weeks when:
- A new timeline is inserted with status = 'active'
- An existing timeline's status changes to 'active'

## Frontend Integration

### Existing Code Compatibility

The implementation works seamlessly with existing code:

1. **Timeline Activation** (`ManageGlobalTimelinesModal.tsx`):
   - Users select Sunday or Monday via the existing modal
   - The choice is passed to `fn_activate_user_global_timeline()`
   - No additional frontend changes needed

2. **Week Display** (`goals.tsx`):
   - Fetches weeks from `v_unified_timeline_weeks` view
   - Automatically displays the correct adjusted dates
   - Week navigation shows the proper date ranges

3. **Views** (`v_unified_timeline_weeks`):
   - Joins `0008-ap-global-weeks` with user timeline data
   - Returns pre-calculated week boundaries
   - Ensures consistent date display across the app

## Data Flow

```
User activates timeline with "Monday" preference
    ↓
fn_activate_user_global_timeline() called
    ↓
Creates record in 0008-ap-user-global-timelines
    (stores: user_id, global_cycle_id, week_start_day='monday')
    ↓
Calls generate_adjusted_global_weeks()
    ↓
Reads cycle start_date: 2025-09-28
Applies +1 day offset
    ↓
Populates 0008-ap-global-weeks with adjusted dates:
    Week 1: 2025-09-29 to 2025-10-05
    Week 2: 2025-10-06 to 2025-10-12
    ... (all 12 weeks)
    ↓
Frontend reads from v_unified_timeline_weeks
    ↓
Displays adjusted week boundaries in UI
```

## Migration Details

**File:** `20251012190740_implement_week_start_day_adjustment.sql`

**Key Features:**
- Creates `generate_adjusted_global_weeks()` function
- Updates `fn_activate_user_global_timeline()` function
- Adds automatic trigger for week generation
- Backfills existing timelines with correct week data
- Includes comprehensive error handling

## Testing

To test the implementation:

1. **Activate a timeline with Sunday start:**
   - Week boundaries should match the original cycle dates
   - No offset applied

2. **Activate a timeline with Monday start:**
   - All week boundaries should be +1 day from the original
   - Verify Week 1 starts on a Monday (if original was Sunday)

3. **Check database directly:**
   ```sql
   SELECT week_number, week_start, week_end
   FROM "0008-ap-global-weeks"
   WHERE global_cycle_id = '<cycle_id>'
   ORDER BY week_number;
   ```

4. **Verify in UI:**
   - Navigate to Goals tab
   - Select the activated timeline
   - Use week navigation to verify dates match expectations
   - Check that "Week 1" displays the correct adjusted date range

## Important Notes

- Each global cycle can be activated multiple times by different users with different preferences
- Each user's preference is independent and doesn't affect other users
- Week records are stored per cycle, not per user timeline
- If multiple users activate the same cycle with different preferences, the last activation's weeks are stored (this is by design as weeks are calculated on-demand during activation)
- The system is backwards compatible - existing Sunday-based timelines continue to work
- All views and queries automatically respect the adjusted week boundaries

## Conclusion

The week start day implementation provides users with the flexibility to align their 12-week goals with their personal or organizational calendar preferences, ensuring that weekly planning and tracking align with their natural work rhythm.
