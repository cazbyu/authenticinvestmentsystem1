# Ritual Buttons Debug Guide

## Issue
The Morning Spark, Evening Review, and Weekly Alignment buttons are not showing on the dashboard.

## Debugging Added

### 1. Dashboard (`/app/(tabs)/dashboard.tsx`)
Added console logging in the `checkRitualAvailability` function:
- Logs when checking ritual availability
- Logs the results for each ritual (Morning Spark, Evening Review, Weekly Alignment)
- Shows whether each button should be displayed

**Look for in console:**
```
[Dashboard] Checking ritual availability for user: [user_id]
=== RITUAL BUTTON DEBUG ===
Show Morning Spark: true/false
Show Evening Review: true/false
Show Weekly Alignment: true/false
=== END DEBUG ===
```

### 2. Ritual Utils (`/lib/ritualUtils.ts`)

#### `shouldShowRitual()` function:
- Logs ritual type being checked
- Logs settings retrieved from database
- Logs whether ritual is available
- Logs whether user has completed ritual today
- Logs final decision on whether to show button

**Look for in console:**
```
[shouldShowRitual] Checking [ritual_type] for user [user_id]
[shouldShowRitual] Settings for [ritual_type]: {...}
[shouldShowRitual] Using settings for [ritual_type]: {...}
[shouldShowRitual] Is [ritual_type] available: true/false
[shouldShowRitual] Has completed [ritual_type] today: true/false
[shouldShowRitual] Should show [ritual_type]: true/false
```

#### `isRitualAvailable()` function:
- Logs settings being checked
- Logs if ritual is disabled
- For weekly_alignment: logs day of week and bonus window check
- Logs time window check result

**Look for in console:**
```
[isRitualAvailable] Checking settings: {...}
[isRitualAvailable] Ritual is disabled (if applicable)
[isRitualAvailable] Checking weekly_alignment, day of week: 0-6
[isRitualAvailable] Is in bonus window (Fri-Mon): true/false
[isRitualAvailable] In time window: true/false
```

#### `isWithinTimeWindow()` function:
- Logs current time and time window being checked
- Logs result of time window check

**Look for in console:**
```
[isWithinTimeWindow] Current time: HH:MM:SS, Window: HH:MM:SS - HH:MM:SS
[isWithinTimeWindow] Normal window check result: true/false
```

## Bug Fixed

### Weekly Alignment Window
**Problem:** Weekly Alignment was only showing on weekends (Saturday and Sunday)

**Fix:** Changed the availability check to include Friday-Monday (bonus window)

**Before:**
```typescript
const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // Only Sat & Sun
```

**After:**
```typescript
const isInBonusWindow = dayOfWeek === 5 || dayOfWeek === 6 || dayOfWeek === 0 || dayOfWeek === 1; // Fri-Mon
```

**Day Mapping:**
- 0 = Sunday
- 1 = Monday
- 5 = Friday
- 6 = Saturday

## Database Migration Applied

**Migration:** `20260101180000_populate_default_ritual_settings`

**Purpose:** Ensures all users have default ritual settings

**What it does:**
1. Creates default settings for users who don't have them
2. Sets up three ritual types for each user:
   - Morning Spark: Enabled, 00:00 - 12:00
   - Evening Review: Enabled, 17:00 - 23:59:59
   - Weekly Alignment: Enabled, 00:00 - 23:59:59
3. Safe to run multiple times (uses ON CONFLICT DO NOTHING)

## SQL Check Query

Run this in Supabase SQL Editor to verify ritual settings:

```sql
-- Check if users have ritual settings
SELECT
  COUNT(DISTINCT user_id) as users_with_settings,
  COUNT(*) as total_settings
FROM "0008-ap-user-ritual-settings";

-- Should see 3 settings per user (morning_spark, evening_review, weekly_alignment)
```

## Expected Behavior

### Morning Spark
- **Shows:** Every day from midnight to noon (00:00 - 12:00)
- **Hides:** After noon OR if already completed today

### Evening Review
- **Shows:** Every day from 5 PM to midnight (17:00 - 23:59:59)
- **Hides:** Before 5 PM OR if already completed today

### Weekly Alignment
- **Shows:** Friday-Monday (bonus window), all day
- **Hides:** Tuesday-Thursday OR if already completed this week

## Troubleshooting Steps

1. **Check Console Logs:** Look for the debug messages listed above
2. **Verify Ritual Settings Exist:** Run the SQL check query
3. **Check Current Time:** The time window logs will show your current time
4. **Check Day of Week:** For Weekly Alignment, verify it's Friday-Monday
5. **Check Completion Status:** Verify if the ritual has already been completed

## Testing

To test each button:

1. **Morning Spark:** Should show any day before noon if not completed
2. **Evening Review:** Should show any day after 5 PM if not completed
3. **Weekly Alignment:** Should show Friday-Monday if not completed this week

## Next Steps

After debugging is complete and buttons are working:
- Remove excessive console.log statements
- Keep only error logging
- Consider adding user-friendly error messages if needed
