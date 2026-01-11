# ScheduledEvents Component Documentation

## Overview
A fuel-adaptive component for reviewing, rescheduling, and managing today's calendar events during the Morning Spark ritual. Events can be kept, rescheduled to another day, or cancelled entirely.

---

## Component Location
- `components/morning-spark/ScheduledEvents.tsx` - Main component
- `components/morning-spark/RescheduleModal.tsx` - Date/time picker modal

---

## Features

### 1. **Fuel-Adaptive Headers**
The component shows different prompts based on fuel level:

**Level 1 (Low Energy):**
> "Here are your scheduled events. Should we reschedule any of these to protect your energy?"

**Level 2 & 3 (Balanced/High Energy):**
> "Let's take care of today's big rocks first. Here is your time-map for the day."

### 2. **Event Fetching**
Automatically loads today's events from database:
- **Query:** `SELECT * FROM "0008-ap-tasks"`
- **Filters:**
  - `type = 'event'`
  - `start_date = today`
  - `status = 'pending'`
  - `deleted_at IS NULL`
- **Order:** By `start_time` ASC
- **Point Calculation:** Uses `calculateTaskPoints()` utility

### 3. **Event Display**
Each event card shows:
- **Time:** Formatted as "9:00 AM"
- **Duration:** Calculated from start/end time (e.g., "1h 30m")
- **Title:** Event name
- **Priority Badge:** Color-coded (high=red, medium=orange, low=green)
- **Points Badge:** "+5", "+3", etc.

### 4. **Three Interaction Zones**

**Keep Zone (Default):**
- Green checkmark icon
- Shows count: "Keep (3)"
- All events start here
- Events here will be accepted into the contract

**Reschedule Zone:**
- Orange clock icon
- Shows count: "To Reschedule (1)"
- Warning background
- Opens date/time picker modal

**Cancel Zone:**
- Red warning triangle icon
- Shows "⚠️ Items here will be deleted (2)"
- Danger background
- Permanently cancels events

### 5. **User Interactions**

**Tap Event:**
- Selects/deselects event
- Shows blue border when selected

**Tap Action Buttons:**
- Each event has two buttons:
  - "Reschedule" (orange) - Moves to reschedule zone
  - "Cancel" (red) - Moves to cancel zone

**Multi-Select:**
- Select multiple events
- Action bar appears at bottom
- Batch move to reschedule or cancel zones

### 6. **Reschedule Modal**

**Date Picker:**
- Simple +/- buttons to adjust date
- Defaults to tomorrow
- Displays formatted date (e.g., "Tue, Jan 8")

**Time Pickers:**
- Separate controls for hour and minute
- +/- buttons for adjustment
- Minutes increment by 15
- Shows 24-hour format and 12-hour preview
- End time picker (if event has end time)

**Actions:**
- "Cancel" - Closes modal without changes
- "Update" - Saves new date/time

### 7. **Database Operations**

**Reschedule:**
```typescript
UPDATE "0008-ap-tasks"
SET
  start_date = newDate,
  start_time = newStartTime,
  end_time = newEndTime,
  times_rescheduled = times_rescheduled + 1
WHERE id = eventId
```

**Cancel:**
```typescript
UPDATE "0008-ap-tasks"
SET
  status = 'cancelled',
  deleted_at = NOW()
WHERE id IN (cancelledEventIds)
```

### 8. **Button States**

**Initial State:**
- Text: "Keep As Is"
- Color: Gray (disabled appearance)
- Disabled: true

**After Changes:**
- Text: "Update"
- Color: Primary theme color
- Disabled: false

**While Saving:**
- Shows loading spinner
- Disabled: true

**After Update:**
- Returns to "Keep As Is" state
- Zones clear (except Keep zone)

---

## Props Interface

```typescript
interface ScheduledEventsProps {
  fuelLevel: 1 | 2 | 3;
  userId: string;
  onEventsAccepted: (events: Event[]) => void;
}

interface Event {
  id: string;
  title: string;
  description?: string;
  start_date: string;
  start_time: string;
  end_time?: string;
  priority?: string;
  points?: number;
}
```

---

## Usage Example

### Basic Integration:

```typescript
import { ScheduledEvents } from '@/components/morning-spark/ScheduledEvents';
import { useState } from 'react';

function ScheduledActionsScreen() {
  const [userId, setUserId] = useState('user-123');
  const [fuelLevel, setFuelLevel] = useState<1 | 2 | 3>(2);
  const [acceptedEvents, setAcceptedEvents] = useState<Event[]>([]);

  function handleEventsAccepted(events: Event[]) {
    setAcceptedEvents(events);
    // Calculate total points
    const totalPoints = events.reduce((sum, e) => sum + (e.points || 0), 0);
    // Update parent state
  }

  return (
    <ScrollView>
      <ScheduledEvents
        fuelLevel={fuelLevel}
        userId={userId}
        onEventsAccepted={handleEventsAccepted}
      />
    </ScrollView>
  );
}
```

### Integration with Morning Spark Context:

```typescript
import { ScheduledEvents } from '@/components/morning-spark/ScheduledEvents';
import { useMorningSpark } from '@/contexts/MorningSparkContext';

export default function ScheduledActionsScreen() {
  const { fuelLevel, setAcceptedEvents } = useMorningSpark();
  const [userId, setUserId] = useState('');

  useEffect(() => {
    loadUser();
  }, []);

  async function loadUser() {
    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setUserId(user.id);
  }

  return (
    <SafeAreaView>
      <Header title="Scheduled Actions" />
      <ScrollView>
        {userId && (
          <ScheduledEvents
            fuelLevel={fuelLevel || 2}
            userId={userId}
            onEventsAccepted={(events) => setAcceptedEvents(events)}
          />
        )}
      </ScrollView>
      <NavigationButtons />
    </SafeAreaView>
  );
}
```

---

## Component Behavior Flow

### Loading State:
1. Component mounts
2. Shows loading spinner
3. Fetches today's events from database
4. Calculates points for each event
5. Initializes all events in "Keep" zone
6. Calls `onEventsAccepted` with initial event list

### User Interaction Flow:
1. **User views events** - All start in Keep zone
2. **User taps event** - Event gets blue border (selected)
3. **User taps "Reschedule"** - Event moves to Reschedule zone
4. **Modal opens** - User adjusts date/time
5. **User saves** - Event rescheduled, removed from list
6. **Component updates** - onEventsAccepted called with remaining events
7. **User taps "Update"** - Cancelled events deleted from database
8. **Final state** - Only kept events remain, button resets

---

## State Management

### Local State:

```typescript
const [loading, setLoading] = useState(true);
const [eventStates, setEventStates] = useState<EventState[]>([]);
const [rescheduleModalVisible, setRescheduleModalVisible] = useState(false);
const [selectedEventForReschedule, setSelectedEventForReschedule] = useState<Event | null>(null);
const [hasChanges, setHasChanges] = useState(false);
const [saving, setSaving] = useState(false);
```

### Event State Structure:

```typescript
interface EventState {
  event: Event;
  zone: 'keep' | 'reschedule' | 'cancel';
  selected: boolean;
}
```

---

## Key Functions

### `loadTodaysEvents()`
- Fetches today's events from Supabase
- Calculates points using `calculateTaskPoints()`
- Initializes event states
- Calls `onEventsAccepted` with all events

### `moveEventTo(eventId, zone)`
- Moves single event to specified zone
- Opens modal if zone is 'reschedule'
- Sets `hasChanges` to true

### `moveSelectedTo(zone)`
- Batch moves all selected events
- Clears selection after move
- Sets `hasChanges` to true

### `handleReschedule(eventId, newDate, newStartTime, newEndTime)`
- Updates event in database
- Increments `times_rescheduled`
- Removes event from current list
- Closes modal

### `handleUpdate()`
- Cancels events in cancel zone
- Updates status and deleted_at
- Filters to only kept events
- Calls `onEventsAccepted` with final list
- Resets state

---

## Time Formatting Utilities

### `formatTime(time: string): string`
Converts "09:30" to "9:30 AM"

### `calculateDuration(startTime: string, endTime?: string): string`
Returns formatted duration:
- "30m" for 30 minutes
- "1h" for 1 hour
- "1h 30m" for 1 hour 30 minutes

### `getPriorityColor(priority?: string): string`
Returns color based on priority:
- high → #EF4444 (red)
- medium → #F59E0B (orange)
- low → #10B981 (green)

---

## Empty State

When no events for today:
- Shows calendar icon
- Message: "No events scheduled for today"
- Doesn't show zones or update button

---

## Error Handling

**Loading Errors:**
- Shows Alert with error message
- Allows user to retry
- Logs error to console

**Reschedule Errors:**
- Shows Alert with error message
- Modal remains open
- User can try again or cancel

**Update Errors:**
- Shows Alert with error message
- Maintains current state
- Re-enables update button

---

## Reschedule Modal Features

### Date Selection:
- Plus button: Advance one day
- Minus button: Go back one day
- Center display: Shows formatted date
- No minimum/maximum date limits

### Time Selection:
- **Hour Controls:**
  - Plus/minus buttons
  - Range: 0-23 (24-hour format)
  - Wraps at boundaries
- **Minute Controls:**
  - Plus/minus buttons
  - Increments by 15 minutes
  - Auto-adjusts hour when wrapping
- **Time Preview:**
  - Shows 12-hour format: "9:30 AM"
  - Updates in real-time

### Modal Actions:
- **Cancel:** Closes without saving
- **Update:** Saves changes to database
- **X Button:** Same as Cancel

---

## Point Calculation

Uses `calculateTaskPoints()` from `lib/taskUtils.ts`:
- Based on event duration
- Based on priority level
- Based on other task properties
- Displays as "+X" badge on each event

---

## Styling Notes

### Color Scheme:
- Keep zone: Neutral with green accent
- Reschedule zone: Orange (#F59E0B) with light background
- Cancel zone: Red (#EF4444) with light background
- Selected events: Blue border (theme primary)

### Layout:
- Full-width cards with padding
- 8px gap between cards
- 12px gap between zones
- Rounded corners (8px cards, 12px zones)

### Touch Targets:
- Buttons: 40x40 minimum
- Event cards: Full height for tapping
- Action buttons: Full width within card

---

## Integration Points

### Where to Use:

1. **Morning Spark Flow** (Primary):
   - After fuel level selection
   - Before task review
   - Part of "Scheduled Actions" step

2. **Calendar View** (Alternative):
   - Quick reschedule interface
   - Day planning tool

3. **Dashboard** (Optional):
   - Today's events widget
   - Quick event management

---

## Database Schema

### Table: `0008-ap-tasks`

**Columns Used:**
- `id` - UUID primary key
- `user_id` - UUID foreign key
- `type` - 'event' | 'task' | 'ritual'
- `title` - Event name
- `description` - Optional details
- `start_date` - Date string (YYYY-MM-DD)
- `start_time` - Time string (HH:MM)
- `end_time` - Time string (HH:MM)
- `priority` - 'high' | 'medium' | 'low'
- `status` - 'pending' | 'completed' | 'cancelled'
- `deleted_at` - Timestamp (soft delete)
- `times_rescheduled` - Integer counter

---

## Example Use Cases

### Use Case 1: Protect Energy (Level 1)
**Scenario:** User has low energy, sees 5 meetings
**Action:**
- Reschedules 2 non-critical meetings to tomorrow
- Cancels 1 optional meeting
- Keeps 2 important meetings
**Result:** Reduced stress, manageable day

### Use Case 2: Confirm Schedule (Level 2)
**Scenario:** User has balanced energy, sees 4 meetings
**Action:**
- Reviews all meetings
- Keeps all as-is
- Proceeds to next step
**Result:** Confidence in day's structure

### Use Case 3: Optimize Day (Level 3)
**Scenario:** User has high energy, sees 3 meetings
**Action:**
- Keeps all meetings
- Excited to tackle the day
- Proceeds quickly
**Result:** Energized and ready

---

## Testing Checklist

- [ ] Component loads events from database
- [ ] Events display with correct time/title/points
- [ ] Priority badges show correct colors
- [ ] Duration calculates correctly
- [ ] Tapping event toggles selection
- [ ] "Reschedule" button opens modal
- [ ] "Cancel" button moves to cancel zone
- [ ] Multi-select works (multiple events)
- [ ] Action bar appears when events selected
- [ ] Batch move to reschedule works
- [ ] Batch move to cancel works
- [ ] Reschedule modal opens with correct data
- [ ] Date adjustment works (+/- buttons)
- [ ] Time adjustment works (hour/minute)
- [ ] Time preview shows correct 12-hour format
- [ ] Modal "Update" saves to database
- [ ] times_rescheduled increments correctly
- [ ] Rescheduled event removed from list
- [ ] Cancel action updates database
- [ ] deleted_at set correctly
- [ ] status changes to 'cancelled'
- [ ] Update button enabled after changes
- [ ] Update button shows loading spinner
- [ ] onEventsAccepted called with final list
- [ ] Empty state shows when no events
- [ ] Error handling works for all operations
- [ ] Fuel level header changes correctly
- [ ] Component works on mobile and web

---

## Future Enhancements

Potential improvements:
1. **Drag-and-drop** - Visual dragging to zones
2. **Bulk reschedule** - Reschedule multiple to same time
3. **Event details** - Expand to show description
4. **Conflict detection** - Warn about overlapping events
5. **Suggested reschedule times** - AI-based suggestions
6. **Quick actions** - Swipe gestures for mobile
7. **Undo/redo** - Reverse accidental moves
8. **Event templates** - Quick create similar events
9. **Calendar integration** - Sync with Google/Outlook
10. **Attendee management** - See who's invited

---

## Performance Considerations

### Optimizations:
- Loads only today's events (filtered at database)
- Points calculated once on load
- Event states managed locally
- Minimal re-renders (React.memo candidates)
- Batch database updates

### Scalability:
- Works efficiently with 20+ events
- Handles empty state gracefully
- No pagination needed (single day view)

---

## Accessibility

### Features:
- Touch targets meet 44x44 minimum
- Color contrast meets WCAG AA
- Screen reader compatible
- Keyboard navigation support (web)
- Clear visual feedback for all interactions

---

## Notes for Developers

### Points Integration:
Ensure `calculateTaskPoints()` exists in `lib/taskUtils.ts`:
```typescript
export function calculateTaskPoints(task: any): number {
  // Implementation based on task properties
  return points;
}
```

### Database Migration:
Ensure `times_rescheduled` column exists:
```sql
ALTER TABLE "0008-ap-tasks"
ADD COLUMN IF NOT EXISTS times_rescheduled INTEGER DEFAULT 0;
```

### Context Integration:
Add to `MorningSparkContext.tsx`:
```typescript
const [acceptedEvents, setAcceptedEvents] = useState<Event[]>([]);
```

---

*Component created: January 2026*
