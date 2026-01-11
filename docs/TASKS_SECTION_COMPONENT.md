# Tasks Section Component Documentation

## Overview
A sophisticated fuel-adaptive component for reviewing, prioritizing, delegating, and managing tasks during the Morning Spark ritual. Features intelligent task recommendation, delegation workflows, and different interaction modes based on energy levels.

---

## Component Locations
- `components/morning-spark/TasksSection.tsx` - Main tasks component
- `components/morning-spark/DelegateModal.tsx` - Task delegation modal
- `lib/recommendTasks.ts` - Task recommendation utility

---

## Fuel-Adaptive Behavior

### Level 1 (Low Energy) - Focus Mode

**Philosophy:** Strip down to essentials, protect energy

**Header Text:**
> "Let's strip it down. Here are the items you listed as 'Urgent'. Shall we just focus on these today or would you like to see all your tasks?"

**Behavior:**
1. Shows only tasks marked as `is_urgent = true`
2. Two primary actions:
   - **"Let's Focus"** - Accepts urgent tasks as a block
   - **"Show All"** - Reveals full task list with bin system

**Edge Case - No Urgent Tasks:**
- **Header:** "You do not have any tasks listed as 'Urgent'. Is there 1 or 2 you'd like to complete?"
- **Three Options:**
  - **"Recommend"** - AI-powered task suggestions
  - **"Show All"** - Full task list
  - **"No, Not Today"** - Skip tasks entirely

### Level 2 & 3 (Balanced/High Energy) - Full Control

**Header Text:**
> "Here are your targeted tasks. Do the priorities look right?"

**Behavior:**
- Shows all pending tasks for today
- Full bin system: Keep/Reschedule/Cancel/Delegate
- Multi-select and batch operations
- Complete control over task management

---

## Task Fetching Logic

### Base Query
```typescript
SELECT * FROM "0008-ap-tasks"
JOIN "0008-ap-roles" ON role_id (optional)
JOIN "0008-ap-domains" ON domain_id (optional)
WHERE:
  user_id = currentUser
  type = 'task'
  status = 'pending'
  deleted_at IS NULL
  (due_date = today OR due_date < today OR due_date IS NULL)
```

### Level 1 Additional Filter
```typescript
is_urgent = true
```

### Sorting Priority
1. **Priority Level:** high → medium → low → none
2. **Due Time:** Tasks with time first, sorted chronologically
3. **Tasks without time:** Last

---

## Task Display

### Card Components

**Priority Indicator:**
- Vertical colored bar on left edge
- Red (#EF4444) - High priority
- Orange (#F59E0B) - Medium priority
- Green (#10B981) - Low priority
- Gray - No priority

**Task Content:**
- **Title:** Main task text
- **Time Badge:** Due time if set (e.g., "2:30 PM")
- **Role Tag:** Associated role label
- **Domain Tag:** Associated domain (if present)
- **Points Badge:** "+X" on right side

**Example Card:**
```
┌─────────────────────────────────────┐
│ ┃ Team Meeting Review           +5  │
│ ┃ 🕐 2:30 PM   🏷️ Work              │
│ ┃                                    │
│ ┃ [Reschedule] [Delegate] [Cancel]  │
└─────────────────────────────────────┘
```

---

## Interaction Zones (Bins)

### Keep Zone (Default)
- Green checkmark icon
- Shows count: "Keep (5)"
- All tasks start here
- Tasks here are accepted into contract

### Reschedule Zone
- Orange clock icon
- Shows count: "To Reschedule (2)"
- Opens RescheduleModal
- Moves task to future date

### Delegate Zone
- Purple users icon
- Shows count: "Delegated (1)"
- Opens DelegateModal
- Task stays on contract as force multiplier

### Cancel Zone
- Red warning triangle
- Shows "⚠️ Items here will be deleted (3)"
- Permanently cancels tasks
- Sets status = 'cancelled', deleted_at = NOW()

---

## Task Recommendation System

### When Activated
- Level 1 fuel with no urgent tasks
- User clicks "Recommend" button

### Recommendation Logic

**Step 1: Get Top Roles**
```typescript
1. Fetch user's top_roles from 0008-ap-user-preferences
2. If not set, use first 3 roles by creation date
```

**Step 2: Score Tasks**
```typescript
Base Score = 0

// Role alignment (biggest factor)
if (task.role_id in topRoles):
  score += 100 - (roleIndex * 20)
  // Top role: +100
  // Second role: +80
  // Third role: +60

// Priority level
if (priority === 'high'): score += 50
if (priority === 'medium'): score += 30
if (priority === 'low'): score += 10

// Date urgency
if (due_date < today): score += 40  // Overdue
if (due_date === today): score += 30  // Due today

// Has specific time
if (due_time): score += 20
```

**Step 3: Return Top 3**
- Sort by score descending
- Return top 3 tasks
- Display in Keep zone
- User can accept or request "Show All"

### Example Scoring

**Task A:**
- Role: Top role (+100)
- Priority: High (+50)
- Overdue (+40)
- Has time (+20)
- **Total: 210**

**Task B:**
- Role: Second role (+80)
- Priority: Medium (+30)
- Due today (+30)
- **Total: 140**

**Task C:**
- Role: Not in top 3 (0)
- Priority: High (+50)
- Due today (+30)
- **Total: 80**

**Result:** Task A, Task B, Task C selected

---

## Delegation System

### DelegateModal Features

**Contact Selection:**
- List of existing delegates from `0008-ap-delegates`
- Shows name and email
- Visual selection indicator
- "Add New Delegate" option

**Creating New Delegate:**
- Name field (required)
- Email field (optional)
- Saves to database
- Immediately available for selection

**Due Date (Optional):**
- Date picker with +/- controls
- "Set Date" placeholder when empty
- Can clear date with X button
- Defaults to tomorrow when first set

**Notes (Optional):**
- Multi-line text input
- Context or instructions
- Saved with delegation record

### Delegation Flow

**1. User selects delegate and options**
```typescript
{
  delegate_id: "uuid-123",
  due_date: "2026-01-10",
  notes: "Please review and send feedback by EOD"
}
```

**2. Update task record**
```sql
UPDATE "0008-ap-tasks"
SET
  delegated_to = delegate_id,
  delegation_due_date = due_date,
  delegation_notes = notes
WHERE id = task_id
```

**3. Create tracking record**
```sql
INSERT INTO "0008-ap-delegation-tracking"
(task_id, delegate_id, delegated_at, due_date, notes)
VALUES (...)
```

**4. Keep task on user's contract**
- Task remains visible
- Marked as delegated
- Counts as force multiplier
- User maintains accountability

### Force Multiplier Concept
- Delegated tasks stay on contract
- Contribute to points
- User follows up on completion
- Builds leadership capacity

---

## User Interactions

### Single Task Actions

**Tap Task:**
- Toggles selection (blue border)
- Enables multi-select mode

**Tap Action Buttons:**
- **Reschedule** - Opens date/time picker
- **Delegate** - Opens delegation modal
- **Cancel** - Moves to cancel zone

### Multi-Select Mode

**When Active:**
- Action bar appears at bottom
- Shows selected count
- Three batch action buttons

**Batch Actions:**
- "Reschedule" - Moves all to reschedule zone
- "Delegate" - Moves all to delegate zone
- "Cancel" - Moves all to cancel zone

**Note:** Batch reschedule/delegate moves to zone but doesn't open modal for each. User would need to handle individually.

---

## Database Operations

### Fetch Tasks
```sql
SELECT
  t.*,
  r.label as role_label,
  d.name as domain_name
FROM "0008-ap-tasks" t
LEFT JOIN "0008-ap-roles" r ON t.role_id = r.id
LEFT JOIN "0008-ap-domains" d ON t.domain_id = d.id
WHERE
  t.user_id = $1
  AND t.type = 'task'
  AND t.status = 'pending'
  AND t.deleted_at IS NULL
  AND (
    t.due_date = CURRENT_DATE
    OR t.due_date < CURRENT_DATE
    OR t.due_date IS NULL
  )
  -- Level 1 only:
  AND (t.is_urgent = true)
ORDER BY
  CASE t.priority
    WHEN 'high' THEN 0
    WHEN 'medium' THEN 1
    WHEN 'low' THEN 2
    ELSE 3
  END,
  t.due_time ASC NULLS LAST
```

### Cancel Tasks
```sql
UPDATE "0008-ap-tasks"
SET
  status = 'cancelled',
  deleted_at = NOW()
WHERE id IN (task_ids)
```

### Delegate Task
```sql
-- Update task
UPDATE "0008-ap-tasks"
SET
  delegated_to = $1,
  delegation_due_date = $2,
  delegation_notes = $3
WHERE id = $4

-- Track delegation
INSERT INTO "0008-ap-delegation-tracking"
(task_id, delegate_id, delegated_at, due_date, notes)
VALUES ($1, $2, NOW(), $3, $4)
```

---

## Props Interface

```typescript
interface TasksSectionProps {
  fuelLevel: 1 | 2 | 3;
  userId: string;
  onTasksAccepted: (tasks: Task[]) => void;
}

interface Task {
  id: string;
  title: string;
  description?: string;
  priority?: string;
  due_date?: string;
  due_time?: string;
  is_urgent?: boolean;
  role_id?: string;
  domain_id?: string;
  role_label?: string;
  domain_name?: string;
  points?: number;
}
```

---

## Usage Examples

### Basic Integration

```typescript
import { TasksSection } from '@/components/morning-spark/TasksSection';

function TasksScreen() {
  const [fuelLevel, setFuelLevel] = useState<1 | 2 | 3>(2);
  const [userId, setUserId] = useState('user-123');
  const [acceptedTasks, setAcceptedTasks] = useState<Task[]>([]);

  function handleTasksAccepted(tasks: Task[]) {
    setAcceptedTasks(tasks);
    const totalPoints = tasks.reduce((sum, t) => sum + (t.points || 0), 0);
    console.log(`${tasks.length} tasks accepted, ${totalPoints} points`);
  }

  return (
    <ScrollView>
      <TasksSection
        fuelLevel={fuelLevel}
        userId={userId}
        onTasksAccepted={handleTasksAccepted}
      />
    </ScrollView>
  );
}
```

### With Morning Spark Context

```typescript
import { TasksSection } from '@/components/morning-spark/TasksSection';
import { useMorningSpark } from '@/contexts/MorningSparkContext';

export default function TasksScreen() {
  const { fuelLevel, setAcceptedTasks } = useMorningSpark();
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
      <Header title="Today's Tasks" />
      <ScrollView>
        {userId && (
          <TasksSection
            fuelLevel={fuelLevel || 2}
            userId={userId}
            onTasksAccepted={(tasks) => setAcceptedTasks(tasks)}
          />
        )}
      </ScrollView>
      <NavigationButtons />
    </SafeAreaView>
  );
}
```

---

## State Management

### Local State

```typescript
const [loading, setLoading] = useState(true);
const [taskStates, setTaskStates] = useState<TaskState[]>([]);
const [showAllTasks, setShowAllTasks] = useState(false);
const [recommendedTasks, setRecommendedTasks] = useState<Task[]>([]);
const [rescheduleModalVisible, setRescheduleModalVisible] = useState(false);
const [delegateModalVisible, setDelegateModalVisible] = useState(false);
const [selectedTaskForAction, setSelectedTaskForAction] = useState<Task | null>(null);
const [hasChanges, setHasChanges] = useState(false);
const [saving, setSaving] = useState(false);
```

### Task State Structure

```typescript
interface TaskState {
  task: Task;
  zone: 'keep' | 'reschedule' | 'cancel' | 'delegate';
  selected: boolean;
}
```

---

## Key Functions

### `loadTasks()`
- Fetches tasks based on fuel level and filters
- Joins with roles and domains tables
- Calculates points for each task
- Sorts by priority and time
- Initializes task states in Keep zone
- Calls `onTasksAccepted` with task list

### `handleRecommend()`
- Calls `recommendTasks()` utility
- Receives top 3 scored tasks
- Displays in Keep zone
- Sets recommended state

### `moveTaskTo(zone)`
- Moves single task to specified zone
- Opens modal if zone requires it (reschedule/delegate)
- Sets `hasChanges` flag

### `handleDelegate(taskId, delegateId, dueDate, notes)`
- Updates task with delegation info
- Creates delegation tracking record
- Shows success message
- Keeps task on contract

### `handleUpdate()`
- Processes all zone changes
- Cancels tasks in cancel zone
- Keeps tasks in keep/delegate zones
- Calls `onTasksAccepted` with final list
- Resets state

---

## Button State Logic

### Level 1 Focus Mode

**"Let's Focus" Button:**
- Always enabled
- Accepts all displayed urgent tasks
- Shows success alert with count
- Proceeds to next step

**"Show All" Button:**
- Always enabled
- Switches to full task list
- Shows bin system
- Can't return to focus mode

### Full Mode

**"Keep As Is" / "Update" Button:**
- Initial: "Keep As Is" (gray, disabled)
- After changes: "Update" (primary color, enabled)
- While saving: Loading spinner
- After save: Returns to "Keep As Is"

---

## Empty States

### No Tasks for Today
```
┌─────────────────────┐
│      🔔             │
│                     │
│  No tasks for today │
└─────────────────────┘
```

### Level 1, No Urgent Tasks
```
You do not have any tasks listed as 'Urgent'.
Is there 1 or 2 you'd like to complete?

[Recommend] [Show All] [No, Not Today]
```

---

## Priority Sorting Logic

### Priority Order
1. **High** (Red) - score: 0
2. **Medium** (Orange) - score: 1
3. **Low** (Green) - score: 2
4. **None** (Gray) - score: 3

### Within Same Priority
1. Tasks with `due_time` first
2. Sorted by time (earliest first)
3. Tasks without time last

### Example Sort Result
```
1. High priority, 9:00 AM
2. High priority, 2:30 PM
3. High priority, no time
4. Medium priority, 10:00 AM
5. Medium priority, no time
6. Low priority, 3:00 PM
7. No priority, 11:00 AM
8. No priority, no time
```

---

## Database Schema Requirements

### Tables

**0008-ap-tasks:**
- `id` - UUID primary key
- `user_id` - UUID foreign key
- `type` - 'task' | 'event' | 'ritual'
- `title` - Task name
- `description` - Optional details
- `priority` - 'high' | 'medium' | 'low'
- `due_date` - Date (YYYY-MM-DD)
- `due_time` - Time (HH:MM)
- `is_urgent` - Boolean flag
- `status` - 'pending' | 'completed' | 'cancelled'
- `deleted_at` - Soft delete timestamp
- `role_id` - UUID foreign key (optional)
- `domain_id` - UUID foreign key (optional)
- `delegated_to` - UUID foreign key to delegates
- `delegation_due_date` - Date
- `delegation_notes` - Text
- `times_rescheduled` - Integer counter

**0008-ap-delegates:**
- `id` - UUID primary key
- `user_id` - UUID foreign key
- `name` - Delegate name
- `email` - Email address (optional)
- `phone` - Phone number (optional)
- `deleted_at` - Soft delete timestamp

**0008-ap-delegation-tracking:**
- `id` - UUID primary key
- `task_id` - UUID foreign key
- `delegate_id` - UUID foreign key
- `delegated_at` - Timestamp
- `completed_at` - Timestamp (nullable)
- `due_date` - Date (optional)
- `notes` - Text

**0008-ap-user-preferences:**
- `user_id` - UUID primary key
- `top_roles` - JSON array of role UUIDs
- Other preference fields...

---

## Point Calculation

Uses `calculateTaskPoints()` from `lib/taskUtils.ts`:
- Based on priority level
- Based on due date urgency
- Based on task complexity
- Based on role alignment
- Displays as "+X" badge

---

## Integration with Morning Spark Flow

### Step Sequence
1. User selects fuel level
2. Reviews scheduled events
3. **Reviews tasks** (this component)
4. Confirms daily contract
5. Sets intention

### Data Flow
```typescript
// Tasks accepted
onTasksAccepted(tasks: Task[])

// Parent updates state
setAcceptedTasks(tasks)

// Calculate total points
const taskPoints = tasks.reduce((sum, t) => sum + (t.points || 0), 0)

// Add to target score
setTargetScore(eventPoints + taskPoints + ritualPoints)

// Show in contract preview
```

---

## Error Handling

### Loading Errors
- Shows Alert with error message
- Allows retry
- Logs to console

### Delegation Errors
- Shows Alert with error message
- Modal remains open
- User can retry or cancel

### Update Errors
- Shows Alert with error message
- Maintains current state
- Re-enables update button

---

## Styling Notes

### Color Scheme
- Keep zone: Neutral with green accent
- Reschedule zone: Orange (#F59E0B)
- Delegate zone: Purple (#8B5CF6)
- Cancel zone: Red (#EF4444)
- Selected tasks: Blue border (theme primary)

### Priority Colors
- High: Red (#EF4444)
- Medium: Orange (#F59E0B)
- Low: Green (#10B981)
- None: Gray (textSecondary)

### Layout
- Full-width task cards
- 4px priority bar on left
- Flexible content area
- Fixed-width points badge
- Three action buttons below

---

## Accessibility

### Features
- Touch targets meet 44x44 minimum
- Color contrast meets WCAG AA
- Priority shown with both color AND position
- Screen reader compatible
- Clear visual feedback

---

## Testing Checklist

- [ ] Component loads tasks from database
- [ ] Level 1 shows only urgent tasks
- [ ] Level 2/3 show all tasks
- [ ] Priority sorting works correctly
- [ ] Time sorting works within priority
- [ ] Task cards display all info correctly
- [ ] Points calculated correctly
- [ ] Tapping task toggles selection
- [ ] Action buttons work (reschedule/delegate/cancel)
- [ ] Multi-select works
- [ ] Batch operations work
- [ ] "Let's Focus" works (Level 1)
- [ ] "Show All" works (Level 1)
- [ ] "Recommend" works (Level 1, no urgent)
- [ ] Recommendation scoring correct
- [ ] Top roles fetched correctly
- [ ] Reschedule modal opens
- [ ] Delegate modal opens
- [ ] Delegate creation works
- [ ] Delegation saves correctly
- [ ] Tracking record created
- [ ] Task remains on contract after delegation
- [ ] Cancel action updates database
- [ ] Update button enables after changes
- [ ] Update button shows loading
- [ ] onTasksAccepted called with correct tasks
- [ ] Empty states display correctly
- [ ] Error handling works
- [ ] TypeScript compiles without errors

---

## Future Enhancements

### Potential Features
1. **Smart scheduling** - AI suggests best times
2. **Effort estimation** - Track actual vs estimated time
3. **Task breakdown** - Split complex tasks
4. **Dependencies** - Task can't start until another completes
5. **Recurring tasks** - Daily/weekly patterns
6. **Task templates** - Quick create from templates
7. **Sub-tasks** - Checklists within tasks
8. **Time blocking** - Auto-add to calendar
9. **Delegation follow-up** - Reminders for delegated tasks
10. **Completion patterns** - Learn user's productive times

### Intelligence Improvements
1. **Better recommendations** - ML-based scoring
2. **Energy matching** - Suggest tasks matching fuel level
3. **Context awareness** - Location, time, availability
4. **Historical analysis** - Learn from past completions

---

## Performance Considerations

### Optimizations
- Loads only today's tasks (filtered at database)
- Points calculated once on load
- Task states managed locally
- Minimal re-renders
- Batch database updates

### Scalability
- Works efficiently with 50+ tasks
- Handles empty states gracefully
- No pagination needed (single day view)
- Recommendation scores 100s of tasks quickly

---

## Notes for Developers

### Database Columns Required
Ensure these columns exist:
```sql
ALTER TABLE "0008-ap-tasks"
ADD COLUMN IF NOT EXISTS is_urgent BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS delegated_to UUID REFERENCES "0008-ap-delegates"(id),
ADD COLUMN IF NOT EXISTS delegation_due_date DATE,
ADD COLUMN IF NOT EXISTS delegation_notes TEXT,
ADD COLUMN IF NOT EXISTS times_rescheduled INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS "0008-ap-delegation-tracking" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES "0008-ap-tasks"(id),
  delegate_id UUID REFERENCES "0008-ap-delegates"(id),
  delegated_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  due_date DATE,
  notes TEXT
);
```

### Context Integration
Add to `MorningSparkContext.tsx`:
```typescript
const [acceptedTasks, setAcceptedTasks] = useState<Task[]>([]);
const [delegatedTasks, setDelegatedTasks] = useState<Task[]>([]);
```

---

*Component created: January 2026*
