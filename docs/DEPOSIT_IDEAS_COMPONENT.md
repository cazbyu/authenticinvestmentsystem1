# Deposit Ideas Component Documentation

## Overview
A fuel-adaptive component for activating deposit ideas during the Morning Spark ritual. Features intelligent visibility controls, role/zone sorting, and one-tap activation that converts ideas into tasks for today's contract.

---

## Component Locations
- `components/morning-spark/DepositIdeas.tsx` - Main container component
- `components/morning-spark/DepositIdeaCard.tsx` - Individual idea card

---

## Fuel-Adaptive Behavior

### Level 1 (Low Energy) - Hidden/Optional

**Philosophy:** Protect from overwhelm, make this entirely optional

**Initial Display:**
```
┌────────────────────────────────────┐
│ Deposit Ideas Available        ▼  │
│ 3 ideas ready to activate         │
└────────────────────────────────────┘
```

**Behavior:**
- Collapsed by default
- Small, unobtrusive footer section
- Shows count only
- Tap to expand (optional)

**Header Text (if expanded):**
> "Only add what feels energizing, not draining."

**Rationale:**
- Level 1 users should focus on essentials
- Adding extra tasks may drain energy
- Makes section completely optional
- Easy to ignore and skip

### Level 2 (Balanced Energy) - Shown After Goals

**Philosophy:** Present opportunities for balanced growth

**Position:** After Goals Review section

**Header Text:**
> "Here are some opportunities you've created for yourself. Are there any that would best fit into today?"

**Display:**
- Fully expanded by default
- Shows toggle buttons (Role/Zone)
- Shows up to 5 ideas
- Encourages selective activation

**Rationale:**
- Level 2 users can handle additional tasks
- Focus on fit and timing
- Question format invites thoughtful selection
- Not pushy, just informational

### Level 3 (High Energy) - Shown Second

**Philosophy:** Maximize service and impact

**Position:** After Goals, before Schedule (prominent placement)

**Header Text:**
> "You have fuel to burn. Who can you serve?"

**Display:**
- Fully expanded by default
- Shows toggle buttons (Role/Zone)
- Shows up to 5 ideas
- Filters for challenging/impactful ideas

**Special Filtering:**
- Prioritizes newer ideas
- Emphasizes ideas with multiple role tags
- Shows ideas that serve others
- Highlights high-impact opportunities

**Rationale:**
- Level 3 users have energy to spare
- Focus on service and impact
- Push toward ambitious goals
- Leverage high energy state

---

## View Toggle System

### Two View Modes

**1. View by Role (Default)**

**Icon:** 👤 User icon

**Sort Logic:**
```typescript
1. Count role matches with user's top 3 roles
2. Sort by match count (descending)
3. Secondary sort by created_at (newest first)
```

**Example:**
```
User's Top 3 Roles:
- Entrepreneur
- Father
- Coach

Deposit Ideas:
1. "Launch new course" (Entrepreneur, Coach) → 2 matches
2. "Plan family trip" (Father) → 1 match
3. "Write blog post" (Entrepreneur) → 1 match
4. "Learn Spanish" (no matches) → 0 matches

Sorted Result:
1. Launch new course (2 matches)
2. Plan family trip (1 match, older)
3. Write blog post (1 match, newer)
4. Learn Spanish (0 matches)
```

**Why Role View First?**
- Aligns with user's primary identities
- Shows ideas most relevant to current focus
- Honors user's role priorities
- More actionable suggestions

**2. View by Zone (Wellness)**

**Icon:** ❤️ Heart icon

**Sort Logic:**
```typescript
1. Count domain (wellness zone) tags
2. Sort by domain count (descending)
3. Secondary sort by created_at (newest first)
```

**Example:**
```
Wellness Zones:
- Physical Health
- Mental Health
- Relationships
- Career Growth

Deposit Ideas:
1. "Morning yoga routine" (Physical, Mental) → 2 zones
2. "Date night ideas" (Relationships) → 1 zone
3. "Career pivot research" (Career Growth) → 1 zone
4. "Buy groceries" (no zones) → 0 zones

Sorted Result:
1. Morning yoga routine (2 zones)
2. Date night ideas (1 zone, older)
3. Career pivot research (1 zone, newer)
4. Buy groceries (0 zones)
```

**Why Zone View?**
- Promotes life balance
- Highlights wellness alignment
- Shows cross-domain impact
- Encourages holistic growth

---

## Data Fetching

### Query Logic

```sql
-- Base query
SELECT *
FROM "0008-ap-deposit-ideas"
WHERE
  user_id = $1
  AND activated_at IS NULL
  AND archived = false
ORDER BY created_at DESC
LIMIT 20;  -- Fetch more, then filter/sort

-- Get role joins
SELECT parent_id, role:0008-ap-roles(id, label)
FROM "0008-ap-universal-roles-join"
WHERE
  parent_id IN (idea_ids)
  AND parent_type = 'depositIdea';

-- Get domain joins
SELECT parent_id, domain:0008-ap-domains(id, name)
FROM "0008-ap-universal-domains-join"
WHERE
  parent_id IN (idea_ids)
  AND parent_type = 'depositIdea';
```

### Top Roles Lookup

```sql
SELECT top_three_roles
FROM "0008-ap-user-preferences"
WHERE user_id = $1;

-- Returns: ["role-uuid-1", "role-uuid-2", "role-uuid-3"]
```

### Metadata Assembly

```typescript
interface DepositIdeaWithMetadata extends DepositIdea {
  roleNames: string[];        // ["Entrepreneur", "Coach"]
  domainNames: string[];      // ["Physical Health", "Mental Health"]
  roleScore: number;          // Count of top role matches
}
```

### Sort Implementation

**By Role:**
```typescript
ideasWithMetadata.sort((a, b) => {
  const scoreA = a.roleScore || 0;
  const scoreB = b.roleScore || 0;

  if (scoreB !== scoreA) return scoreB - scoreA;

  // Tie-breaker: newer first
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
});
```

**By Zone:**
```typescript
ideasWithMetadata.sort((a, b) => {
  const domainsA = a.domainNames?.length || 0;
  const domainsB = b.domainNames?.length || 0;

  if (domainsB !== domainsA) return domainsB - domainsA;

  // Tie-breaker: newer first
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
});
```

---

## Activation Flow

### One-Tap Activation

**User Action:**
- Taps deposit idea card
- Haptic feedback (medium impact)

**System Action:**

1. **Create Task Record**
```sql
INSERT INTO "0008-ap-tasks" (
  user_id,
  type,
  title,
  due_date,
  status,
  is_important,
  is_urgent
) VALUES (
  $1,
  'task',
  $2,  -- idea.title
  CURRENT_DATE,
  'pending',
  true,   -- All activated ideas are important
  false   -- Not urgent (floating task)
);
```

2. **Update Deposit Idea**
```sql
UPDATE "0008-ap-deposit-ideas"
SET
  activated_at = NOW(),
  activated_task_id = $1  -- new task id
WHERE id = $2;
```

3. **Update UI State**
```typescript
// Remove from list
setDepositIdeas(prev => prev.filter(di => di.id !== idea.id));

// Notify parent
if (onDepositIdeaActivated) {
  onDepositIdeaActivated(taskData);
}
```

4. **User Feedback**
```typescript
// Haptic success feedback
Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

// Alert confirmation
Alert.alert('Success', `"${idea.title}" activated for today!`);
```

### Task Properties

**Created Task Attributes:**
- **type:** `'task'` (not event, not ritual)
- **due_date:** Today's date
- **is_important:** `true` (Eisenhower: Important/Not Urgent quadrant)
- **is_urgent:** `false` (Not time-sensitive)
- **status:** `'pending'`
- **start_time:** `null` (floating task, no specific time)
- **end_time:** `null`

**Why Important + Not Urgent?**
- Deposit ideas are proactive investments
- Important for long-term goals
- Not tied to specific deadlines
- Should be done when energy is available
- Classic "Quadrant 2" activities

### Point Contribution

**Base Value:** +5 points

**Calculation:**
- Activated deposit idea = +5 base
- Additional points from role/domain/goal joins
- Calculated by `calculateTaskPoints()` function

**Example:**
```
Deposit Idea: "Launch new course"
Base: +5
Role tags (2): +2
Domain tags (1): +1
Goal link (1): +2
Total: +10 points
```

**Added to Target Score:**
```typescript
const newTask = { ...taskData, points: 5 };  // Minimum 5
onDepositIdeaActivated(newTask);

// Parent component:
setTotalTargetScore(prev => prev + newTask.points);
```

---

## Display Components

### Card Layout

```
┌─────────────────────────────────────────────┐
│ [💡] Launch new course for Q2              │
│                                         +5  │
│      2 days ago • Entrepreneur, Coach      │
└─────────────────────────────────────────────┘
```

**Elements:**
1. **Icon:** Lightbulb in orange circle
2. **Title:** Deposit idea title (max 2 lines)
3. **Points Badge:** "+5" in green
4. **Metadata:** Date + Tags

### Tag Display

**Role View:**
```
👤 Entrepreneur, Coach +1
```

**Zone View:**
```
❤️ Physical Health, Mental Health
```

**Truncation:**
- Shows up to 2 tags
- If more: "Role1, Role2 +2"
- Icon indicates view mode

### Empty State

```
┌─────────────────────────────────────────────┐
│                   💡                        │
│                                             │
│   No deposit ideas yet.                     │
│   Create some in the Idea Bank.             │
└─────────────────────────────────────────────┘
```

**When Shown:**
- No unactivated deposit ideas
- User hasn't created any ideas
- All ideas already activated

---

## Props Interface

### DepositIdeas Props

```typescript
interface DepositIdeasProps {
  fuelLevel: 1 | 2 | 3;
  userId: string;
  onDepositIdeaActivated?: (task: any) => void;
}
```

### DepositIdeaCard Props

```typescript
interface DepositIdeaCardProps {
  idea: DepositIdea & {
    roleNames?: string[];
    domainNames?: string[];
  };
  viewMode: 'role' | 'zone';
  onActivate: (idea: DepositIdea) => void;
  disabled?: boolean;
}
```

---

## Usage Examples

### Basic Integration

```typescript
import { DepositIdeas } from '@/components/morning-spark/DepositIdeas';

function MorningSparkScreen() {
  const [fuelLevel, setFuelLevel] = useState<1 | 2 | 3>(2);
  const [userId, setUserId] = useState('user-123');
  const [totalTargetScore, setTotalTargetScore] = useState(35);

  function handleDepositIdeaActivated(task: any) {
    // Add task to accepted tasks
    setAcceptedTasks(prev => [...prev, task]);

    // Update target score
    const points = calculateTaskPoints(task);
    setTotalTargetScore(prev => prev + points);

    console.log('Deposit idea activated:', task.title);
  }

  return (
    <ScrollView>
      {/* Other sections... */}

      <DepositIdeas
        fuelLevel={fuelLevel}
        userId={userId}
        onDepositIdeaActivated={handleDepositIdeaActivated}
      />

      {/* More sections... */}
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

      {/* Level 2 & 3: Show after goals */}
      {fuelLevel && fuelLevel >= 2 && (
        <DepositIdeas
          fuelLevel={fuelLevel}
          userId={userId}
          onDepositIdeaActivated={handleActivation}
        />
      )}

      <ScheduledActions />

      {/* Level 1: Show at bottom (collapsed) */}
      {fuelLevel === 1 && (
        <DepositIdeas
          fuelLevel={fuelLevel}
          userId={userId}
          onDepositIdeaActivated={handleActivation}
        />
      )}
    </ScrollView>
  );
}
```

### With Morning Spark Context

```typescript
import { DepositIdeas } from '@/components/morning-spark/DepositIdeas';
import { useMorningSpark } from '@/contexts/MorningSparkContext';

export default function DepositIdeasStep() {
  const {
    fuelLevel,
    userId,
    addActivatedDepositIdea,
    updateTargetScore,
  } = useMorningSpark();

  function handleActivation(task: any) {
    addActivatedDepositIdea(task);
    const points = task.points || 5;
    updateTargetScore(points);
  }

  return (
    <SafeAreaView>
      <Header title="Deposit Ideas" />

      <DepositIdeas
        fuelLevel={fuelLevel || 2}
        userId={userId}
        onDepositIdeaActivated={handleActivation}
      />

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
const [activating, setActivating] = useState<string | null>(null);
const [depositIdeas, setDepositIdeas] = useState<DepositIdeaWithMetadata[]>([]);
const [viewMode, setViewMode] = useState<ViewMode>('role');
const [topRoleIds, setTopRoleIds] = useState<string[]>([]);
const [collapsed, setCollapsed] = useState(fuelLevel === 1);
```

### State Transitions

**Initial Load:**
```
loading = true
↓
Fetch user preferences (top roles)
Fetch deposit ideas
Fetch role/domain joins
↓
loading = false
depositIdeas = [...ideas with metadata]
```

**View Mode Toggle:**
```
User clicks "View by Zone"
↓
viewMode = 'zone'
↓
Re-sort ideas by domain count
↓
Re-render cards with domain tags
```

**Activation Flow:**
```
User taps idea card
↓
activating = idea.id
↓
Create task in database
Update deposit idea
↓
Remove from list: depositIdeas.filter(di => di.id !== idea.id)
Call parent callback
↓
activating = null
Show success feedback
```

**Collapse/Expand (Level 1):**
```
Initial: collapsed = true
↓
User taps collapsed header
↓
collapsed = false
Show full section with all ideas
↓
User taps collapse button
↓
collapsed = true
Show minimal footer
```

---

## Database Schema Requirements

### Required Tables

**0008-ap-deposit-ideas:**
```sql
CREATE TABLE "0008-ap-deposit-ideas" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  title TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  activated_at TIMESTAMPTZ,
  activated_task_id UUID REFERENCES "0008-ap-tasks"(id),
  archived BOOLEAN DEFAULT false,
  follow_up BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_deposit_ideas_user_activated
ON "0008-ap-deposit-ideas"(user_id, activated_at)
WHERE archived = false;
```

**0008-ap-universal-roles-join:**
```sql
CREATE TABLE "0008-ap-universal-roles-join" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID NOT NULL,
  parent_type TEXT NOT NULL CHECK (parent_type IN ('task', 'depositIdea', ...)),
  role_id UUID NOT NULL REFERENCES "0008-ap-roles"(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(parent_id, parent_type, role_id)
);

CREATE INDEX idx_roles_join_parent
ON "0008-ap-universal-roles-join"(parent_id, parent_type);
```

**0008-ap-universal-domains-join:**
```sql
CREATE TABLE "0008-ap-universal-domains-join" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID NOT NULL,
  parent_type TEXT NOT NULL CHECK (parent_type IN ('task', 'depositIdea', ...)),
  domain_id UUID NOT NULL REFERENCES "0008-ap-domains"(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(parent_id, parent_type, domain_id)
);

CREATE INDEX idx_domains_join_parent
ON "0008-ap-universal-domains-join"(parent_id, parent_type);
```

**0008-ap-user-preferences:**
```sql
CREATE TABLE "0008-ap-user-preferences" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id),
  top_three_roles UUID[] DEFAULT '{}',
  -- other preferences...
);
```

---

## Performance Considerations

### Optimizations

1. **Limited Fetch:** Max 20 ideas, then filter/sort client-side
2. **Indexed Queries:** Uses indexes on user_id, activated_at
3. **Batch Joins:** Fetches all role/domain joins in 2 queries
4. **Client-Side Sort:** No database joins for sorting
5. **Eager Loading:** Loads all metadata upfront

### Typical Load Times

- **Fetch ideas:** 50-150ms
- **Fetch joins:** 100-200ms
- **Client sort:** < 10ms
- **Activation:** 150-250ms

### Scaling Considerations

**With 100 deposit ideas:**
- Still fetches only 20 most recent
- Join queries use `IN` with max 20 IDs
- Sorts 20 items client-side (fast)

**With 1000 deposit ideas:**
- Same performance (limit 20)
- Consider pagination if showing more
- Consider server-side sorting for large sets

---

## Error Handling

### Loading Errors

```typescript
try {
  await loadIdeas();
} catch (error) {
  console.error('Error loading deposit ideas:', error);
  Alert.alert('Error', 'Failed to load deposit ideas. Please try again.');
}
```

### Activation Errors

```typescript
try {
  await handleActivate(idea);
} catch (error) {
  console.error('Error activating deposit idea:', error);
  Alert.alert('Error', 'Failed to activate deposit idea. Please try again.');
} finally {
  setActivating(null);  // Re-enable activation
}
```

**Error Recovery:**
- Activation state resets (can retry)
- Idea remains in list
- User sees error message
- Can attempt activation again

### Transaction Safety

**Current Implementation (Not Atomic):**
```typescript
1. Create task
2. Update deposit idea
```

**Risk:** If update fails, task exists but idea not marked activated

**Mitigation:**
- Low risk (user can manually archive idea later)
- Task has title from idea (traceable)
- Weekly cleanup can handle orphaned activations

**Future Enhancement:**
```typescript
// Use Supabase transaction
const { data, error } = await supabase.rpc('activate_deposit_idea', {
  p_idea_id: idea.id,
  p_user_id: userId,
  p_due_date: today
});
```

---

## Integration Points

### Morning Spark Flow

**Step Sequence (Level 2):**
1. Select fuel level
2. Review goals
3. **Review deposit ideas** ← This component
4. Review scheduled actions
5. Review tasks
6. Brain dump
7. Commit

**Step Sequence (Level 3):**
1. Select fuel level
2. Review goals
3. **Review deposit ideas** ← This component (prominent)
4. Review scheduled actions
5. Review tasks
6. Brain dump
7. Commit

**Step Sequence (Level 1):**
1. Select fuel level
2. Review goals
3. Review scheduled actions
4. Review tasks
5. Brain dump
6. Commit
7. **Deposit ideas (optional)** ← This component (collapsed footer)

### Callback Integration

**onDepositIdeaActivated:**
```typescript
// Parent component
function handleDepositIdeaActivated(task: any) {
  // Add to accepted tasks array
  setAcceptedTasks(prev => [...prev, task]);

  // Calculate points
  const points = calculateTaskPoints(task, roles, domains, goals);

  // Update target score
  setTotalTargetScore(prev => prev + points);

  // Track for analytics
  trackEvent('deposit_idea_activated', {
    idea_id: task.activated_deposit_idea_id,
    points: points,
    fuel_level: fuelLevel,
  });
}
```

---

## Design Philosophy

### Activation Pattern

**Why One-Tap Activation?**
- Faster than drag-and-drop
- Works better on mobile
- Clear, immediate action
- Reduces friction
- Haptic feedback confirms action

**Why Not Bulk Activation?**
- Encourages thoughtful selection
- One-at-a-time is more intentional
- Prevents overwhelming the day
- Better for fuel level consideration

### Point System

**Why +5 Base Points?**
- Meaningful contribution to target
- Not too high (encourages selectivity)
- Not too low (worth activating)
- Can earn more with joins
- Aligns with task point system

**Point Calculation Example:**
```
Base: +5 (activated deposit idea)
Roles: +1 per role tag
Domains: +1 per domain tag
Goals: +2 per goal link

Typical range: 5-12 points
High-impact idea: 15+ points
```

### View Mode Design

**Why Default to Role?**
- Roles are more actionable
- Aligns with identity
- More personal
- Better filtering (top 3 roles)
- Prioritizes what matters most

**Why Offer Zone View?**
- Balance check
- Wellness alignment
- Cross-domain thinking
- Holistic perspective
- Prevents role tunnel vision

---

## User Experience Flow

### Level 1 Journey (Low Energy)

```
1. User completes essential sections
2. Sees collapsed "Deposit Ideas Available" footer
3. User thinks: "Maybe later, I'm tired"
4. Skips to commit
5. Result: Protected from overcommitment
```

**Alternative:**
```
1. User sees collapsed footer
2. Feels curious: "What ideas do I have?"
3. Taps to expand
4. Sees 1 energizing idea
5. Activates just that one
6. Feels good about small win
```

### Level 2 Journey (Balanced Energy)

```
1. Reviews goals (momentum check)
2. Sees deposit ideas section
3. Reads: "Any that would fit into today?"
4. Toggles to Role view
5. Sees top-matched idea: "Launch new course"
6. Thinks: "Yes, I have time for this"
7. Taps to activate
8. Gets +10 points added to target
9. Sees success confirmation
10. Continues to schedule
```

### Level 3 Journey (High Energy)

```
1. Full of energy
2. Reviews goals (crushing it)
3. Sees deposit ideas second (prominent)
4. Reads: "Who can you serve?"
5. Service mindset activated
6. Sees challenging idea: "Pro bono consulting"
7. Thinks: "Yes! I can help someone today"
8. Activates 2-3 high-impact ideas
9. Gains +25 points to target
10. Feels ready to conquer the day
```

---

## Testing Checklist

- [ ] Component loads ideas from database
- [ ] Only fetches unactivated ideas
- [ ] Only fetches non-archived ideas
- [ ] Respects user_id filter
- [ ] Level 1 shows collapsed by default
- [ ] Level 2 shows expanded
- [ ] Level 3 shows expanded and prominent
- [ ] Toggle between Role and Zone view works
- [ ] Role view sorts by top 3 role matches
- [ ] Zone view sorts by domain count
- [ ] Role tags display correctly
- [ ] Domain tags display correctly
- [ ] Tag truncation works (max 2 shown)
- [ ] "+X more" indicator shows correctly
- [ ] Empty state displays when no ideas
- [ ] Activation creates task record
- [ ] Task has correct properties (important, not urgent)
- [ ] Task has due_date = today
- [ ] Deposit idea updated with activated_at
- [ ] Deposit idea updated with activated_task_id
- [ ] Activated idea removed from list
- [ ] Callback fires with task data
- [ ] Points badge shows "+5"
- [ ] Success alert shows after activation
- [ ] Haptic feedback works (non-web)
- [ ] Activating state disables other cards
- [ ] Error handling works correctly
- [ ] Loading state displays correctly
- [ ] Collapse/expand works (Level 1)
- [ ] Date formatting works ("2 days ago")
- [ ] TypeScript compiles without errors
- [ ] No duplicate keys in list

---

## Common User Scenarios

### Scenario 1: Morning Idea Activation

**Context:** User is energized (Level 3)

**Ideas:**
- "Start weekly newsletter"
- "Schedule coffee with mentor"
- "Research new CRM tools"

**Flow:**
1. Sees ideas right after goals
2. Header: "Who can you serve?"
3. Recognizes newsletter as service opportunity
4. Activates "Start weekly newsletter"
5. Gains +8 points (base 5 + joins)
6. Newsletter now in today's task list
7. Commits to contract with higher target

### Scenario 2: Role-Aligned Selection

**Context:** User toggles to Role view (Level 2)

**Top Roles:**
- Father
- Entrepreneur
- Coach

**Ideas:**
1. "Plan family weekend" (Father) → Match
2. "Launch new product" (Entrepreneur) → Match
3. "Random errand" (no roles) → No match

**Flow:**
1. Sees Role view sorted
2. Family weekend at top
3. Product launch second
4. Random errand at bottom
5. Activates family weekend (aligns with role)
6. Feels good about intentional choice

### Scenario 3: Low Energy Skip

**Context:** User is tired (Level 1)

**Flow:**
1. Completes essential sections
2. Scrolls to bottom
3. Sees collapsed footer
4. Thinks: "Not today"
5. Taps commit without expanding
6. No ideas activated
7. Kept contract manageable

### Scenario 4: Zone Balance Check

**Context:** User switches to Zone view

**Ideas:**
- "Morning workout routine" (Physical Health)
- "Meditation practice" (Mental Health)
- "Date night planning" (Relationships)
- "Career research" (Career Growth)

**Flow:**
1. Realizes all ideas are wellness-focused
2. Sees balanced distribution across zones
3. Chooses workout (missing physical today)
4. Maintains holistic balance
5. Feels aligned with values

---

## Future Enhancements

### Potential Features

1. **Smart Filtering:**
   - AI suggests best fit for today
   - Consider energy level
   - Account for existing commitments
   - Time-of-day recommendations

2. **Batch Activation:**
   - Select multiple (like full screen)
   - Activate all at once
   - Useful for Level 3
   - Keep one-tap for speed

3. **Quick Edit:**
   - Edit title before activation
   - Add notes/context
   - Set specific due time
   - Adjust priority

4. **Activation History:**
   - See previously activated ideas
   - Track activation patterns
   - Analyze completion rates
   - Learn what works

5. **Idea Suggestions:**
   - AI suggests new deposit ideas
   - Based on goals and roles
   - Seasonal suggestions
   - Context-aware recommendations

6. **Snooze/Defer:**
   - Not right for today
   - Remind me next week
   - Seasonal ideas
   - Context-dependent activation

7. **Impact Preview:**
   - Show estimated time required
   - Show goal impact
   - Show role alignment score
   - Show domain balance effect

8. **Drag-to-Activate:**
   - Drag idea to "Today" bin
   - Visual feedback
   - Alternative to tap
   - More engaging on tablets

---

## Notes for Developers

### Context Integration

Add to `MorningSparkContext.tsx`:

```typescript
const [activatedDepositIdeas, setActivatedDepositIdeas] = useState<any[]>([]);

function handleDepositIdeaActivated(task: any) {
  setActivatedDepositIdeas(prev => [...prev, task]);
  setAcceptedTasks(prev => [...prev, task]);

  const points = calculateTaskPoints(task);
  setTotalTargetScore(prev => prev + points);
}

// Provide in context
return {
  // ...other values
  activatedDepositIdeas,
  handleDepositIdeaActivated,
};
```

### Analytics Tracking

```typescript
// Track activation
trackEvent('deposit_idea_activated', {
  idea_id: idea.id,
  idea_title: idea.title,
  fuel_level: fuelLevel,
  view_mode: viewMode,
  role_matches: idea.roleScore,
  points_added: task.points,
});

// Track view mode toggle
trackEvent('deposit_ideas_view_toggled', {
  from_mode: oldMode,
  to_mode: newMode,
  fuel_level: fuelLevel,
});

// Track collapse/expand
trackEvent('deposit_ideas_toggled', {
  action: collapsed ? 'collapsed' : 'expanded',
  fuel_level: fuelLevel,
  idea_count: depositIdeas.length,
});
```

### Database Maintenance

```sql
-- Clean up orphaned activations (no task exists)
UPDATE "0008-ap-deposit-ideas"
SET activated_at = NULL, activated_task_id = NULL
WHERE
  activated_task_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "0008-ap-tasks"
    WHERE id = activated_task_id
  );

-- Find ideas activated but never completed
SELECT
  di.id,
  di.title,
  di.activated_at,
  t.status,
  t.completed_at
FROM "0008-ap-deposit-ideas" di
JOIN "0008-ap-tasks" t ON t.id = di.activated_task_id
WHERE
  di.activated_at IS NOT NULL
  AND t.completed_at IS NULL
  AND di.activated_at < NOW() - INTERVAL '30 days';
```

---

## Design Decisions

### Why Important But Not Urgent?

**Eisenhower Matrix:**
```
┌─────────────────┬─────────────────┐
│ Urgent +        │ Not Urgent +    │
│ Important       │ Important       │
│ (Do First)      │ (Schedule)      │  ← Deposit Ideas
├─────────────────┼─────────────────┤
│ Urgent +        │ Not Urgent +    │
│ Not Important   │ Not Important   │
│ (Delegate)      │ (Eliminate)     │
└─────────────────┴─────────────────┘
```

**Rationale:**
- Deposit ideas are proactive, not reactive
- Important for long-term growth
- Not tied to deadlines
- Best done with available energy
- Classic "Quadrant 2" work
- Prevents tyranny of urgent

### Why No Drag-and-Drop?

**Considerations:**
- Mobile first platform
- Tap is faster than drag
- Less accidental activations
- Clearer user intent
- Better accessibility
- Works better in scrollable list

**Future:** Could add as alternative on tablet/web

### Why Limit to 5 Ideas?

**Rationale:**
- Prevents decision paralysis
- Encourages selectivity
- Keeps list scannable
- Matches working memory (7±2 items)
- Forces prioritization
- Better for mobile viewing

**Alternatives:**
- Show all with "Load More"
- Pagination
- Infinite scroll

---

*Component created: January 2026*
