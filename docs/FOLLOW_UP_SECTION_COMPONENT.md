# Follow-Up Section Component Documentation

## Overview
A fuel-adaptive component for reviewing and acting on follow-up items during the Morning Spark ritual. Unifies follow-ups from tasks, deposit ideas, and reflections into a single actionable list with four action options per item.

---

## Component Locations
- `components/morning-spark/FollowUpSection.tsx` - Main container component
- `components/morning-spark/FollowUpItem.tsx` - Individual follow-up item card
- Database view: `v_morning_spark_follow_ups`

---

## Fuel-Adaptive Behavior

### Level 1 (Low Energy) - Hidden/Collapsed

**Philosophy:** Minimize cognitive load, make optional

**Initial Display:**
```
┌────────────────────────────────────┐
│ Follow-Ups Waiting             ▼  │
│ 3 items need attention            │
└────────────────────────────────────┘
```

**Behavior:**
- Collapsed by default
- Small footer section
- Shows count only
- Tap to expand (optional)
- Completely skippable

**Rationale:**
- Level 1 users should focus on essentials
- Follow-ups can wait until energy recovers
- Don't add to overwhelm
- Optional review

### Level 2 (Balanced Energy) - After Deposit Ideas

**Philosophy:** Address waiting items with balanced energy

**Position:** After Deposit Ideas section

**Header Text:**
> "These are the items you requested follow up for today."

**Display:**
- Fully expanded by default
- Grouped by type (Tasks, Ideas, Notes)
- Shows all pending follow-ups
- Four actions per item

**Rationale:**
- Level 2 users can handle follow-up decisions
- Good time to clear waiting items
- Balanced energy for decision-making
- Prevents backlog buildup

### Level 3 (High Energy) - After Deposit Ideas

**Philosophy:** Same as Level 2, clear the deck

**Position:** After Deposit Ideas section

**Header Text:**
> "These are the items you requested follow up for today."

**Display:**
- Fully expanded
- Same as Level 2
- High energy = faster processing

**Rationale:**
- Level 3 users have energy to spare
- Can quickly process follow-ups
- Clear waiting items efficiently
- Move forward with clarity

---

## Database Schema

### Universal Follow-Up Join Table

**Table:** `0008-ap-universal-follow-up-join`

```sql
CREATE TABLE "0008-ap-universal-follow-up-join" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  parent_type TEXT NOT NULL CHECK (
    parent_type IN (
      'task', 'event', 'depositIdea', 'withdrawal',
      'goal', 'custom_goal', '1y_goal', 'reflection'
    )
  ),
  parent_id UUID NOT NULL,
  follow_up_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'snoozed', 'done', 'cancelled')
  ),
  reason_type TEXT CHECK (
    reason_type IN (
      'review', 'decide', 'check_outcome',
      'waiting_for', 'other'
    )
  ),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_follow_up_user_date_status
ON "0008-ap-universal-follow-up-join"(user_id, follow_up_date, status);
```

### Morning Spark View

**View:** `v_morning_spark_follow_ups`

```sql
CREATE OR REPLACE VIEW v_morning_spark_follow_ups AS
SELECT
  fu.id AS follow_up_id,
  fu.user_id,
  fu.parent_type,
  fu.parent_id,
  fu.follow_up_date,
  fu.status,
  fu.reason_type,
  fu.reason,
  fu.created_at,
  CASE
    WHEN fu.parent_type IN ('task', 'event') THEN t.title
    WHEN fu.parent_type = 'depositIdea' THEN di.title
    WHEN fu.parent_type = 'reflection' THEN r.reflection_title
    ELSE NULL
  END AS title,
  CASE
    WHEN fu.parent_type IN ('task', 'event') THEN t.completed_at
    ELSE NULL
  END AS completed_at,
  CASE
    WHEN fu.parent_type = 'depositIdea' THEN di.archived
    WHEN fu.parent_type = 'reflection' THEN r.archived
    ELSE false
  END AS archived
FROM "0008-ap-universal-follow-up-join" fu
LEFT JOIN "0008-ap-tasks" t
  ON fu.parent_type IN ('task', 'event')
  AND fu.parent_id = t.id
LEFT JOIN "0008-ap-deposit-ideas" di
  ON fu.parent_type = 'depositIdea'
  AND fu.parent_id = di.id
LEFT JOIN "0008-ap-reflections" r
  ON fu.parent_type = 'reflection'
  AND fu.parent_id = r.id
WHERE fu.status = 'pending'
  AND fu.follow_up_date <= CURRENT_DATE;
```

**View Filters:**
- Only `status = 'pending'` items
- Only items with `follow_up_date <= today`
- Automatically excludes future follow-ups
- Excludes done/cancelled items

---

## Data Fetching

### Query Logic

```typescript
const { data, error } = await supabase
  .from('v_morning_spark_follow_ups')
  .select('*')
  .eq('user_id', userId)
  .order('follow_up_date', { ascending: true });
```

**Returns:**
```typescript
interface FollowUpItemData {
  follow_up_id: string;        // Follow-up record ID
  user_id: string;
  parent_type: 'task' | 'event' | 'depositIdea' | 'reflection';
  parent_id: string;           // ID of parent item
  title: string;               // Title from parent item
  follow_up_date: string;      // Date of follow-up
  status: string;              // Always 'pending' from view
  reason_type?: string;        // Why follow-up exists
  reason?: string;             // Free-text reason
  created_at: string;          // When follow-up was created
  completed_at?: string;       // Parent completion (tasks/events)
  archived: boolean;           // Parent archived status
}
```

### Grouping Logic

```typescript
function groupItems(): GroupedItems {
  const groups: GroupedItems = {
    tasks: [],    // task + event
    ideas: [],    // depositIdea
    notes: [],    // reflection
  };

  followUps.forEach((item) => {
    if (item.parent_type === 'task' || item.parent_type === 'event') {
      groups.tasks.push(item);
    } else if (item.parent_type === 'depositIdea') {
      groups.ideas.push(item);
    } else if (item.parent_type === 'reflection') {
      groups.notes.push(item);
    }
  });

  return groups;
}
```

---

## Four Actions Per Item

### 1. Take Action

**Icon:** ✓ CheckCircle2 (Primary color)

**Button Text:** "Take Action"

**Behavior:**

**For Tasks/Events:**
```typescript
// Move to today + mark important
UPDATE "0008-ap-tasks"
SET
  due_date = CURRENT_DATE,
  is_important = true
WHERE id = parent_id;

// Mark follow-up complete
UPDATE "0008-ap-universal-follow-up-join"
SET
  status = 'done',
  completed_at = NOW()
WHERE id = follow_up_id;
```

**For Deposit Ideas:**
```typescript
// Create task for today
INSERT INTO "0008-ap-tasks" (
  user_id,
  type,
  title,
  due_date,
  status,
  is_important,
  is_urgent
) VALUES (
  userId,
  'task',
  idea.title,
  CURRENT_DATE,
  'pending',
  true,
  false
);

// Mark idea as activated
UPDATE "0008-ap-deposit-ideas"
SET
  activated_at = NOW(),
  activated_task_id = new_task_id
WHERE id = parent_id;

// Mark follow-up complete
UPDATE "0008-ap-universal-follow-up-join"
SET status = 'done', completed_at = NOW()
WHERE id = follow_up_id;
```

**For Reflections:**
```typescript
// Create review task
INSERT INTO "0008-ap-tasks" (
  user_id,
  type,
  title,
  due_date,
  status,
  is_important,
  is_urgent
) VALUES (
  userId,
  'task',
  'Review: ' + reflection.title,
  CURRENT_DATE,
  'pending',
  true,
  false
);

// Mark follow-up complete
UPDATE "0008-ap-universal-follow-up-join"
SET status = 'done', completed_at = NOW()
WHERE id = follow_up_id;
```

**Result:**
- Item added to today's contract
- Follow-up removed from list
- Success notification
- Haptic feedback

### 2. File Away

**Icon:** 📁 Archive (Secondary color)

**Button Text:** "File Away"

**Behavior:**

**For Tasks/Events:**
- Not applicable (tasks stay in system)
- Action disabled

**For Deposit Ideas:**
```typescript
// Archive the idea
UPDATE "0008-ap-deposit-ideas"
SET archived = true
WHERE id = parent_id;

// Mark follow-up complete
UPDATE "0008-ap-universal-follow-up-join"
SET status = 'done', completed_at = NOW()
WHERE id = follow_up_id;
```

**For Reflections:**
```typescript
// Archive the reflection
UPDATE "0008-ap-reflections"
SET archived = true
WHERE id = parent_id;

// Mark follow-up complete
UPDATE "0008-ap-universal-follow-up-join"
SET status = 'done', completed_at = NOW()
WHERE id = follow_up_id;
```

**Result:**
- Parent item archived
- Follow-up removed from list
- No task created
- Success notification

### 3. Delay

**Icon:** 🕐 Clock (Secondary color)

**Button Text:** "Delay"

**Behavior:**
- Opens modal: "How many days to delay?"
- Default: 7 days
- User enters number
- Confirms

```typescript
// Calculate new date
const newDate = new Date();
newDate.setDate(newDate.getDate() + delayDays);

// Update follow-up date
UPDATE "0008-ap-universal-follow-up-join"
SET
  follow_up_date = newDate,
  status = 'snoozed'
WHERE id = follow_up_id;
```

**Result:**
- Follow-up date pushed forward
- Status changes to 'snoozed'
- Removed from today's list
- Will reappear on new date
- Success notification: "Delayed for X days"

### 4. Dismiss

**Icon:** ✕ X (Red color)

**Button Text:** "Dismiss"

**Behavior:**
- Shows confirmation alert
- "Are you sure? Cannot be undone."
- User confirms

```typescript
// Cancel the follow-up
UPDATE "0008-ap-universal-follow-up-join"
SET
  status = 'cancelled',
  completed_at = NOW()
WHERE id = follow_up_id;
```

**Result:**
- Follow-up permanently cancelled
- Parent item unchanged
- Removed from list
- Cannot be restored
- Success notification

---

## Item Display

### Card Layout

```
┌────────────────────────────────────────────────┐
│ [📋] Review Q4 goals                      [+] │
│      TASK • Follow-up: 2 days ago             │
└────────────────────────────────────────────────┘

When expanded:
┌────────────────────────────────────────────────┐
│ [📋] Review Q4 goals                      [−] │
│      TASK • Follow-up: 2 days ago             │
├────────────────────────────────────────────────┤
│ ✓ Take Action                                 │
│ 📁 File Away                                   │
│ 🕐 Delay                                       │
│ ✕ Dismiss                                      │
└────────────────────────────────────────────────┘
```

### Type Icons

**Tasks:** 📋 ListTodo (Primary color)
**Events:** 📅 Calendar (Primary color)
**Ideas:** 💡 Lightbulb (Orange #F59E0B)
**Notes:** 📄 FileText (Purple #8B5CF6)

### Date Display

```typescript
function formatDate(dateString: string): string {
  const diffDays = getDaysDifference(dateString, today);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
  }
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });
}
```

### Grouping Display

```
TASKS & EVENTS (3)
├─ Review Q4 goals
├─ Check project status
└─ Team meeting follow-up

DEPOSIT IDEAS (2)
├─ Launch new course
└─ Write blog series

NOTES (1)
└─ Weekly reflection insights
```

---

## User Interactions

### Expand/Collapse Item

**Interaction:** Tap item card

**Behavior:**
- Collapses any other open items
- Expands tapped item
- Shows 4 action buttons
- Haptic feedback (light)

### Action Button Press

**Interaction:** Tap action button

**Behavior:**
- Executes corresponding action
- Disables all buttons during processing
- Shows loading state
- Haptic feedback (medium)
- Updates UI on success
- Shows alert confirmation

### Delay Modal

**Interaction:** Tap "Delay" button

**Opens Modal:**
```
┌─────────────────────────────────┐
│ Delay Follow-Up                 │
│                                 │
│ How many days would you like to │
│ delay this?                     │
│                                 │
│ [    7    ]                     │
│                                 │
│ [ Cancel ] [ Confirm ]          │
└─────────────────────────────────┘
```

**Input:**
- Number pad keyboard
- Default: 7 days
- Validates: must be >= 1
- Auto-focus on input

### Dismiss Confirmation

**Interaction:** Tap "Dismiss" button

**Shows Alert:**
```
┌─────────────────────────────────┐
│ Dismiss Follow-Up               │
│                                 │
│ Are you sure you want to        │
│ dismiss this follow-up? This    │
│ action cannot be undone.        │
│                                 │
│ [ Cancel ] [ Dismiss ]          │
└─────────────────────────────────┘
```

**Buttons:**
- Cancel: Dismissive style
- Dismiss: Destructive style (red)

---

## Props Interface

### FollowUpSection Props

```typescript
interface FollowUpSectionProps {
  fuelLevel: 1 | 2 | 3;
  userId: string;
  onItemActioned?: () => void;
}
```

### FollowUpItem Props

```typescript
interface FollowUpItemProps {
  item: FollowUpItemData;
  onTakeAction: (item: FollowUpItemData) => void;
  onFileAway: (item: FollowUpItemData) => void;
  onDelay: (item: FollowUpItemData) => void;
  onDismiss: (item: FollowUpItemData) => void;
  disabled?: boolean;
}
```

---

## Usage Examples

### Basic Integration

```typescript
import { FollowUpSection } from '@/components/morning-spark/FollowUpSection';

function MorningSparkScreen() {
  const [fuelLevel, setFuelLevel] = useState<1 | 2 | 3>(2);
  const [userId, setUserId] = useState('user-123');

  function handleItemActioned() {
    // Refresh other sections if needed
    console.log('Follow-up item actioned');
  }

  return (
    <ScrollView>
      <GoalsReview />

      <DepositIdeas
        fuelLevel={fuelLevel}
        userId={userId}
      />

      <FollowUpSection
        fuelLevel={fuelLevel}
        userId={userId}
        onItemActioned={handleItemActioned}
      />

      <ScheduledActions />
    </ScrollView>
  );
}
```

### Conditional Rendering by Fuel Level

```typescript
export default function MorningSparkFlow() {
  const { fuelLevel, userId } = useMorningSpark();

  return (
    <ScrollView>
      <FuelLevelSelector />
      <GoalsReview />
      <DepositIdeas />

      {/* Levels 2 & 3: Show after deposit ideas */}
      {fuelLevel && fuelLevel >= 2 && (
        <FollowUpSection
          fuelLevel={fuelLevel}
          userId={userId}
          onItemActioned={handleItemActioned}
        />
      )}

      <ScheduledActions />

      {/* Level 1: Show at bottom (collapsed) */}
      {fuelLevel === 1 && (
        <FollowUpSection
          fuelLevel={fuelLevel}
          userId={userId}
          onItemActioned={handleItemActioned}
        />
      )}
    </ScrollView>
  );
}
```

### With Action Tracking

```typescript
import { FollowUpSection } from '@/components/morning-spark/FollowUpSection';

export default function FollowUpStep() {
  const { fuelLevel, userId } = useMorningSpark();
  const [actionedCount, setActionedCount] = useState(0);

  function handleItemActioned() {
    setActionedCount(prev => prev + 1);

    // Track analytics
    trackEvent('follow_up_actioned', {
      fuel_level: fuelLevel,
      total_actioned: actionedCount + 1,
    });
  }

  return (
    <SafeAreaView>
      <Header title="Follow-Ups" />

      <FollowUpSection
        fuelLevel={fuelLevel || 2}
        userId={userId}
        onItemActioned={handleItemActioned}
      />

      {actionedCount > 0 && (
        <Text style={styles.progress}>
          Processed {actionedCount} follow-up{actionedCount > 1 ? 's' : ''}
        </Text>
      )}

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
const [processing, setProcessing] = useState<string | null>(null);
const [followUps, setFollowUps] = useState<FollowUpItemData[]>([]);
const [collapsed, setCollapsed] = useState(fuelLevel === 1);
const [delayModalVisible, setDelayModalVisible] = useState(false);
const [delayItem, setDelayItem] = useState<FollowUpItemData | null>(null);
const [delayDays, setDelayDays] = useState('7');
```

### State Transitions

**Initial Load:**
```
loading = true
↓
Fetch follow-ups from view
↓
loading = false
followUps = [...items]
```

**Take Action Flow:**
```
User taps "Take Action"
↓
processing = item.follow_up_id
↓
Update parent item (task/idea/reflection)
Mark follow-up as done
↓
Remove from list
processing = null
Show success alert
```

**Delay Flow:**
```
User taps "Delay"
↓
delayModalVisible = true
delayItem = item
↓
User enters days
User taps "Confirm"
↓
processing = item.follow_up_id
delayModalVisible = false
↓
Update follow-up date
Update status to 'snoozed'
↓
Remove from list
processing = null
Show success alert
```

**Collapse/Expand (Level 1):**
```
Initial: collapsed = true
↓
User taps collapsed header
↓
collapsed = false
Show full section
↓
User taps collapse button
↓
collapsed = true
Show minimal footer
```

---

## GTD Philosophy

### Why Follow-Ups?

**Getting Things Done (GTD) Tickler File:**
- Items that need future attention
- "Waiting for" items
- Decisions to revisit
- Outcomes to check

**This system provides:**
- Single unified waiting list
- Daily surface of items
- Action-oriented interface
- Clear next steps

### Reason Types

**review:** Need to review again
**decide:** Need to make decision
**check_outcome:** Check if action worked
**waiting_for:** Waiting on someone/something
**other:** Custom reason

### Status Lifecycle

```
pending → Action taken → done
pending → Delayed → snoozed → (future) → pending
pending → Dismissed → cancelled
```

---

## Empty State

### No Follow-Ups

```
┌────────────────────────────────────┐
│              ✅                    │
│                                    │
│   All clear! No follow-ups for     │
│   today.                           │
└────────────────────────────────────┘
```

**When Shown:**
- No pending follow-ups for today
- All follow-ups actioned
- No snoozed items due today

---

## Performance Considerations

### Optimizations

1. **View Pre-Filtering:** Database view handles all filtering
2. **Single Query:** One query fetches all follow-ups
3. **Client Grouping:** Groups items client-side (fast)
4. **Indexed Queries:** Uses index on (user_id, follow_up_date, status)
5. **Optimistic Updates:** Removes items immediately after action

### Typical Load Times

- **Fetch follow-ups:** 50-150ms
- **Take action:** 150-250ms
- **File away:** 100-200ms
- **Delay:** 100-200ms
- **Dismiss:** 100-200ms

### Scaling Considerations

**With 10 follow-ups:**
- Instant load
- Snappy interactions
- No performance issues

**With 100 follow-ups:**
- Still fast (view filters to today only)
- Consider pagination if showing more
- May want "Show All" option

---

## Error Handling

### Loading Errors

```typescript
try {
  await loadFollowUps();
} catch (error) {
  console.error('Error loading follow-ups:', error);
  Alert.alert('Error', 'Failed to load follow-ups. Please try again.');
}
```

### Action Errors

```typescript
try {
  await handleTakeAction(item);
} catch (error) {
  console.error('Error taking action:', error);
  Alert.alert('Error', 'Failed to take action. Please try again.');
} finally {
  setProcessing(null);  // Re-enable actions
}
```

**Error Recovery:**
- Processing state resets
- Item remains in list
- User sees error message
- Can retry action

---

## Design Philosophy

### Why Four Actions?

**Comprehensive Coverage:**
- **Take Action:** Do it now
- **File Away:** Not needed anymore
- **Delay:** Do it later
- **Dismiss:** Never mind

**Covers all GTD outcomes:**
- Do
- Defer
- Delegate (via task)
- Delete

### Why Grouped by Type?

**Mental Model:**
- Tasks are actionable
- Ideas need activation
- Notes need review

**Scanning Efficiency:**
- Quick to scan by category
- See distribution at glance
- Process similar items together

### Why Tap to Expand?

**Progressive Disclosure:**
- Reduces visual clutter
- Focuses on one item at a time
- Clear action selection
- Prevents accidental taps

---

## Integration Points

### Morning Spark Flow

**Step Sequence (Level 2 & 3):**
1. Select fuel level
2. Review goals
3. Review deposit ideas
4. **Review follow-ups** ← This component
5. Review scheduled actions
6. Review tasks
7. Brain dump
8. Commit

**Step Sequence (Level 1):**
1. Select fuel level
2. Review goals
3. Review scheduled actions
4. Review tasks
5. Brain dump
6. Commit
7. **Follow-ups (optional)** ← This component (collapsed)

### Callback Integration

**onItemActioned:**
```typescript
// Parent component
function handleItemActioned() {
  // Refresh related sections
  reloadScheduledActions();
  reloadTasks();

  // Track analytics
  trackEvent('follow_up_actioned', {
    fuel_level: fuelLevel,
    timestamp: new Date().toISOString(),
  });

  // Update badge counts
  decrementFollowUpBadge();
}
```

---

## Common User Scenarios

### Scenario 1: Task Follow-Up

**Context:** User set follow-up on project task

**Item:**
- Type: Task
- Title: "Review Q4 goals"
- Follow-up: 2 days ago

**Flow:**
1. Sees task in follow-ups list
2. Taps to expand
3. Taps "Take Action"
4. Task moved to today
5. Marked as important
6. Follow-up removed from list
7. Task appears in scheduled actions

### Scenario 2: Deposit Idea Follow-Up

**Context:** User captured idea, set follow-up

**Item:**
- Type: Idea
- Title: "Launch new course"
- Follow-up: Yesterday

**Flow:**
1. Sees idea in follow-ups list
2. Remembers this idea
3. Taps to expand
4. Taps "Take Action"
5. Idea converted to task for today
6. Added to today's contract
7. Follow-up removed

### Scenario 3: Reflection Follow-Up

**Context:** User wants to revisit insight

**Item:**
- Type: Note
- Title: "Weekly reflection insights"
- Follow-up: Today

**Flow:**
1. Sees note in follow-ups
2. Taps to expand
3. Taps "Take Action"
4. Creates "Review: Weekly reflection insights" task
5. Task added to today
6. Follow-up removed
7. Can now review note when ready

### Scenario 4: Delay Follow-Up

**Context:** Not right time to address

**Item:**
- Type: Task
- Title: "Check project status"
- Follow-up: Today

**Flow:**
1. Sees task in follow-ups
2. Realizes needs more info first
3. Taps to expand
4. Taps "Delay"
5. Modal opens
6. Enters "7" days
7. Confirms
8. Follow-up rescheduled for next week
9. Removed from today's list

### Scenario 5: Dismiss Follow-Up

**Context:** No longer relevant

**Item:**
- Type: Idea
- Title: "Outdated project idea"
- Follow-up: 5 days ago

**Flow:**
1. Sees idea in follow-ups
2. Realizes no longer needed
3. Taps to expand
4. Taps "Dismiss"
5. Confirmation alert
6. Confirms dismissal
7. Follow-up permanently cancelled
8. Removed from list

---

## Testing Checklist

- [ ] Component loads follow-ups from view
- [ ] Only fetches user's own items
- [ ] Only shows pending items
- [ ] Only shows items with date <= today
- [ ] Level 1 shows collapsed by default
- [ ] Level 2 & 3 show expanded
- [ ] Groups items by type correctly
- [ ] Tasks and events in same group
- [ ] Empty state displays when no items
- [ ] Take Action creates/updates task
- [ ] Take Action for deposit idea activates it
- [ ] Take Action for reflection creates review task
- [ ] File Away archives parent item
- [ ] File Away marks follow-up done
- [ ] Delay opens modal
- [ ] Delay modal validates input
- [ ] Delay updates follow-up date
- [ ] Delay changes status to 'snoozed'
- [ ] Dismiss shows confirmation
- [ ] Dismiss marks follow-up cancelled
- [ ] Items removed from list after action
- [ ] Processing state disables actions
- [ ] Success alerts show after actions
- [ ] Haptic feedback works (non-web)
- [ ] Collapse/expand works (Level 1)
- [ ] Date formatting works correctly
- [ ] Type icons display correctly
- [ ] Group titles show correct counts
- [ ] TypeScript compiles without errors
- [ ] No duplicate keys in lists

---

## Future Enhancements

### Potential Features

1. **Bulk Actions:**
   - Select multiple items
   - Take action on all
   - Delay all by same duration
   - Dismiss multiple

2. **Smart Suggestions:**
   - AI suggests action
   - Considers context
   - Learns from patterns
   - Recommends delay duration

3. **Quick Actions:**
   - Swipe gestures
   - Swipe right: Take Action
   - Swipe left: Delay
   - Long press: Dismiss

4. **Reason Display:**
   - Show reason_type
   - Display custom reason
   - Edit reason in-place
   - Add notes before action

5. **History View:**
   - See actioned follow-ups
   - Restore dismissed items
   - View patterns
   - Analytics

6. **Custom Delay Presets:**
   - 1 day, 3 days, 1 week, 2 weeks
   - Custom presets per user
   - Remember last used
   - Quick select buttons

7. **Batch Delay:**
   - Delay all by X days
   - Snooze entire category
   - "Review after vacation"
   - Bulk reschedule

8. **Parent Item Preview:**
   - Tap to see full details
   - View parent context
   - See related items
   - Quick edit parent

---

## Notes for Developers

### Adding New Parent Types

To support new parent types:

1. **Update view:**
```sql
CASE
  WHEN fu.parent_type = 'new_type' THEN nt.title
  ...
END AS title
```

2. **Add JOIN:**
```sql
LEFT JOIN "new_table" nt
  ON fu.parent_type = 'new_type'
  AND fu.parent_id = nt.id
```

3. **Update icon mapping:**
```typescript
case 'new_type':
  return <NewIcon size={20} color={color} />;
```

4. **Update action handlers:**
```typescript
if (item.parent_type === 'new_type') {
  // Handle new type action
}
```

### Analytics Tracking

```typescript
// Track action taken
trackEvent('follow_up_action_taken', {
  action: 'take_action',
  parent_type: item.parent_type,
  fuel_level: fuelLevel,
  days_overdue: calculateOverdue(item.follow_up_date),
});

// Track delays
trackEvent('follow_up_delayed', {
  parent_type: item.parent_type,
  delay_days: delayDays,
  fuel_level: fuelLevel,
});

// Track dismissals
trackEvent('follow_up_dismissed', {
  parent_type: item.parent_type,
  days_since_created: calculateAge(item.created_at),
});
```

### Database Maintenance

```sql
-- Find old pending follow-ups
SELECT
  parent_type,
  COUNT(*) as count,
  MIN(follow_up_date) as oldest
FROM "0008-ap-universal-follow-up-join"
WHERE status = 'pending'
  AND follow_up_date < CURRENT_DATE - INTERVAL '30 days'
GROUP BY parent_type;

-- Clean up orphaned follow-ups
DELETE FROM "0008-ap-universal-follow-up-join"
WHERE status = 'done'
  AND completed_at < CURRENT_DATE - INTERVAL '90 days';
```

---

*Component created: January 2026*
