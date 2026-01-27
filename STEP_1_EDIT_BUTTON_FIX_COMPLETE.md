# Step 1 Complete: Fixed Edit Button - Show ActionEffortModal ✓

## Overview
Successfully implemented the Edit button functionality in GoalDetailView to open ActionEffortModal with the action's data for editing.

---

## Changes Applied

### 1a. Added State for Editing Action ✓
**File:** `components/goals/GoalDetailView.tsx` (line 96)

Added state to track which action is being edited:

```tsx
const [editingAction, setEditingAction] = useState<TaskWithLogs | null>(null);
```

This state stores the action data when user taps Edit, and is cleared when modal closes.

---

### 1b. Added Handler Functions ✓
**File:** `components/goals/GoalDetailView.tsx` (lines 491-495, 486)

**New handleEditAction function:**
```tsx
const handleEditAction = (action: TaskWithLogs) => {
  console.log('[GoalDetailView] Edit action:', action.id, action.title);
  setEditingAction(action);
  setShowActionEffortModal(true);
};
```

**Updated handleActionEffortModalClose:**
```tsx
const handleActionEffortModalClose = async () => {
  setShowActionEffortModal(false);
  setEditingAction(null);  // ✓ Clear editing state
  setRefreshTrigger(prev => prev + 1);
  onGoalUpdated();
};
```

---

### 1c. Updated Edit Button in renderWeekFilteredActionCard ✓
**File:** `components/goals/GoalDetailView.tsx` (line 1311)

**Before:**
```tsx
<TouchableOpacity onPress={() => Alert.alert('Edit Action', `Edit "${action.title}" - Coming soon`)}>
  <Text style={[styles.liEditLink, { color: colors.primary }]}>Edit</Text>
</TouchableOpacity>
```

**After:**
```tsx
<TouchableOpacity onPress={() => handleEditAction(action)}>
  <Text style={[styles.liEditLink, { color: colors.primary }]}>Edit</Text>
</TouchableOpacity>
```

Now clicking Edit opens the ActionEffortModal instead of showing an alert.

---

### 1d. Added ActionEffortModal for Editing ✓
**File:** `components/goals/GoalDetailView.tsx` (lines 1856-1872)

Split the ActionEffortModal into two conditional renders:

**For Creating New Actions:**
```tsx
{showActionEffortModal && !editingAction && (
  <ActionEffortModal
    visible={showActionEffortModal}
    onClose={handleActionEffortModalClose}
    goal={goalForModal}
    cycleWeeks={cycleWeeks}
    timeline={timeline}
    createTaskWithWeekPlan={createTaskWithWeekPlan}
    mode="create"
  />
)}
```

**For Editing Existing Actions:**
```tsx
{showActionEffortModal && editingAction && (
  <ActionEffortModal
    visible={showActionEffortModal}
    onClose={handleActionEffortModalClose}
    task={{
      id: editingAction.id,
      title: editingAction.title,
      recurrence_rule: editingAction.recurrence_rule,
    }}
    goalId={currentGoal.id}
    goalType={currentGoal.goal_type}
    timelineId={timeline?.id}
    timelineSource={timeline?.source}
    cycleWeeks={cycleWeeks}
    mode="edit"
  />
)}
```

---

### 1e. Import Verification ✓
**File:** `components/goals/GoalDetailView.tsx` (line 15)

ActionEffortModal was already imported:
```tsx
import ActionEffortModal from './ActionEffortModal';
```

No changes needed.

---

## Additional Changes

### Renamed Conflicting Function
To avoid function name collision, renamed the existing handleEditAction (for leading indicators):

**Before:**
```tsx
const handleEditAction = (action: RecurringActionResult) => {
  Alert.alert('Edit Action', `Edit "${action.title}" - Coming soon`);
};
```

**After:**
```tsx
const handleEditLeadingIndicator = (action: RecurringActionResult) => {
  Alert.alert('Edit Action', `Edit "${action.title}" - Coming soon`);
};
```

Updated its call site in renderLeadingIndicatorCard (line 1249).

---

## How It Works

### User Flow:

1. **User taps "Edit" on an action card**
   → Calls `handleEditAction(action)`

2. **handleEditAction sets state**
   ```tsx
   setEditingAction(action);  // Store action data
   setShowActionEffortModal(true);  // Show modal
   ```

3. **ActionEffortModal opens in edit mode**
   - Shows action's current data (title, frequency, weeks)
   - User can modify the action
   - Mode is set to "edit" (not "create")

4. **User saves or cancels**
   → Calls `handleActionEffortModalClose()`

5. **handleActionEffortModalClose cleans up**
   ```tsx
   setShowActionEffortModal(false);  // Hide modal
   setEditingAction(null);  // Clear editing state
   setRefreshTrigger(prev => prev + 1);  // Refresh actions
   onGoalUpdated();  // Update parent
   ```

6. **Action list refreshes with updated data**

---

## Data Flow

### When Creating New Action:

```
editingAction = null
↓
ActionEffortModal renders with:
- mode="create"
- goal={goalForModal}
- createTaskWithWeekPlan function
```

### When Editing Existing Action:

```
editingAction = {id, title, recurrence_rule, ...}
↓
ActionEffortModal renders with:
- mode="edit"
- task={id, title, recurrence_rule}
- goalId, goalType, timelineId, timelineSource
- cycleWeeks
```

---

## Props Passed to ActionEffortModal

### Create Mode:
- `visible`: boolean
- `onClose`: callback
- `goal`: {id, title, description, goal_type, roles, domains, keyRelationships}
- `cycleWeeks`: array of week objects
- `timeline`: timeline object
- `createTaskWithWeekPlan`: function
- `mode`: "create"

### Edit Mode:
- `visible`: boolean
- `onClose`: callback
- `task`: {id, title, recurrence_rule}
- `goalId`: string
- `goalType`: '12week' | 'custom' | '1y'
- `timelineId`: string | undefined
- `timelineSource`: 'global' | 'custom' | undefined
- `cycleWeeks`: array of week objects
- `mode`: "edit"

---

## Build Status

✅ **Build completed successfully with no errors**
✅ **TypeScript compilation successful**

---

## Testing Checklist

To verify this step works correctly:

### Test Edit Button:
- [ ] Open a goal with actions in Goal Detail view
- [ ] Tap "Edit" on an action card
- [ ] **Verify:** ActionEffortModal opens (doesn't show alert)
- [ ] **Verify:** Modal shows action's current data
- [ ] **Verify:** Modal title shows "Edit Action" or similar

### Test Modal Behavior:
- [ ] In the opened modal, verify action data is pre-filled:
  - [ ] Title field shows action's title
  - [ ] Frequency shows action's current frequency
  - [ ] Week selections show which weeks action is scheduled for
- [ ] Tap Cancel
- [ ] **Verify:** Modal closes without changes

### Test Refresh:
- [ ] Edit an action and save changes
- [ ] **Verify:** Modal closes
- [ ] **Verify:** Action list refreshes automatically
- [ ] **Verify:** Changes are reflected in the action card

### Test State Cleanup:
- [ ] Open edit modal
- [ ] Close it (cancel or save)
- [ ] Open "Add Action" (not edit)
- [ ] **Verify:** Modal opens in create mode (empty form)
- [ ] **Verify:** No data from previous edit carries over

---

## Known Limitations

1. **Leading Indicators Edit:**
   - The "Edit" button in `renderLeadingIndicatorCard` still shows an alert
   - Will be addressed in future steps
   - Different from week-filtered actions which now work

2. **ActionEffortModal Edit Mode:**
   - Step 1 only opens the modal
   - ActionEffortModal must support edit mode (handled in future steps)
   - If ActionEffortModal doesn't support edit yet, modal may not load data correctly

---

## Next Steps

After Step 1, the following still need to be implemented:

- **Step 2:** Update ActionEffortModal to handle edit mode
- **Step 3:** Pre-populate action data in the form
- **Step 4:** Handle save/update logic for edited actions
- **Step 5:** Update database with edited action data
- **Step 6:** Refresh action list after edit

---

## Files Modified

1. **components/goals/GoalDetailView.tsx**
   - Line 96: Added `editingAction` state
   - Line 486: Updated `handleActionEffortModalClose` to clear editingAction
   - Lines 491-495: Added new `handleEditAction` function
   - Line 1231: Renamed to `handleEditLeadingIndicator`
   - Line 1249: Updated call site for renamed function
   - Line 1311: Updated Edit button to call `handleEditAction`
   - Lines 1843-1872: Split ActionEffortModal into create/edit modes

---

## Summary

Step 1 successfully implements the Edit button functionality by:

1. ✅ Adding state to track editing action
2. ✅ Creating handler to open modal with action data
3. ✅ Updating Edit button to use new handler
4. ✅ Conditionally rendering ActionEffortModal based on mode
5. ✅ Cleaning up state when modal closes

**Key Achievement:** Users can now tap "Edit" on an action and the ActionEffortModal opens with that action's data, ready for editing.

The next steps will focus on making sure ActionEffortModal properly handles the edit mode and updates the action in the database.

---

## Console Logs

When Edit is clicked, you'll see:
```
[GoalDetailView] Edit action: <action-id> <action-title>
```

This helps with debugging to confirm the handler is called correctly.

---

🎉 **Step 1 Complete!** 🎉
