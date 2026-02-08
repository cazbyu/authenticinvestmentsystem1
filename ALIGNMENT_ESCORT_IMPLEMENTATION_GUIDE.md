# Alignment Escort Implementation Guide

## What's Been Built (Foundation Complete ✅)

### 1. Database Schema
**File**: Latest migration added to Supabase

- ✅ `guided_mode_enabled` column added to `0008-ap-user-ritual-settings` table
- ✅ `0008-ap-week-plan-items` table created with full RLS policies
- ✅ Stores items created during ritual with metadata (type, source, context, alignment)

### 2. Core Components

#### AlignmentEscortCard
**File**: `/components/weekly-alignment/AlignmentEscortCard.tsx`

Reusable coaching card component with three visual styles:
- `nudge` - Soft blue, for gentle suggestions
- `prompt` - Red accent, for action-oriented prompts with buttons
- `celebrate` - Green, for positive reinforcement

Features:
- Smooth slide-in animation
- Dismissable with X button
- Up to 2 action buttons per card
- Icon support (compass, lightbulb, star, sparkles)
- Brand color theming

#### WeekPlanReview
**File**: `/components/weekly-alignment/WeekPlanReview.tsx`

Full-featured review component for Step 5:
- Groups items by source (Roles, Wellness, Goals, Ideas)
- Expandable sections with committed count badges
- Individual item commitment toggle (checkbox)
- Edit and remove actions per item
- Summary stats (total items, committed count)
- Empty state handling

### 3. State Management

#### useWeekPlan Hook
**File**: `/hooks/useWeekPlan.ts`

Provides:
- `items`: Array of all week plan items
- `addItem()`: Add new item to the plan
- `removeItem()`: Remove item by ID
- `updateItem()`: Update item properties
- `clearItems()`: Clear all items
- `getItemsByStep()`: Filter by source step (1-5)
- `getItemsByType()`: Filter by type (task/event/idea)
- `getItemsBySource()`: Filter by source context string
- `itemCount`: Total number of items
- `committedCount`: Number of committed items

### 4. Parent Integration

#### Weekly Alignment Screen
**File**: `/app/weekly-alignment.tsx`

Updated with:
- ✅ `useWeekPlan()` hook initialized
- ✅ `guidedModeEnabled` state loaded from database
- ✅ Week Plan badge in header (shows item count when guidedMode enabled)
- ✅ All props passed to every step component:
  - `guidedModeEnabled`
  - `weekPlan` (full hook object)

## What Needs to Be Done Next

### Step 1: Touch Your Star - Add Escort Prompts

**File**: `/components/weekly-alignment/TouchYourStarStep.tsx`

**Props to Add**:
```typescript
interface TouchYourStarStepProps {
  // ... existing props
  guidedModeEnabled?: boolean;
  weekPlan?: ReturnType<typeof useWeekPlan>;
}
```

**Prompts to Add**:

1. **Opening nudge** (when step loads, for ALL users):
```typescript
{guidedModeEnabled && (
  <AlignmentEscortCard
    type="nudge"
    icon="star"
    message="Before we plan your week, let's reconnect with who you are and where you're headed. Everything we build this week flows from here."
  />
)}
```

2. **Returning user check** (after they've reviewed their North Star data):
```typescript
{guidedModeEnabled && hasNorthStarData && (
  <AlignmentEscortCard
    type="nudge"
    icon="compass"
    message="Take a moment — does your mission still feel true? Has anything shifted since last week?"
  />
)}
```

**Location**: Add these cards in the main ScrollView after North Star data is displayed.

---

### Step 2: Wing Check: Roles - Add Escort Prompts

**File**: `/components/weekly-alignment/WingCheckRolesStep.tsx`

**Props to Add**: Same as Step 1

**Prompts to Add**:

1. **After roles are reviewed**:
```typescript
{guidedModeEnabled && rolesReviewed && (
  <AlignmentEscortCard
    type="prompt"
    icon="lightbulb"
    message="You've got your roles in focus. As you reflect on each one, think: what's ONE thing you could do this week to show up well in this role?"
    actionLabel="Add a Task for This Role"
    onAction={() => {
      // Open TaskEventForm with pre-filled role context
      // weekPlan.addItem({ ... })
    }}
  />
)}
```

2. **Per role card** (when reviewing a specific role):
```typescript
{guidedModeEnabled && selectedRole && (
  <AlignmentEscortCard
    type="prompt"
    icon="compass"
    message={`That's a meaningful purpose for your role as ${selectedRole.name}. Want to turn that into something concrete for this week?`}
    actionLabel="Create a Task"
    actionLabel2="Capture an Idea"
    onAction={() => {
      // Open TaskEventForm pre-filled with:
      // - role tag
      // - role purpose as description hint
      // - aligned_to: mission/vision element
    }}
    onAction2={() => {
      // Open idea capture with role context
    }}
  />
)}
```

3. **If role is flagged as "needs attention"**:
```typescript
{guidedModeEnabled && roleNeedsAttention && (
  <AlignmentEscortCard
    type="prompt"
    message={`You flagged ${roleName} as needing attention. Even a small step counts. What could you do this week?`}
    actionLabel="Add Something Small"
    onAction={() => {
      // Open TaskEventForm with role pre-filled
    }}
  />
)}
```

**Integration Notes**:
- Hook into existing modal/form for creating tasks
- Pre-fill context: `source_context: "Role: Father"`, `source_step: 2`
- When item created, call `weekPlan.addItem()`

---

### Step 3: Wing Check: Wellness - Add Escort Prompts

**File**: `/components/weekly-alignment/WingCheckWellnessStep.tsx`

**Props to Add**: Same as Step 1

**Prompts to Add**:

1. **Opening nudge** (after wellness zones are displayed):
```typescript
{guidedModeEnabled && (
  <AlignmentEscortCard
    type="nudge"
    icon="sparkles"
    message="Your roles only thrive when YOU are sustained. As you check each zone, notice where you could invest a little this week."
  />
)}
```

2. **Per wellness zone** (when reviewing a specific zone):
```typescript
{guidedModeEnabled && selectedZone && (
  <AlignmentEscortCard
    type="prompt"
    message={`What's one thing you could schedule this week to nourish your ${selectedZone.name} life?`}
    actionLabel="Add to My Week"
    onAction={() => {
      // Open TaskEventForm as event
      // Pre-fill: wellness zone tag, suggest self-care category
      // source_context: "Wellness: Physical"
      // source_step: 3
    }}
  />
)}
```

3. **If wellness zone is rated low**:
```typescript
{guidedModeEnabled && zoneLow && (
  <AlignmentEscortCard
    type="prompt"
    message={`Your ${zoneName} wellness could use some love. You don't need a big plan — even 15 minutes this week makes a difference.`}
    actionLabel="Schedule Something"
    onAction={() => {
      // Open event scheduler with zone context
    }}
  />
)}
```

---

### Step 4: Goal Campaigns - Add Escort Prompts

**File**: `/components/weekly-alignment/SixCheckStep.tsx`

**Props to Add**: Same as Step 1

**Prompts to Add**:

1. **Opening nudge** (when reviewing campaigns):
```typescript
{guidedModeEnabled && activeCampaigns.length > 0 && (
  <AlignmentEscortCard
    type="nudge"
    icon="compass"
    message="These are the mountains you're climbing. Which one gets your focus this week?"
  />
)}
```

2. **After selecting focus goal or reviewing lagging campaign**:
```typescript
{guidedModeEnabled && (focusGoal || laggingGoal) && (
  <AlignmentEscortCard
    type="prompt"
    message={`What's the next concrete step for '${goalName}'? Break it down into something you can do this week.`}
    actionLabel="Add a Task"
    actionLabel2="Capture an Idea"
    onAction={() => {
      // Open TaskEventForm
      // Pre-fill: goal campaign link, suggest next milestone as title hint
      // source_context: "Goal: Launch business"
      // source_step: 4
    }}
    onAction2={() => {
      // Open idea capture with goal context
    }}
  />
)}
```

3. **If no items created yet by Step 4**:
```typescript
{guidedModeEnabled && weekPlan.itemCount === 0 && (
  <AlignmentEscortCard
    type="nudge"
    message="You've done great reflection work so far. Before we move to your commitment, let's turn some of that thinking into action items for this week."
    actionLabel={weekPlan.itemCount > 0 ? "Review What I've Captured" : "Start Adding Actions"}
    onAction={() => {
      // Either show mini Week Plan preview or prompt to add first item
    }}
  />
)}
```

---

### Step 5: Tactical Deployment - Add Week Plan Review

**File**: `/components/weekly-alignment/TacticalDeploymentStep.tsx`

**Props to Add**: Same as Step 1

**Major Update Required**:

1. **Import WeekPlanReview**:
```typescript
import { WeekPlanReview } from './WeekPlanReview';
```

2. **Add Week Plan section at TOP of ScrollView** (before existing Tasks/Events/Delegates sections):

```typescript
{/* Week Plan Review - Alignment Escort */}
{guidedModeEnabled && weekPlan && weekPlan.itemCount > 0 && (
  <View style={styles.weekPlanSection}>
    <AlignmentEscortCard
      type="celebrate"
      icon="sparkles"
      message={`You've captured ${weekPlan.itemCount} aligned actions across your roles, wellness, and goals. Let's review your week and lock it in.`}
    />

    <WeekPlanReview
      items={weekPlan.items}
      colors={colors}
      onToggleCommit={(itemId) => {
        weekPlan.updateItem(itemId, {
          is_committed: !weekPlan.items.find(i => i.id === itemId)?.is_committed
        });
      }}
      onEditItem={(item) => {
        // Open edit modal for the item
      }}
      onRemoveItem={(itemId) => {
        weekPlan.removeItem(itemId);
      }}
    />
  </View>
)}

{guidedModeEnabled && weekPlan && weekPlan.itemCount === 0 && (
  <AlignmentEscortCard
    type="nudge"
    message="Before you sign off on your week, take a moment to add at least a few tasks or events that connect to what you've reflected on."
    actionLabel="Add Actions Now"
    onAction={() => {
      // Navigate back to previous steps or open quick-add modal
    }}
  />
)}
```

3. **Update handleSignContract to save Week Plan items**:

```typescript
async function handleSignContract() {
  // ... existing code ...

  // Save week plan items to database
  if (guidedModeEnabled && weekPlan && weekPlan.itemCount > 0) {
    const supabase = getSupabaseClient();

    const weekPlanRecords = weekPlan.items.map(item => ({
      user_id: userId,
      alignment_id: alignmentId, // From the created/updated alignment record
      item_type: item.type,
      item_id: item.item_id,
      title: item.title,
      source_step: item.source_step,
      source_context: item.source_context,
      aligned_to: item.aligned_to,
      is_committed: item.is_committed,
    }));

    await supabase
      .from('0008-ap-week-plan-items')
      .insert(weekPlanRecords);
  }

  // ... existing completion code ...
}
```

---

## Settings Toggle Implementation

**File**: `/app/settings.tsx` (or wherever settings UI is)

Add toggle to enable/disable Alignment Escort:

```typescript
{/* Alignment Guide Toggle */}
<View style={styles.settingRow}>
  <View style={styles.settingInfo}>
    <Text style={styles.settingLabel}>Alignment Guide</Text>
    <Text style={styles.settingDescription}>
      Get coaching prompts during Weekly Alignment to help you create aligned actions
    </Text>
  </View>
  <Switch
    value={guidedModeEnabled}
    onValueChange={async (value) => {
      setGuidedModeEnabled(value);

      const supabase = getSupabaseClient();
      await supabase
        .from('0008-ap-user-ritual-settings')
        .update({ guided_mode_enabled: value })
        .eq('user_id', userId)
        .eq('ritual_type', 'weekly_alignment');
    }}
  />
</View>
```

---

## Smart Form Pre-filling

When opening `TaskEventForm` or idea capture from escort prompts, pre-fill:

### From Step 2 (Roles):
```typescript
{
  // Pre-fill role tag
  role_id: selectedRole.id,
  // Add role purpose as description hint
  description: `Purpose: ${selectedRole.purpose}`,
  // Link to North Star
  aligned_to: userNorthStar.mission,
  // Track source
  source_step: 2,
  source_context: `Role: ${selectedRole.name}`,
}
```

### From Step 3 (Wellness):
```typescript
{
  // Pre-fill wellness zone tag
  wellness_zone_id: selectedZone.id,
  // Suggest self-care category
  category: 'wellbeing',
  // Set as event (scheduled time)
  item_type: 'event',
  // Track source
  source_step: 3,
  source_context: `Wellness: ${selectedZone.name}`,
}
```

### From Step 4 (Goals):
```typescript
{
  // Pre-fill goal campaign link
  goal_id: selectedGoal.id,
  // Suggest next milestone as title hint
  title: `Next step for ${selectedGoal.title}`,
  // Track source
  source_step: 4,
  source_context: `Goal: ${selectedGoal.title}`,
}
```

---

## Testing Checklist

### Database
- [ ] `guided_mode_enabled` column exists in ritual settings
- [ ] `0008-ap-week-plan-items` table exists with RLS policies
- [ ] New users get `guided_mode_enabled = true` by default

### UI Components
- [ ] AlignmentEscortCard renders with all 3 types (nudge, prompt, celebrate)
- [ ] AlignmentEscortCard animations work smoothly
- [ ] WeekPlanReview shows grouped items correctly
- [ ] Week Plan badge appears in header when items > 0

### Weekly Alignment Flow
- [ ] Guided mode loads from database on ritual start
- [ ] Week Plan badge updates as items are added
- [ ] Items persist throughout the ritual (don't lose state between steps)
- [ ] Step 5 shows Week Plan review with all items
- [ ] Commitment toggles work correctly
- [ ] Contract signing saves week plan items to database

### Settings
- [ ] Toggle appears in settings
- [ ] Toggle state persists to database
- [ ] Changing toggle affects next ritual session

---

## Design Tokens (For Consistency)

```typescript
const ALIGNMENT_ESCORT_COLORS = {
  step1: '#ed1c24',  // Touch Your Star - Red
  step2: '#6b3fa0',  // Wing Check: Roles - Purple (note: updated from original #9370DB)
  step3: '#39b54a',  // Wing Check: Wellness - Green
  step4: '#2196F3',  // Goal Campaigns - Blue (note: updated from original #4169E1)
  step5: '#f5a623',  // Tactical Deployment - Gold (note: updated from original #FFD700)

  nudge: '#0ea5e9',      // Light blue
  prompt: '#ed1c24',     // Brand red
  celebrate: '#10b981',  // Green
};

const BORDER_RADIUS = {
  card: 16,
  button: 12,
  badge: 12,
};
```

---

## Next Steps Priority

1. **High Priority** - Week Plan persistence in Step 5 (without this, feature is incomplete)
2. **Medium Priority** - Add escort prompts to Steps 2-4 (core action generation)
3. **Low Priority** - Add escort prompts to Step 1 (nice-to-have context setting)
4. **Polish** - Settings toggle and fine-tuning

---

## Files Modified/Created Summary

### Created:
- `/components/weekly-alignment/AlignmentEscortCard.tsx`
- `/components/weekly-alignment/WeekPlanReview.tsx`
- `/hooks/useWeekPlan.ts`
- Database migration (added to Supabase)

### Modified:
- `/app/weekly-alignment.tsx` (added weekPlan hook, guided mode, badge, props passing)

### Need Modification:
- `/components/weekly-alignment/TouchYourStarStep.tsx`
- `/components/weekly-alignment/WingCheckRolesStep.tsx`
- `/components/weekly-alignment/WingCheckWellnessStep.tsx`
- `/components/weekly-alignment/SixCheckStep.tsx`
- `/components/weekly-alignment/TacticalDeploymentStep.tsx` (most critical)
- `/app/settings.tsx` (for toggle)

---

## Philosophy Reminder

The Alignment Escort teaches a way of thinking: **connecting daily actions to deeper purpose**. Once this becomes second nature, users turn it off. The goal is to make them better at alignment, not dependent on prompts.

Message tone should be:
- Warm and encouraging (not clinical)
- Empowering (not prescriptive)
- Practical (not preachy)
- Respectful of African context and diverse backgrounds

Use compass metaphor language: "calibrate," "align," "navigate," "heading," "course."
