# Delegation Section Component Documentation

## Overview
A fuel-adaptive leadership component for reviewing delegated tasks during the Morning Spark ritual. Emphasizes leadership and team management at Level 3, with adaptive visibility based on energy levels.

---

## Component Locations
- `components/morning-spark/DelegationSection.tsx` - Main container component
- `components/morning-spark/DelegateItem.tsx` - Individual delegation item card
- Database view: `v_morning_spark_delegations`

---

## Fuel-Adaptive Behavior

### Level 1 (Low Energy) - Hidden/Collapsed

**Philosophy:** Focus on personal execution, not leadership

**Initial Display:**
```
┌────────────────────────────────────┐
│ Delegations Waiting            ▼  │
│ 2 delegations due                 │
└────────────────────────────────────┘
```

**Behavior:**
- Collapsed by default
- Small footer section
- Shows count only
- Tap to expand (optional)
- Completely skippable

**Rationale:**
- Level 1 users should focus on their own work
- Delegation review requires mental bandwidth
- Can wait until energy recovers
- Optional check-in

### Level 2 (Balanced Energy) - After Follow-Ups

**Philosophy:** Standard delegation management

**Position:** After Follow-Ups section

**Header:**
```
[👥] Delegated items due today
```

**Display:**
- Fully expanded by default
- List of all delegations due today
- Standard presentation
- Four actions per item

**Rationale:**
- Level 2 users can handle delegation review
- Good time to check team progress
- Balanced energy for leadership
- Maintain accountability

### Level 3 (High Energy) - Prominent Leadership Emphasis

**Philosophy:** Leadership as force multiplier

**Position:** After Follow-Ups section (prominent)

**Header:**
```
[🎯] Lead your team. Check these delegated items.
    Leadership is multiplying yourself through others
```

**Display:**
- Fully expanded
- Prominent header with icon
- Inspirational subtext
- Emphasis on leadership
- Same actions as Level 2

**Rationale:**
- Level 3 users have energy for leadership
- Emphasize force multiplier concept
- Inspire team management
- Highlight leadership impact

---

## Database Schema

### Delegates Table

**Table:** `0008-ap-delegates`

```sql
CREATE TABLE "0008-ap-delegates" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  completed BOOLEAN NOT NULL DEFAULT false,
  follow_up BOOLEAN NOT NULL DEFAULT false,
  due_date DATE,
  task_id UUID,
  status TEXT
);

CREATE INDEX idx_delegates_user_id
ON "0008-ap-delegates"(user_id);

CREATE INDEX idx_delegates_task_id
ON "0008-ap-delegates"(task_id);

CREATE INDEX idx_delegates_due_date
ON "0008-ap-delegates"(due_date);
```

### Morning Spark View

**View:** `v_morning_spark_delegations`

```sql
CREATE OR REPLACE VIEW v_morning_spark_delegations AS
SELECT
  d.id AS delegation_id,
  d.user_id,
  d.name AS delegate_name,
  d.email AS delegate_email,
  d.task_id,
  t.title AS task_title,
  d.due_date,
  d.completed,
  COALESCE(d.status, 'pending') AS status,
  d.notes,
  d.created_at,
  t.status AS task_status
FROM "0008-ap-delegates" d
LEFT JOIN "0008-ap-tasks" t
  ON d.task_id = t.id
WHERE d.task_id IS NOT NULL
  AND d.completed = false
  AND d.due_date IS NOT NULL
  AND d.due_date <= CURRENT_DATE
  AND COALESCE(d.status, 'pending') != 'cancelled';
```

**View Filters:**
- Only delegations with `task_id` (linked to tasks)
- Only `completed = false` items
- Only items with `due_date <= today`
- Excludes `status = 'cancelled'` items
- Automatically excludes future delegations

---

## Data Fetching

### Query Logic

```typescript
const { data, error } = await supabase
  .from('v_morning_spark_delegations')
  .select('*')
  .eq('user_id', userId)
  .order('due_date', { ascending: true });
```

**Returns:**
```typescript
interface DelegationItemData {
  delegation_id: string;       // Delegation record ID
  user_id: string;            // User who delegated
  delegate_name: string;      // Name of person delegated to
  delegate_email?: string;    // Email of delegate
  task_id: string;            // ID of delegated task
  task_title: string;         // Title of task
  due_date: string;           // Delegation due date
  completed: boolean;         // Completion status
  status: string;             // Delegation status
  notes?: string;             // Delegation notes/context
  created_at: string;         // When delegation was created
  task_status?: string;       // Status of the task itself
}
```

---

## Four Actions Per Item

### 1. Check Status (Mark Complete)

**Icon:** ✓ CheckCircle2 (Primary color)

**Button Text:** "Check Status (Mark Complete)"

**Behavior:**
- Shows confirmation alert
- "Has [delegate] completed [task]?"
- User confirms

```typescript
// Mark delegation complete
UPDATE "0008-ap-delegates"
SET
  completed = true,
  status = 'completed'
WHERE id = delegation_id;
```

**Result:**
- Delegation marked complete
- Removed from list
- Success alert: "Force multiplier bonus points earned"
- Haptic feedback

**Force Multiplier Concept:**
- Completing delegations earns bonus points (TBD)
- Rewards leadership behavior
- Encourages delegation practice
- Multiplier effect on productivity

### 2. Send Reminder

**Icon:** 🔔 Bell (Secondary color)

**Button Text:** "Send Reminder" + "Soon" badge

**Behavior:**
- Shows "Coming Soon" alert
- Feature placeholder for future implementation

**Planned Functionality:**
```typescript
// Future implementation
async function sendReminder(delegation: DelegationItemData) {
  // Send email to delegate
  await sendEmail({
    to: delegation.delegate_email,
    subject: `Reminder: ${delegation.task_title}`,
    body: `Hi ${delegation.delegate_name},
           This is a friendly reminder about: ${delegation.task_title}
           Due date: ${delegation.due_date}`,
  });

  // Or send in-app notification
  await sendNotification({
    user_id: delegation.delegate_id,
    message: `Reminder: ${delegation.task_title} is due`,
  });
}
```

**Result:**
- Currently shows placeholder alert
- No database changes
- Future: Will send reminder and log activity

### 3. Reschedule

**Icon:** 🕐 Clock (Secondary color)

**Button Text:** "Reschedule"

**Behavior:**
- Opens modal: "How many days to push forward?"
- Default: 3 days
- User enters number
- Confirms

```typescript
// Calculate new date
const newDate = new Date(currentDueDate);
newDate.setDate(newDate.getDate() + rescheduleDays);

// Update due date
UPDATE "0008-ap-delegates"
SET due_date = newDate
WHERE id = delegation_id;
```

**Result:**
- Due date pushed forward
- Removed from today's list
- Will reappear on new date
- Success notification: "Rescheduled for X days later"

### 4. Cancel Delegation

**Icon:** ✕ X (Red color)

**Button Text:** "Cancel Delegation"

**Behavior:**
- Shows confirmation alert
- "Are you sure you want to cancel this delegation to [delegate]?"
- User confirms

```typescript
// Cancel the delegation
UPDATE "0008-ap-delegates"
SET status = 'cancelled'
WHERE id = delegation_id;
```

**Result:**
- Delegation cancelled
- Removed from list
- Task remains in system (unaffected)
- Success notification

---

## Item Display

### Card Layout

```
┌────────────────────────────────────────────────┐
│ [👤] John Smith                           [+] │
│      Review quarterly goals                   │
│      📅 Due: Today                            │
└────────────────────────────────────────────────┘

When expanded:
┌────────────────────────────────────────────────┐
│ [👤] John Smith                           [−] │
│      Review quarterly goals                   │
│      📅 Due: Today                            │
├────────────────────────────────────────────────┤
│ ✓ Check Status (Mark Complete)               │
│ 🔔 Send Reminder                    [Soon]    │
│ 🕐 Reschedule                                  │
│ ✕ Cancel Delegation                           │
└────────────────────────────────────────────────┘

When overdue (red border):
┌════════════════════════════════════════════════┐
║ [👤] Sarah Johnson                       [+] ║
║      Complete project documentation          ║
║      📅 Due: 2 days overdue                  ║
└════════════════════════════════════════════════┘
```

### Visual Indicators

**Normal (Due Today or Future):**
- Border: 1px, normal color
- Due date: Normal text color
- Font weight: Regular

**Overdue:**
- Border: 2px, red (#EF4444)
- Due date: Red text (#EF4444)
- Font weight: Bold
- Visual urgency

### Date Display

```typescript
function formatDate(dateString: string): string {
  const diffDays = getDaysDifference(dateString, today);

  if (diffDays === 0) return 'Today';
  if (diffDays === -1) return 'Tomorrow';
  if (diffDays > 0) {
    if (diffDays === 1) return '1 day overdue';
    return `${diffDays} days overdue`;
  }
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });
}
```

---

## User Interactions

### Expand/Collapse Item

**Interaction:** Tap delegation card

**Behavior:**
- Collapses any other open items
- Expands tapped item
- Shows 4 action buttons
- Haptic feedback (light)

### Check Status Button

**Interaction:** Tap "Check Status" button

**Shows Confirmation:**
```
┌─────────────────────────────────┐
│ Mark Complete                   │
│                                 │
│ Has John Smith completed        │
│ "Review quarterly goals"?       │
│                                 │
│ [ Cancel ] [ Yes, Complete ]    │
└─────────────────────────────────┘
```

**On Confirm:**
- Marks delegation complete
- Removes from list
- Shows success with "Force multiplier bonus points earned"
- Haptic feedback (success)

### Send Reminder Button

**Interaction:** Tap "Send Reminder" button

**Shows Alert:**
```
┌─────────────────────────────────┐
│ Coming Soon                     │
│                                 │
│ Send Reminder feature will      │
│ allow you to notify your        │
│ delegate via email or in-app    │
│ notification.                   │
│                                 │
│ [ OK ]                          │
└─────────────────────────────────┘
```

### Reschedule Modal

**Interaction:** Tap "Reschedule" button

**Opens Modal:**
```
┌─────────────────────────────────┐
│ Reschedule Delegation           │
│                                 │
│ How many days would you like to │
│ push this forward?              │
│                                 │
│ [    3    ]                     │
│                                 │
│ [ Cancel ] [ Confirm ]          │
└─────────────────────────────────┘
```

**Input:**
- Number pad keyboard
- Default: 3 days
- Validates: must be >= 1
- Auto-focus on input

### Cancel Confirmation

**Interaction:** Tap "Cancel Delegation" button

**Shows Alert:**
```
┌─────────────────────────────────┐
│ Cancel Delegation               │
│                                 │
│ Are you sure you want to cancel │
│ this delegation to John Smith?  │
│                                 │
│ [ No ] [ Yes, Cancel ]          │
└─────────────────────────────────┘
```

**Buttons:**
- No: Cancel style
- Yes, Cancel: Destructive style (red)

---

## Props Interface

### DelegationSection Props

```typescript
interface DelegationSectionProps {
  fuelLevel: 1 | 2 | 3;
  userId: string;
  onDelegationCompleted?: () => void;
}
```

### DelegateItem Props

```typescript
interface DelegateItemProps {
  item: DelegationItemData;
  onCheckStatus: (item: DelegationItemData) => void;
  onSendReminder: (item: DelegationItemData) => void;
  onReschedule: (item: DelegationItemData) => void;
  onCancel: (item: DelegationItemData) => void;
  disabled?: boolean;
}
```

---

## Usage Examples

### Basic Integration

```typescript
import { DelegationSection } from '@/components/morning-spark/DelegationSection';

function MorningSparkScreen() {
  const [fuelLevel, setFuelLevel] = useState<1 | 2 | 3>(3);
  const [userId, setUserId] = useState('user-123');

  function handleDelegationCompleted() {
    console.log('Delegation completed');
    // Refresh other sections if needed
  }

  return (
    <ScrollView>
      <GoalsReview />
      <DepositIdeas />
      <FollowUpSection />

      <DelegationSection
        fuelLevel={fuelLevel}
        userId={userId}
        onDelegationCompleted={handleDelegationCompleted}
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
      <FollowUpSection />

      {/* Levels 2 & 3: Show after follow-ups */}
      {fuelLevel && fuelLevel >= 2 && (
        <DelegationSection
          fuelLevel={fuelLevel}
          userId={userId}
          onDelegationCompleted={handleDelegationCompleted}
        />
      )}

      <ScheduledActions />

      {/* Level 1: Show at bottom (collapsed) */}
      {fuelLevel === 1 && (
        <DelegationSection
          fuelLevel={fuelLevel}
          userId={userId}
          onDelegationCompleted={handleDelegationCompleted}
        />
      )}
    </ScrollView>
  );
}
```

### With Completion Tracking

```typescript
import { DelegationSection } from '@/components/morning-spark/DelegationSection';

export default function DelegationStep() {
  const { fuelLevel, userId } = useMorningSpark();
  const [completedCount, setCompletedCount] = useState(0);
  const [forceMultiplierPoints, setForceMultiplierPoints] = useState(0);

  function handleDelegationCompleted() {
    const newCount = completedCount + 1;
    setCompletedCount(newCount);

    // Calculate force multiplier bonus
    const bonusPoints = calculateForceMultiplierBonus(newCount);
    setForceMultiplierPoints(bonusPoints);

    // Track analytics
    trackEvent('delegation_completed', {
      fuel_level: fuelLevel,
      total_completed: newCount,
      bonus_points: bonusPoints,
    });
  }

  return (
    <SafeAreaView>
      <Header title="Delegations" />

      <DelegationSection
        fuelLevel={fuelLevel || 2}
        userId={userId}
        onDelegationCompleted={handleDelegationCompleted}
      />

      {completedCount > 0 && (
        <View style={styles.stats}>
          <Text style={styles.statsText}>
            Completed: {completedCount} delegation{completedCount > 1 ? 's' : ''}
          </Text>
          <Text style={styles.bonusText}>
            Force Multiplier Bonus: +{forceMultiplierPoints} pts
          </Text>
        </View>
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
const [delegations, setDelegations] = useState<DelegationItemData[]>([]);
const [collapsed, setCollapsed] = useState(fuelLevel === 1);
const [rescheduleModalVisible, setRescheduleModalVisible] = useState(false);
const [rescheduleItem, setRescheduleItem] = useState<DelegationItemData | null>(null);
const [rescheduleDays, setRescheduleDays] = useState('3');
```

### State Transitions

**Initial Load:**
```
loading = true
↓
Fetch delegations from view
↓
loading = false
delegations = [...items]
```

**Check Status Flow:**
```
User taps "Check Status"
↓
Show confirmation alert
User taps "Yes, Complete"
↓
processing = item.delegation_id
↓
Update delegation: completed = true, status = 'completed'
↓
Remove from list
processing = null
Show success alert with bonus points
```

**Reschedule Flow:**
```
User taps "Reschedule"
↓
rescheduleModalVisible = true
rescheduleItem = item
↓
User enters days
User taps "Confirm"
↓
processing = item.delegation_id
rescheduleModalVisible = false
↓
Update due_date
↓
Remove from list
processing = null
Show success alert
```

**Cancel Flow:**
```
User taps "Cancel Delegation"
↓
Show confirmation alert
User taps "Yes, Cancel"
↓
processing = item.delegation_id
↓
Update status to 'cancelled'
↓
Remove from list
processing = null
Show success alert
```

---

## Leadership Philosophy

### Force Multiplier Concept

**What is a Force Multiplier?**
- In military terms: factors that dramatically increase effectiveness
- In leadership: ability to multiply impact through others
- Delegation as leverage

**Why This Matters:**
- One person can only do so much
- Effective delegation multiplies output
- Leadership = enabling others to succeed

**Bonus Points System (TBD):**
```typescript
function calculateForceMultiplierBonus(
  completedCount: number
): number {
  // Base bonus per delegation
  const baseBonus = 10;

  // Multiplier for consistent delegation
  const multiplier = Math.min(completedCount / 5, 3);

  return Math.floor(baseBonus * multiplier);
}
```

**Examples:**
- 1st delegation complete: +10 pts
- 5th delegation complete: +20 pts
- 10th delegation complete: +30 pts (max)

### Level 3 Leadership Emphasis

**Why Different at Level 3?**
- High energy = capacity for leadership
- Leadership requires mental bandwidth
- Force multiplier effect most valuable

**Visual Emphasis:**
- Target icon (🎯) instead of users icon
- Inspirational subtext
- Larger, bolder header
- Premium feel

**Subtext Options:**
```
"Leadership is multiplying yourself through others"
"Great leaders multiply their impact"
"Delegation is the highest leverage activity"
"Your team is your force multiplier"
```

---

## Empty State

### No Delegations

```
┌────────────────────────────────────┐
│              👥                    │
│                                    │
│   No delegated items due today.   │
└────────────────────────────────────┘
```

**When Shown:**
- No delegations due today
- All delegations completed
- No overdue delegations

---

## Performance Considerations

### Optimizations

1. **View Pre-Filtering:** Database view handles all filtering
2. **Single Query:** One query fetches all delegations
3. **Indexed Queries:** Uses indexes on (user_id, due_date, task_id)
4. **Optimistic Updates:** Removes items immediately after action
5. **JOIN Performance:** LEFT JOIN with tasks for titles

### Typical Load Times

- **Fetch delegations:** 50-150ms
- **Check status:** 100-200ms
- **Reschedule:** 100-200ms
- **Cancel:** 100-200ms

### Scaling Considerations

**With 5-10 delegations:**
- Instant load
- Snappy interactions
- No performance issues

**With 20+ delegations:**
- Consider grouping by delegate
- Add filtering options
- Pagination for large teams

---

## Error Handling

### Loading Errors

```typescript
try {
  await loadDelegations();
} catch (error) {
  console.error('Error loading delegations:', error);
  Alert.alert('Error', 'Failed to load delegations. Please try again.');
}
```

### Action Errors

```typescript
try {
  await handleCheckStatus(item);
} catch (error) {
  console.error('Error marking complete:', error);
  Alert.alert('Error', 'Failed to mark complete. Please try again.');
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

**Comprehensive Delegation Management:**
- **Check Status:** Primary action - mark complete
- **Send Reminder:** Communication tool (future)
- **Reschedule:** Flexibility for changing priorities
- **Cancel:** Clean up invalid delegations

**Coverage:**
- Complete: Task done
- Remind: Need nudge
- Reschedule: Need more time
- Cancel: No longer valid

### Why Overdue Emphasis?

**Visual Urgency:**
- Red border = immediate attention
- Bold text = importance
- Clear signal = action needed

**Accountability:**
- Shows delegation management
- Highlights follow-up needs
- Maintains team trust

### Why Leadership Emphasis at Level 3?

**High Energy = High Leverage:**
- Level 3 users have bandwidth
- Can think strategically
- Ready for team management

**Inspiration:**
- Subtext motivates
- Leadership framing empowers
- Force multiplier concept resonates

---

## Integration Points

### Morning Spark Flow

**Step Sequence (Level 2 & 3):**
1. Select fuel level
2. Review goals
3. Review deposit ideas
4. Review follow-ups
5. **Review delegations** ← This component
6. Review scheduled actions
7. Review tasks
8. Brain dump
9. Commit

**Step Sequence (Level 1):**
1. Select fuel level
2. Review goals
3. Review scheduled actions
4. Review tasks
5. Brain dump
6. Commit
7. **Delegations (optional)** ← This component (collapsed)

### Callback Integration

**onDelegationCompleted:**
```typescript
// Parent component
function handleDelegationCompleted() {
  // Refresh related sections
  reloadTasks();
  reloadScheduledActions();

  // Update force multiplier score
  updateForceMultiplierScore();

  // Track analytics
  trackEvent('delegation_completed', {
    fuel_level: fuelLevel,
    timestamp: new Date().toISOString(),
  });

  // Update badge counts
  decrementDelegationBadge();
}
```

---

## Common User Scenarios

### Scenario 1: Check Completed Delegation

**Context:** Team member completed task on time

**Item:**
- Delegate: John Smith
- Task: "Review quarterly goals"
- Due: Today

**Flow:**
1. Sees delegation in list
2. Taps to expand
3. Taps "Check Status (Mark Complete)"
4. Confirms completion
5. Delegation marked complete
6. Removed from list
7. Receives "Force multiplier bonus" message

### Scenario 2: Overdue Delegation

**Context:** Task is overdue, needs follow-up

**Item:**
- Delegate: Sarah Johnson
- Task: "Complete documentation"
- Due: 2 days overdue (red border)

**Flow:**
1. Sees red-bordered item (urgent)
2. Recognizes overdue status
3. Taps to expand
4. Options: Send Reminder or Reschedule
5. Taps "Send Reminder" (future feature)
6. Currently shows "Coming Soon"
7. Alternative: Contacts delegate directly

### Scenario 3: Reschedule Delegation

**Context:** Need more time for task

**Item:**
- Delegate: Mike Chen
- Task: "Prepare presentation"
- Due: Today

**Flow:**
1. Realizes task needs more time
2. Taps to expand
3. Taps "Reschedule"
4. Modal opens
5. Enters "3" days
6. Confirms
7. Due date pushed to 3 days later
8. Removed from today's list

### Scenario 4: Cancel Invalid Delegation

**Context:** Task no longer needed

**Item:**
- Delegate: Lisa Wong
- Task: "Old project review"
- Due: Today

**Flow:**
1. Realizes task no longer relevant
2. Taps to expand
3. Taps "Cancel Delegation"
4. Confirmation alert
5. Confirms cancellation
6. Delegation cancelled
7. Removed from list

### Scenario 5: Level 3 Leadership Review

**Context:** High energy, reviewing team status

**Display:**
```
[🎯] Lead your team. Check these delegated items.
    Leadership is multiplying yourself through others

3 delegations due
```

**Flow:**
1. Inspired by leadership messaging
2. Reviews all delegations systematically
3. Marks 2 as complete (bonus points)
4. Reschedules 1 for next week
5. Feels accomplished as leader
6. Force multiplier bonus reinforces behavior

---

## Testing Checklist

- [ ] Component loads delegations from view
- [ ] Only fetches user's own delegations
- [ ] Only shows incomplete delegations
- [ ] Only shows items with due_date <= today
- [ ] Excludes cancelled delegations
- [ ] Level 1 shows collapsed by default
- [ ] Level 2 shows standard header
- [ ] Level 3 shows leadership header with icon
- [ ] Level 3 shows inspirational subtext
- [ ] Empty state displays when no items
- [ ] Check Status shows confirmation
- [ ] Check Status marks delegation complete
- [ ] Check Status shows bonus points message
- [ ] Send Reminder shows "Coming Soon" alert
- [ ] Reschedule opens modal
- [ ] Reschedule modal validates input
- [ ] Reschedule updates due_date
- [ ] Cancel shows confirmation
- [ ] Cancel updates status to 'cancelled'
- [ ] Overdue items have red border
- [ ] Overdue dates show in red
- [ ] Items removed from list after action
- [ ] Processing state disables actions
- [ ] Success alerts show after actions
- [ ] Haptic feedback works (non-web)
- [ ] Collapse/expand works (Level 1)
- [ ] Date formatting works correctly
- [ ] TypeScript compiles without errors
- [ ] No duplicate keys in lists

---

## Future Enhancements

### Planned Features

1. **Send Reminder Implementation:**
   - Email notifications
   - In-app notifications
   - SMS reminders (optional)
   - Custom reminder messages
   - Reminder history

2. **Force Multiplier Scoring:**
   - Points calculation system
   - Leaderboard for delegators
   - Achievement badges
   - Delegation streaks
   - Team effectiveness metrics

3. **Delegation Analytics:**
   - Completion rate by delegate
   - Average time to completion
   - Delegation frequency
   - Team capacity view
   - Bottleneck identification

4. **Delegate Profiles:**
   - View delegate details
   - See all delegations to person
   - Workload visibility
   - Communication history
   - Performance metrics

5. **Smart Suggestions:**
   - AI suggests who to delegate to
   - Optimal due dates
   - Task complexity matching
   - Workload balancing
   - Delegation recommendations

6. **Batch Operations:**
   - Check multiple items at once
   - Bulk reschedule
   - Group by delegate
   - Filter by status
   - Sort options

7. **Communication Integration:**
   - In-app chat with delegate
   - Status updates from delegate
   - Progress reporting
   - Context sharing
   - Attachment support

8. **Delegation Templates:**
   - Pre-filled delegation forms
   - Standard instructions
   - Common tasks
   - Role-based templates
   - Quick delegation flow

---

## Notes for Developers

### Adding Force Multiplier Points

Implementation guide:

```typescript
// 1. Create points tracking table
CREATE TABLE delegation_points (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  delegation_id UUID NOT NULL,
  points_awarded INTEGER NOT NULL,
  awarded_at TIMESTAMPTZ DEFAULT NOW()
);

// 2. Award points on completion
async function awardForceMultiplierPoints(
  userId: string,
  delegationId: string
): Promise<number> {
  // Calculate points based on factors
  const basePoints = 10;
  const completionTimeBonus = calculateTimeliness(delegation);
  const complexityBonus = calculateComplexity(task);

  const totalPoints = basePoints + completionTimeBonus + complexityBonus;

  // Store in database
  await supabase.from('delegation_points').insert({
    user_id: userId,
    delegation_id: delegationId,
    points_awarded: totalPoints,
  });

  return totalPoints;
}

// 3. Update UI to show points
Alert.alert(
  'Success',
  `Delegation marked complete! +${points} force multiplier points earned.`
);
```

### Implementing Send Reminder

```typescript
async function sendDelegationReminder(
  delegation: DelegationItemData
): Promise<void> {
  // 1. Send email if email exists
  if (delegation.delegate_email) {
    await sendEmail({
      to: delegation.delegate_email,
      subject: `Reminder: ${delegation.task_title}`,
      template: 'delegation_reminder',
      data: {
        delegateName: delegation.delegate_name,
        taskTitle: delegation.task_title,
        dueDate: delegation.due_date,
        notes: delegation.notes,
        delegatorName: currentUser.name,
      },
    });
  }

  // 2. Log reminder sent
  await supabase.from('delegation_reminders').insert({
    delegation_id: delegation.delegation_id,
    sent_at: new Date().toISOString(),
    method: 'email',
  });

  // 3. Show success
  Alert.alert('Success', 'Reminder sent!');
}
```

### Analytics Tracking

```typescript
// Track delegation completion
trackEvent('delegation_completed', {
  delegate_name: item.delegate_name,
  task_title: item.task_title,
  days_to_complete: calculateDays(item.created_at, now),
  was_overdue: isOverdue(item.due_date),
  fuel_level: fuelLevel,
});

// Track reschedules
trackEvent('delegation_rescheduled', {
  original_due_date: item.due_date,
  days_delayed: rescheduleDays,
  times_rescheduled: getrescheduleCount(item.delegation_id),
});

// Track cancellations
trackEvent('delegation_cancelled', {
  days_since_created: calculateAge(item.created_at),
  reason: 'user_initiated',
});
```

### Database Maintenance

```sql
-- Find overdue delegations
SELECT
  delegate_name,
  task_title,
  due_date,
  CURRENT_DATE - due_date AS days_overdue
FROM v_morning_spark_delegations
WHERE due_date < CURRENT_DATE
ORDER BY days_overdue DESC;

-- Delegation completion rate by user
SELECT
  user_id,
  COUNT(*) FILTER (WHERE completed = true) AS completed,
  COUNT(*) FILTER (WHERE completed = false) AS pending,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE completed = true) / COUNT(*),
    1
  ) AS completion_rate
FROM "0008-ap-delegates"
WHERE task_id IS NOT NULL
GROUP BY user_id;

-- Clean up old completed delegations
DELETE FROM "0008-ap-delegates"
WHERE completed = true
  AND created_at < CURRENT_DATE - INTERVAL '90 days';
```

---

*Component created: January 2026*
