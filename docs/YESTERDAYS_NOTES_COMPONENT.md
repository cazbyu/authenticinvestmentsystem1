# Yesterday's Notes Component Documentation

## Overview
A fuel-adaptive component for reviewing and converting yesterday's brain dump notes into actionable items during the Morning Spark ritual. Features intelligent deferral options, multiple conversion actions, and seamless integration with tasks, events, and deposit ideas.

---

## Component Locations
- `components/morning-spark/YesterdaysNotes.tsx` - Main container component
- `components/morning-spark/NoteCard.tsx` - Individual note card with actions

---

## Fuel-Adaptive Behavior

### Level 1 (Low Energy) - Protective Mode

**Philosophy:** Minimize cognitive load, offer easy deferral

**Header Text:**
> "You created some notes for yourself yesterday. Would you like to defer them so they don't weigh on you?"

**Initial Display:**
1. Shows header text
2. Two prominent buttons:
   - **"Yes"** - Defer notes to Weekly Alignment
   - **"No"** - Expand to show notes
3. Note count preview below buttons

**After "Yes" (Deferred):**
- Shows confirmation message
- Notes remain in database (not deleted)
- Will appear in Weekly Alignment ritual
- "Review Now Instead" link to undo deferral

**After "No" (Expanded):**
- Shows all notes with action buttons
- Collapse button in header
- Full conversion capabilities

### Level 2 & 3 (Balanced/High Energy) - Full Engagement

**Header Text:**
> "You left these notes for yourself. Turn them into action, or file them away."

**Behavior:**
- Immediately shows all notes (no deferral option)
- All conversion actions available
- Encourages active processing
- Full engagement with yesterday's thoughts

---

## Data Fetching

### Query Logic

```sql
SELECT id, content, created_at
FROM "0008-ap-reflections"
WHERE
  user_id = $1
  AND reflection_type = 'brain_dump'
  AND archived = false
  AND created_at >= 'YESTERDAY 00:00:00'
  AND created_at < 'YESTERDAY 23:59:59'
ORDER BY created_at DESC
```

### Date Calculation

```typescript
const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);
const yesterdayDate = yesterday.toISOString().split('T')[0];

// Example: If today is 2026-01-08
// yesterdayDate = "2026-01-07"
```

### Note Structure

```typescript
interface Note {
  id: string;           // UUID
  content: string;      // Note text
  created_at: string;   // ISO timestamp
}
```

---

## Note Display

### Card Layout

```
┌─────────────────────────────────────────────┐
│ This is the note content from yesterday.    │
│ It can be multiple lines and will truncate │
│ after 150 characters with an ellipsis...   │
│                                             │
│ [Task] [Idea] [Event] [Log]                │
└─────────────────────────────────────────────┘
```

### Content Truncation

```typescript
function truncateContent(text: string, maxLength: number = 150): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}
```

**Usage:**
- Card display: 150 characters
- Modal preview: 100 characters
- Full content used in conversions

---

## Four Conversion Actions

### 1. Convert to Task

**Button:** Blue clipboard icon + "Task"

**Action Flow:**
1. Creates new task record
2. Deletes brain dump entry
3. Calls `onTaskCreated` callback
4. Shows success alert

**Database Operation:**
```sql
-- Create task
INSERT INTO "0008-ap-tasks" (
  user_id,
  type,
  title,
  description,
  due_date,
  status,
  priority
) VALUES (
  $1,
  'task',
  SUBSTRING($2, 1, 200),  -- First 200 chars as title
  CASE WHEN LENGTH($2) > 200 THEN $2 ELSE NULL END,  -- Rest as description
  CURRENT_DATE,
  'pending',
  'medium'
);

-- Delete brain dump
DELETE FROM "0008-ap-reflections"
WHERE id = $3;
```

**Result:**
- Task appears in today's task list
- Due date set to today
- Default priority: medium
- Added to accepted tasks array

### 2. Convert to Deposit Idea

**Button:** Orange lightbulb icon + "Idea"

**Action Flow:**
1. Creates deposit idea record
2. Deletes brain dump entry
3. Calls `onDepositIdeaCreated` callback
4. Shows success alert

**Database Operation:**
```sql
-- Create deposit idea
INSERT INTO "0008-ap-deposit-ideas" (
  user_id,
  title,
  description,
  status
) VALUES (
  $1,
  SUBSTRING($2, 1, 200),
  CASE WHEN LENGTH($2) > 200 THEN $2 ELSE NULL END,
  'pending'
);

-- Delete brain dump
DELETE FROM "0008-ap-reflections"
WHERE id = $3;
```

**Result:**
- Idea saved to deposit ideas bank
- Can be activated later
- Doesn't appear in today's contract
- Available in goals/ideas section

### 3. Convert to Event

**Button:** Purple calendar icon + "Event"

**Action Flow:**
1. Opens time picker modal
2. User selects start time
3. Creates event record (1-hour duration)
4. Deletes brain dump entry
5. Calls `onEventCreated` callback
6. Shows success alert

**Time Picker Modal:**
```
┌───────────────────────────────┐
│ Set Event Time                │
├───────────────────────────────┤
│ "This is the note content..." │
│                               │
│ 🕐 Start Time                 │
│ [Time Picker Dropdown]        │
│                               │
│ [Cancel] [Create Event]       │
└───────────────────────────────┘
```

**Database Operation:**
```sql
-- Create event
INSERT INTO "0008-ap-tasks" (
  user_id,
  type,
  title,
  description,
  start_date,
  start_time,
  end_time,
  status
) VALUES (
  $1,
  'event',
  SUBSTRING($2, 1, 200),
  CASE WHEN LENGTH($2) > 200 THEN $2 ELSE NULL END,
  CURRENT_DATE,
  $3,  -- Selected start time (e.g., "09:00")
  $4,  -- Calculated end time (start + 1 hour, e.g., "10:00")
  'pending'
);

-- Delete brain dump
DELETE FROM "0008-ap-reflections"
WHERE id = $5;
```

**Time Calculation:**
```typescript
// User selects: "09:00"
const [hours, minutes] = startTime.split(':');
const startDate = new Date();
startDate.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);

// Calculate end time (1 hour later)
const endDate = new Date(startDate);
endDate.setHours(endDate.getHours() + 1);

const endTime = `${endDate.getHours().toString().padStart(2, '0')}:${endDate
  .getMinutes()
  .toString()
  .padStart(2, '0')}`;

// Result: start_time = "09:00", end_time = "10:00"
```

**Result:**
- Event appears in today's schedule
- 1-hour duration by default
- Added to accepted events array
- Shows on calendar

### 4. Log (Acknowledge)

**Button:** Green checkmark icon + "Log"

**Action Flow:**
1. Deletes brain dump entry
2. Shows acknowledgment alert
3. No further action needed

**Database Operation:**
```sql
DELETE FROM "0008-ap-reflections"
WHERE id = $1;
```

**Result:**
- Note removed from database
- No task/event/idea created
- No points awarded
- Simple acknowledgment
- "I've seen this, don't need to act on it"

---

## Deferral System (Level 1 Only)

### Deferral Flow

**1. User Clicks "Yes":**
```typescript
function handleDeferNotes() {
  setDeferred(true);
  Alert.alert(
    'Notes Deferred',
    "Your notes will remain and appear in this week's alignment.",
    [{ text: 'OK' }]
  );
}
```

**2. State Changes:**
- `deferred = true`
- Notes remain in database (not deleted)
- UI shows confirmation message

**3. Display:**
```
┌───────────────────────────────┐
│         📄                    │
│                               │
│ Notes deferred to             │
│ Weekly Alignment              │
│                               │
│ You can review them during    │
│ your weekly reflection        │
│                               │
│ [Review Now Instead]          │
└───────────────────────────────┘
```

**4. Undo Option:**
- "Review Now Instead" link
- Sets `deferred = false`, `expanded = true`
- Shows full note list
- User can still process notes

### Weekly Alignment Integration

**When deferred:**
- Notes keep `archived = false`
- Query in Weekly Alignment:
  ```sql
  SELECT * FROM "0008-ap-reflections"
  WHERE
    reflection_type = 'brain_dump'
    AND archived = false
    AND created_at >= 'WEEK_START'
    AND created_at <= 'WEEK_END'
  ```
- Appears in "Outstanding Brain Dumps" section
- User processes during weekly review

---

## Empty State

### Display

```
┌───────────────────────────────┐
│         📄                    │
│                               │
│ No notes from yesterday.      │
│ You're all clear!             │
└───────────────────────────────┘
```

### Condition
```typescript
if (notes.length === 0) {
  return <EmptyState />;
}
```

**When This Happens:**
- No brain dump entries from yesterday
- All notes already processed
- User didn't create notes yesterday

---

## Props Interface

### YesterdaysNotes Props

```typescript
interface YesterdaysNotesProps {
  fuelLevel: 1 | 2 | 3;
  userId: string;
  onTaskCreated?: (task: any) => void;
  onEventCreated?: (event: any) => void;
  onDepositIdeaCreated?: (idea: any) => void;
}
```

### NoteCard Props

```typescript
interface NoteCardProps {
  note: {
    id: string;
    content: string;
    created_at: string;
  };
  onConvertToTask: (noteId: string, content: string) => Promise<void>;
  onConvertToDepositIdea: (noteId: string, content: string) => Promise<void>;
  onConvertToEvent: (noteId: string, content: string, startTime: string) => Promise<void>;
  onLog: (noteId: string) => Promise<void>;
}
```

---

## Usage Examples

### Basic Integration

```typescript
import { YesterdaysNotes } from '@/components/morning-spark/YesterdaysNotes';

function MorningSparkScreen() {
  const [fuelLevel, setFuelLevel] = useState<1 | 2 | 3>(2);
  const [userId, setUserId] = useState('user-123');
  const [acceptedTasks, setAcceptedTasks] = useState([]);
  const [acceptedEvents, setAcceptedEvents] = useState([]);
  const [depositIdeas, setDepositIdeas] = useState([]);

  function handleTaskCreated(task: any) {
    setAcceptedTasks(prev => [...prev, task]);
    console.log('Task created from note:', task.title);
  }

  function handleEventCreated(event: any) {
    setAcceptedEvents(prev => [...prev, event]);
    console.log('Event created from note:', event.title);
  }

  function handleDepositIdeaCreated(idea: any) {
    setDepositIdeas(prev => [...prev, idea]);
    console.log('Deposit idea created from note:', idea.title);
  }

  return (
    <ScrollView>
      <YesterdaysNotes
        fuelLevel={fuelLevel}
        userId={userId}
        onTaskCreated={handleTaskCreated}
        onEventCreated={handleEventCreated}
        onDepositIdeaCreated={handleDepositIdeaCreated}
      />
    </ScrollView>
  );
}
```

### With Morning Spark Context

```typescript
import { YesterdaysNotes } from '@/components/morning-spark/YesterdaysNotes';
import { useMorningSpark } from '@/contexts/MorningSparkContext';

export default function NotesReviewScreen() {
  const {
    fuelLevel,
    userId,
    addAcceptedTask,
    addAcceptedEvent,
    addDepositIdea,
  } = useMorningSpark();

  return (
    <SafeAreaView>
      <Header title="Yesterday's Notes" />
      <ScrollView>
        <YesterdaysNotes
          fuelLevel={fuelLevel || 2}
          userId={userId}
          onTaskCreated={(task) => addAcceptedTask(task)}
          onEventCreated={(event) => addAcceptedEvent(event)}
          onDepositIdeaCreated={(idea) => addDepositIdea(idea)}
        />
      </ScrollView>
      <NavigationButtons />
    </SafeAreaView>
  );
}
```

---

## State Management

### Component State

```typescript
const [loading, setLoading] = useState(true);
const [notes, setNotes] = useState<Note[]>([]);
const [expanded, setExpanded] = useState(false);
const [deferred, setDeferred] = useState(false);
```

### State Transitions

**Initial Load:**
```
loading = true
↓
Fetch notes from database
↓
loading = false
notes = [...data]
```

**Level 1 Flow:**
```
Initial: expanded = false, deferred = false
↓
User clicks "Yes"
↓
deferred = true (show deferred message)
↓
User clicks "Review Now Instead" (optional)
↓
deferred = false, expanded = true (show notes)
```

**Level 2/3 Flow:**
```
Initial: expanded = true immediately
↓
Show all notes with actions
```

**Note Conversion:**
```
User clicks action button
↓
loading = true on that card
↓
Create new record + Delete note
↓
Update notes array (remove converted note)
↓
Call parent callback
↓
Show success alert
```

---

## NoteCard State

### Component State

```typescript
const [timePickerVisible, setTimePickerVisible] = useState(false);
const [selectedTime, setSelectedTime] = useState('09:00');
const [loading, setLoading] = useState(false);
```

### Loading States

**During Conversion:**
```
┌─────────────────────────┐
│     [Loading Spinner]   │
└─────────────────────────┘
```

**Normal Display:**
```
┌─────────────────────────┐
│ Note content here...    │
│ [Task] [Idea] [Event]   │
└─────────────────────────┘
```

---

## Action Button Colors

### Visual Identity

- **Task (Blue):** `#3B82F6` - Action, execution
- **Idea (Orange):** `#F59E0B` - Creativity, potential
- **Event (Purple):** `#8B5CF6` - Calendar, scheduling
- **Log (Green):** `#10B981` - Completion, acknowledgment

### Button Style

```typescript
{
  backgroundColor: '#3B82F620',  // 20% opacity
  color: '#3B82F6',              // Full opacity text
  icon: '#3B82F6',               // Full opacity icon
}
```

---

## Database Schema Requirements

### Required Tables

**0008-ap-reflections:**
```sql
CREATE TABLE "0008-ap-reflections" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  reflection_type TEXT NOT NULL,  -- 'brain_dump', 'daily', 'weekly', etc.
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  archived BOOLEAN DEFAULT false,
  parent_type TEXT,
  parent_id UUID
);

CREATE INDEX idx_reflections_user_type_date
ON "0008-ap-reflections"(user_id, reflection_type, created_at)
WHERE archived = false;
```

**0008-ap-tasks:**
```sql
-- Already exists, ensure these columns present:
CREATE TABLE "0008-ap-tasks" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type TEXT NOT NULL,  -- 'task', 'event', 'ritual'
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  start_date DATE,
  start_time TIME,
  end_time TIME,
  status TEXT DEFAULT 'pending',
  priority TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
```

**0008-ap-deposit-ideas:**
```sql
-- Already exists, ensure these columns present:
CREATE TABLE "0008-ap-deposit-ideas" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
```

---

## Error Handling

### Loading Errors

```typescript
try {
  // Fetch notes
} catch (error) {
  console.error('Error loading notes:', error);
  Alert.alert('Error', 'Failed to load notes. Please try again.');
}
```

### Conversion Errors

```typescript
try {
  // Convert note
} catch (error) {
  console.error('Error converting to task:', error);
  Alert.alert('Error', 'Failed to convert note. Please try again.');
  throw error;  // Re-throw to keep card visible
}
```

**Behavior:**
- Shows user-friendly error alert
- Logs technical details to console
- Card remains visible (conversion didn't happen)
- User can retry action

### Transaction Safety

**Not Atomic:**
```typescript
// Create new record
await supabase.from('0008-ap-tasks').insert(...);

// Delete brain dump
await supabase.from('0008-ap-reflections').delete(...);
```

**Risk:** If delete fails, record is created but note remains

**Mitigation:**
- Notes can be converted multiple times if needed
- Weekly alignment cleanup handles orphaned notes
- Low-risk scenario (user sees note again, can log it)

---

## Integration Points

### Morning Spark Flow

**Step Sequence:**
1. Select fuel level
2. Review scheduled events
3. Review tasks
4. **Review yesterday's notes** ← This component
5. Brain dump for today
6. Commit to contract

### Callback Integration

**onTaskCreated:**
```typescript
// Parent component
function handleTaskCreated(task: any) {
  setAcceptedTasks(prev => [...prev, task]);
  const points = calculateTaskPoints(task);
  setTotalPoints(prev => prev + points);
}
```

**onEventCreated:**
```typescript
// Parent component
function handleEventCreated(event: any) {
  setAcceptedEvents(prev => [...prev, event]);
  const points = calculateEventPoints(event);
  setTotalPoints(prev => prev + points);
}
```

**onDepositIdeaCreated:**
```typescript
// Parent component
function handleDepositIdeaCreated(idea: any) {
  setDepositIdeas(prev => [...prev, idea]);
  // Deposit ideas don't add to today's contract
  // But tracked for weekly statistics
}
```

---

## Weekly Alignment Connection

### Deferred Notes Query

```typescript
// In Weekly Alignment component
const { data: deferredNotes } = await supabase
  .from('0008-ap-reflections')
  .select('*')
  .eq('user_id', userId)
  .eq('reflection_type', 'brain_dump')
  .eq('archived', false)
  .gte('created_at', weekStartDate)
  .lte('created_at', weekEndDate)
  .order('created_at', { ascending: false });
```

### Display in Weekly Review

**Section: "Outstanding Brain Dumps"**
```
You have 3 unprocessed brain dump notes from this week:

📝 "Remember to call dentist about appointment"
   Created: Mon, Jan 6 at 8:34 PM
   [Convert to Task] [Archive]

📝 "Idea for new feature: user onboarding flow"
   Created: Tue, Jan 7 at 2:15 PM
   [Convert to Deposit Idea] [Archive]

📝 "Follow up with John about project timeline"
   Created: Wed, Jan 8 at 5:45 PM
   [Convert to Task] [Archive]
```

**Actions:**
- Convert to task
- Convert to deposit idea
- Archive (mark archived = true)

---

## Performance Considerations

### Optimizations

1. **Date-Filtered Query:** Only fetches yesterday's notes
2. **Index Usage:** Uses indexed columns (user_id, reflection_type, created_at)
3. **No Pagination:** Single day's notes (typically < 20)
4. **Efficient Updates:** Direct state manipulation on conversion
5. **Lazy Time Picker:** Modal only loads when needed

### Typical Load Times

- **Fetch notes:** 50-150ms
- **Convert to task:** 100-200ms
- **Convert to event:** 100-200ms
- **Delete note:** 50-100ms

---

## Accessibility

### Features

- Clear action button labels
- Color + icon for action types
- Large touch targets (min 44x44)
- Screen reader compatible
- High contrast text

### Color Contrast

All action buttons meet WCAG AA standards:
- Blue on light blue background
- Orange on light orange background
- Purple on light purple background
- Green on light green background

---

## User Experience Flow

### Level 1 Journey (Low Energy)

```
1. User sees: "Would you like to defer these notes?"
2. User thinks: "I'm tired, I'll handle this later"
3. User taps: "Yes"
4. System shows: "Notes deferred to Weekly Alignment"
5. User feels: Relief, protected from overwhelm
6. Result: Moves forward with ritual, notes safely stored
```

### Level 2/3 Journey (High Energy)

```
1. User sees: All notes displayed with actions
2. User reviews first note: "Call dentist"
3. User taps: "Task"
4. System creates: Task for today
5. User sees: Note disappears, count updates
6. User reviews next note: "New feature idea"
7. User taps: "Idea"
8. System creates: Deposit idea
9. User continues processing all notes
10. Result: Yesterday's thoughts converted to today's actions
```

---

## Testing Checklist

- [ ] Component loads notes from database
- [ ] Yesterday's date calculated correctly
- [ ] Only brain dump notes fetched
- [ ] Level 1 shows defer buttons initially
- [ ] Level 2/3 show notes immediately
- [ ] "Yes" button defers notes
- [ ] "No" button expands notes
- [ ] Deferred state shows confirmation
- [ ] "Review Now Instead" undoes deferral
- [ ] Empty state displays when no notes
- [ ] Note content truncates at 150 chars
- [ ] Convert to Task creates task record
- [ ] Convert to Task deletes note
- [ ] Convert to Task calls callback
- [ ] Convert to Deposit Idea creates idea record
- [ ] Convert to Deposit Idea deletes note
- [ ] Convert to Deposit Idea calls callback
- [ ] Convert to Event opens time picker
- [ ] Time picker shows note preview
- [ ] Time picker default to 9:00 AM
- [ ] Convert to Event creates event record
- [ ] Event duration set to 1 hour
- [ ] Convert to Event deletes note
- [ ] Convert to Event calls callback
- [ ] Log action deletes note
- [ ] Log action shows confirmation
- [ ] Note count updates after actions
- [ ] Loading states display correctly
- [ ] Error handling works
- [ ] Collapse button works (Level 1)
- [ ] TypeScript compiles without errors
- [ ] Notes appear in Weekly Alignment when deferred

---

## Future Enhancements

### Potential Features

1. **Bulk Actions:**
   - Select multiple notes
   - Convert all to tasks at once
   - Archive all at once

2. **Smart Suggestions:**
   - AI suggests action type
   - "This looks like a task" badge
   - "This looks like an idea" badge

3. **Note Editing:**
   - Edit note content before converting
   - Add context or details
   - Fix typos

4. **Rich Conversions:**
   - Convert to task with role assignment
   - Convert to event with location
   - Convert with priority level

5. **Historical View:**
   - See notes from past week
   - Review previously converted notes
   - Undo conversions

6. **Voice Notes:**
   - Record audio notes
   - Transcribe automatically
   - Convert transcription to actions

7. **Note Linking:**
   - Link related notes
   - Thread conversations
   - Track idea evolution

8. **Templates:**
   - Quick conversion templates
   - Pre-filled task details
   - Custom workflows

---

## Common User Scenarios

### Scenario 1: Late Night Capture

**Context:** User captured thoughts at 11:00 PM

**Notes:**
- "Don't forget gym bag tomorrow"
- "Review presentation slides"
- "Call mom on her birthday"

**Level 1 Flow:**
1. See notes in morning
2. Feeling low energy
3. Click "Yes" to defer
4. Continue with ritual
5. Review in Weekly Alignment

**Level 2/3 Flow:**
1. See notes immediately
2. Convert "gym bag" → Task
3. Convert "review slides" → Task
4. Convert "call mom" → Event (set time)
5. All handled, ready for day

### Scenario 2: Creative Brainstorm

**Context:** User had creative ideas yesterday

**Notes:**
- "New app feature: dark mode toggle"
- "Blog post idea: productivity tips"
- "Business idea: coaching platform"

**Flow:**
1. See notes
2. Convert all to Deposit Ideas
3. Don't need to act today
4. Safely stored for later activation
5. Continue with ritual focused on today

### Scenario 3: Nothing to Review

**Context:** User didn't create notes yesterday

**Flow:**
1. Component loads
2. Query returns empty array
3. See empty state: "No notes from yesterday"
4. Feel good (clean slate)
5. Move to next section

---

## Notes for Developers

### Database Cleanup

**Orphaned Notes:**
Notes that should have been processed but weren't:

```sql
-- Find old brain dumps
SELECT *
FROM "0008-ap-reflections"
WHERE
  reflection_type = 'brain_dump'
  AND archived = false
  AND created_at < NOW() - INTERVAL '7 days';

-- Archive old brain dumps (weekly cleanup)
UPDATE "0008-ap-reflections"
SET archived = true
WHERE
  reflection_type = 'brain_dump'
  AND archived = false
  AND created_at < NOW() - INTERVAL '7 days';
```

**Suggested Cron Job:**
```typescript
// Run weekly on Sunday night
async function cleanupOldBrainDumps() {
  const { data, error } = await supabase
    .from('0008-ap-reflections')
    .update({ archived: true })
    .eq('reflection_type', 'brain_dump')
    .eq('archived', false)
    .lt('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

  console.log(`Archived ${data?.length || 0} old brain dumps`);
}
```

### Context Integration

Add to `MorningSparkContext.tsx`:

```typescript
const [yesterdayNotes, setYesterdayNotes] = useState<Note[]>([]);
const [notesDeferred, setNotesDeferred] = useState(false);

function handleNoteConverted(type: 'task' | 'event' | 'idea', item: any) {
  if (type === 'task') {
    setAcceptedTasks(prev => [...prev, item]);
  } else if (type === 'event') {
    setAcceptedEvents(prev => [...prev, item]);
  } else if (type === 'idea') {
    setDepositIdeas(prev => [...prev, item]);
  }
}
```

---

## Design Philosophy

### Cognitive Load Management

**Level 1 (Low Energy):**
- Single question: "Defer or review?"
- Easy escape hatch
- Protects from overwhelm
- Defers decision to later (when more capable)

**Level 2/3 (High Energy):**
- Full engagement encouraged
- Multiple conversion options
- Active processing
- Clean up loose ends

### Action Hierarchy

**Immediate Action (Task/Event):**
- Adds to today's contract
- Requires processing now
- High cognitive cost
- High value (clears mental space)

**Future Action (Deposit Idea):**
- Adds to idea bank
- No immediate commitment
- Low cognitive cost
- Medium value (captured for later)

**No Action (Log):**
- Simple acknowledgment
- Zero future commitment
- Lowest cognitive cost
- Low value (but clears list)

### Conversion Logic

**Why 200-character title limit?**
- Most notes are < 200 chars
- Longer notes need structure
- Description field for overflow
- Forces clarity in titles

**Why 1-hour default duration?**
- Standard meeting length
- Can be adjusted after creation
- Better than no duration
- Aligns with calendar norms

**Why delete after conversion?**
- Prevents duplicate processing
- Clean separation of concerns
- Note served its purpose
- Reduces clutter

---

*Component created: January 2026*
