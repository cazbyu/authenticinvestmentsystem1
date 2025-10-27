# Goal Bank Timeline Display Fix

## Problem Summary

The Goal Bank page had two main issues:

1. **Initial Flash**: When first visiting the Goal Bank, users would briefly see the "No Active Timelines" message before the actual timeline list loaded.

2. **Navigation Return Issue**: When navigating away from Goal Bank and returning, the "No Active Timelines" message would appear and stay visible, even though timelines exist. The timeline list wouldn't reload properly.

## Root Cause

The `resetToMain()` function was too aggressive - it cleared all state including the timeline list whenever the tab was pressed. This caused:

- The timeline list (`timelinesWithGoals`) to be reset to an empty array
- The "No Active Timelines" empty state to be shown immediately
- A race condition where the empty state appeared before the async timeline fetch completed

## Solution Implemented

### 1. Separate Loading State for Timelines

Added a dedicated `loadingTimelines` state to track when timelines are being fetched:

```typescript
const [loadingTimelines, setLoadingTimelines] = useState(true);
```

This ensures the loading spinner shows during fetch operations instead of the empty state.

### 2. Timeline Data Caching

Implemented a cache to preserve timeline data between navigation:

```typescript
const timelinesDataCache = useRef<any[]>([]);
```

When timelines are fetched, they're stored in the cache. When returning to the page, cached data is restored immediately.

### 3. Soft Reset vs Full Reset

Split the reset functionality into two functions:

**Soft Reset** (`softResetToTimelines`):
- Clears selected timeline and its associated data
- Preserves the timeline list and cache
- Used when tab is pressed (navigation between pages)
- Restores cached timelines if available

**Full Reset** (`resetToMain`):
- Clears everything including cache
- Only used on component unmount
- Prevents memory leaks

### 4. Improved Data Flow

Updated `fetchTimelinesWithGoalCounts()` to cache data:

```typescript
setTimelinesWithGoals(timelinesWithCounts);
// Cache the timeline data
timelinesDataCache.current = timelinesWithCounts;
```

Updated render logic to use dedicated loading state:

```typescript
{loadingTimelines ? (
  <View style={styles.loadingContainer}>
    <ActivityIndicator size="large" color="#0078d4" />
    <Text style={styles.loadingText}>Loading timelines...</Text>
  </View>
) : timelinesWithGoals.length === 0 ? (
  // Show empty state
) : (
  // Show timeline list
)}
```

## Changes Made

### File: `app/(tabs)/goals.tsx`

1. **Added new state and refs** (lines 480, 486):
   - `loadingTimelines` state for tracking timeline fetch operations
   - `timelinesDataCache` ref for caching timeline data

2. **Split reset functions** (lines 505-556):
   - `softResetToTimelines()` - preserves timeline data, restores from cache
   - `resetToMain()` - full cleanup including cache

3. **Updated initialization** (lines 558-586):
   - Register soft reset for tab press events
   - Use full reset only on unmount
   - Made initialization async with proper error handling

4. **Enhanced fetchAllTimelines** (lines 649-787):
   - Set `loadingTimelines` to true at start
   - Set `loadingTimelines` to false after completion or error
   - Proper loading state management

5. **Updated cache logic** (lines 858-860):
   - Store timeline data in cache after fetching
   - Enables instant restoration on return

6. **Fixed render logic** (line 1143):
   - Use `loadingTimelines` instead of generic `loading` state
   - Ensures proper loading indicator display

## Benefits

1. **No More Flash**: Loading spinner shows while timelines are being fetched, preventing the empty state from flashing.

2. **Instant Return Navigation**: When returning to Goal Bank, cached timelines are displayed immediately with no delay.

3. **Better UX**: Users see a consistent experience with proper loading states instead of confusing empty state messages.

4. **Preserved Context**: The last selected timeline ID is still tracked for potential future enhancements.

5. **Proper Resource Management**: Full cleanup only happens on unmount, preventing memory leaks.

## Testing Recommendations

1. **Initial Load**:
   - Visit Goal Bank for the first time
   - Should see loading spinner, then timeline list (no flash)

2. **Navigation Return**:
   - Visit Goal Bank, navigate to another tab, return to Goal Bank
   - Should see cached timelines immediately (no empty state)

3. **Empty State**:
   - Test with a fresh user who has no timelines
   - Should see loading spinner, then proper empty state with action buttons

4. **Timeline Selection**:
   - Select a timeline, navigate away, return
   - Should return to timeline list (soft reset working correctly)

## Future Enhancements

- Consider implementing auto-restoration of the last selected timeline
- Add pull-to-refresh functionality for manual timeline reload
- Implement optimistic updates for timeline creation/deletion
