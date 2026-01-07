# MindsetCapture Component Documentation

## Overview
A fuel-adaptive component for capturing thoughts, permissions, and creative sparks during the Morning Spark ritual. The component adjusts its prompt, placeholder, and behavior based on the user's selected fuel level.

---

## Component Location
`components/morning-spark/MindsetCapture.tsx`

---

## Features

### 1. **Fuel-Adaptive Prompts**
The component shows different prompts based on fuel level:

**Level 1 (Low Energy):**
- Prompt: "What is one thing you give yourself permission NOT to do today?"
- Placeholder: "I give myself permission to..."
- Focus: Rest and boundaries

**Level 2 (Balanced Energy):**
- Prompt: "Where is your head at right now? Log a quick thought to clear your cache."
- Placeholder: "Right now I'm thinking..."
- Focus: Mental clarity

**Level 3 (High Energy):**
- Prompt: "Capture the Spark. Don't lose these creative ideas—bank them now."
- Placeholder: "This idea could..."
- Focus: Creative capture

### 2. **Character Counter**
- Shows: "X/500"
- Turns red when limit exceeded
- Prevents submission when over limit

### 3. **Action Button**
**Text Changes by Fuel Level:**
- Levels 1 & 2: "Log"
- Level 3: "Create Deposit Idea"

**Button States:**
- Disabled (gray) when no text or over limit
- Colored by fuel level when ready
- Shows spinner while saving

### 4. **Success Animation**
- Green badge with checkmark
- "+1 point" text
- Appears top-right for 2 seconds
- Scale and fade animation

---

## Props Interface

```typescript
interface MindsetCaptureProps {
  fuelLevel: 1 | 2 | 3;       // User's selected fuel level
  userId: string;              // Current user's ID
  sparkId: string;             // Current daily spark ID
  onPointsAdded: (points: number) => void;  // Callback when points awarded
}
```

---

## Database Integration

### Level 1 & 2 Behavior:
Saves to `0008-ap-reflections` table:
```typescript
{
  user_id: userId,
  reflection_type: 'morning_spark',
  parent_id: sparkId,
  parent_type: 'daily_spark',
  content: userInput,
  points_awarded: 1
}
```

### Level 3 Additional Behavior:
Also creates deposit idea in `0008-ap-deposit-ideas` table:
```typescript
{
  user_id: userId,
  title: userInput,
  creation_points_awarded: true
}
```

---

## Usage Example

### Basic Integration:

```typescript
import { MindsetCapture } from '@/components/morning-spark/MindsetCapture';
import { useState } from 'react';

function MorningSparkScreen() {
  const [fuelLevel, setFuelLevel] = useState<1 | 2 | 3>(2);
  const [userId, setUserId] = useState('user-123');
  const [sparkId, setSparkId] = useState('spark-456');
  const [totalScore, setTotalScore] = useState(10);

  function handlePointsAdded(points: number) {
    setTotalScore(prev => prev + points);
  }

  return (
    <View>
      <MindsetCapture
        fuelLevel={fuelLevel}
        userId={userId}
        sparkId={sparkId}
        onPointsAdded={handlePointsAdded}
      />
    </View>
  );
}
```

### Integration with Commit Screen:

```typescript
// app/morning-spark/commit.tsx
import { MindsetCapture } from '@/components/morning-spark/MindsetCapture';

export default function CommitScreen() {
  const [extraPoints, setExtraPoints] = useState(0);

  const finalScore = calculateTargetScore() + extraPoints;

  return (
    <ScrollView>
      {/* Fuel level display */}
      {/* Scoreboard */}

      <MindsetCapture
        fuelLevel={fuelLevel}
        userId={userId}
        sparkId={sparkId}
        onPointsAdded={(points) => setExtraPoints(prev => prev + points)}
      />

      {/* Breakdown */}
      {/* Commit button */}
    </ScrollView>
  );
}
```

---

## Component Behavior Flow

### User Journey:
1. **User sees prompt** - Adapted to their fuel level
2. **User types text** - Character counter updates in real-time
3. **Button enables** - When text is valid (1-500 chars)
4. **User submits** - Button shows loading spinner
5. **Data saves** - To reflections (and deposit ideas for Level 3)
6. **Success animation** - "+1 point" badge appears
7. **Callback fires** - `onPointsAdded(1)` updates parent score
8. **Input clears** - Ready for another capture
9. **Animation fades** - After 2 seconds

---

## Key Features

### Multiple Captures Allowed
Users can capture multiple thoughts:
- Each capture awards +1 point
- Input clears after successful save
- Success animation plays each time
- Parent component tracks cumulative points

### Error Handling
- Logs errors to console
- Continues with partial success (e.g., saves reflection even if deposit idea fails)
- Always resets `saving` state
- User can retry if needed

### Visual Feedback
- **Character counter color**: Gray → Red (when over limit)
- **Button state**: Disabled (gray) → Enabled (fuel color)
- **Loading state**: Spinner replaces button text
- **Success badge**: Animated checkmark + points

---

## Styling Notes

### Colors
- Button color matches fuel level:
  - Level 1: `#ef4444` (red)
  - Level 2: `#f97316` (orange)
  - Level 3: `#10B981` (green)
- Disabled button: Uses theme's `colors.border`
- Success badge: Always green (`#10B981`)

### Layout
- Full width within parent container
- 24px bottom margin
- Relative positioning for success badge
- Text input minimum height: 120px

### Accessibility
- Multiline text input
- Touch target sizes: 44x44 minimum
- Color contrast ratios meet WCAG standards
- Clear visual feedback for all states

---

## Integration Points

### Where to Use:

1. **Commit Screen** (Primary):
   - Between breakdown and final reflection
   - Allows multiple mindset captures
   - Updates final score dynamically

2. **Brain Dump Screen** (Alternative):
   - Could replace or augment existing brain dump
   - More structured than free-form dump

3. **Throughout Morning Spark Flow** (Optional):
   - Quick capture at any step
   - Non-blocking, inline component

---

## State Management

### Local State:
- `text` - Current input value
- `saving` - Loading state during API call
- `showSuccess` - Controls success badge visibility
- `scaleAnim` - Animation value for badge scale
- `opacityAnim` - Animation value for badge opacity

### Parent State Updates:
- Calls `onPointsAdded(1)` after successful save
- Parent can aggregate multiple captures
- Enables dynamic score calculation

---

## Database Tables

### Primary Table: `0008-ap-reflections`
**Used For:** All fuel levels
**Columns:**
- `user_id` - UUID
- `reflection_type` - 'morning_spark'
- `parent_id` - Daily spark UUID
- `parent_type` - 'daily_spark'
- `content` - User's text
- `points_awarded` - 1
- `created_at` - Auto-generated

### Secondary Table: `0008-ap-deposit-ideas` (Level 3 only)
**Used For:** High energy creative captures
**Columns:**
- `user_id` - UUID
- `title` - User's text
- `creation_points_awarded` - true
- `created_at` - Auto-generated
- `status` - Default 'unscheduled'

---

## Example Use Cases

### Use Case 1: Permission Setting (Level 1)
**User Input:** "I give myself permission to skip the gym today and rest instead."
**Result:**
- Saves as reflection
- Awards +1 point
- Honors low energy state

### Use Case 2: Mental Cache Clear (Level 2)
**User Input:** "Worried about the presentation tomorrow, but I've prepared well. Just need to trust myself."
**Result:**
- Saves as reflection
- Awards +1 point
- Clears mental clutter

### Use Case 3: Creative Spark (Level 3)
**User Input:** "What if we gamified the onboarding process with achievement badges?"
**Result:**
- Saves as reflection (+1 point)
- Creates deposit idea
- Preserves creative spark for later

---

## Testing Checklist

- [ ] Level 1 prompt displays correctly
- [ ] Level 2 prompt displays correctly
- [ ] Level 3 prompt displays correctly
- [ ] Character counter updates in real-time
- [ ] Counter turns red at 500+ chars
- [ ] Button disabled when empty
- [ ] Button disabled when over limit
- [ ] Button enabled with valid text
- [ ] Button shows spinner while saving
- [ ] Reflection saves to database (all levels)
- [ ] Deposit idea creates (Level 3 only)
- [ ] Success badge appears and animates
- [ ] Input clears after successful save
- [ ] onPointsAdded callback fires
- [ ] Multiple captures work sequentially
- [ ] Error handling doesn't crash UI

---

## Future Enhancements

Potential improvements:
1. **Voice input** - Speak thoughts instead of typing
2. **Saved templates** - Quick-select common permissions/thoughts
3. **Historical view** - Review past captures by date
4. **Tagging system** - Categorize different types of captures
5. **AI suggestions** - Prompt-based suggestions based on patterns
6. **Export capability** - Download captures as journal entries

---

## Notes for Developers

### Animation System:
Uses React Native's Animated API:
- `scaleAnim` - Controls badge size (0 to 1)
- `opacityAnim` - Controls badge visibility (0 to 1)
- Parallel animations for smooth appearance
- Sequential animations for smooth disappearance

### Character Limit:
- Soft limit: 500 characters
- Hard limit: 520 characters (allows typing but prevents submit)
- Shows visual feedback at soft limit

### Fuel Level Colors:
Uses `getFuelColor()` from `lib/sparkUtils.ts`:
```typescript
getFuelColor(1) // '#ef4444' - Red
getFuelColor(2) // '#f97316' - Orange
getFuelColor(3) // '#10B981' - Green
```

---

*Component created: January 2026*
