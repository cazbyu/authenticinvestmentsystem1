# Parent-Child Actions Implementation

## Overview

This document describes the implementation of a hierarchical parent-child relationship system that allows tasks, events, and reflections to be linked together, creating a flexible action hierarchy.

## Features Implemented

### 1. Database Schema Updates

#### Tables Modified
- **0008-ap-tasks**: Added `parent_id` and `parent_type` columns
- **0008-ap-reflections**: Added `parent_id` and `parent_type` columns

#### Key Features
- Parent-child relationships support up to 8 levels of nesting
- Automatic orphaning: When a parent is deleted, children's parent references are set to NULL
- Validation triggers prevent circular references and enforce depth limits
- Cross-table support: Tasks can have reflection parents and vice versa

#### Migration Files
- `add_parent_child_relationships_to_tasks.sql`
- `add_parent_child_relationships_to_reflections.sql`

### 2. Unified ActionDetails Modal

#### Location
`/components/actions/ActionDetailsModal.tsx`

#### Features
- **Dynamic Title**: Shows "Task Details" or "Event Details" based on item type
- **Completed Date Display**: Shows completion date to the right of due date for completed items
- **Event Time Display**: For events, displays time in parentheses next to the date (e.g., "7:30AM - 9:30AM")
- **Notes Section with Add Capability**:
  - "+" button to add new notes
  - Paperclip icon to attach files
  - Internal save button for new notes
  - Displays existing notes with attachments
  - Image viewer for photo attachments
- **Associated Actions and Reflections List**:
  - Shows all child items (tasks, events, roses, thorns, deposit ideas, reflections)
  - Alternating white and gray rows for readability
  - Icons to identify each item type
  - Most recent items first
- **Actions Bar**:
  - Icon-only buttons with tooltips on hover
  - Creates new child items linked to the current item
  - Supported types: Task, Event, Rose, Thorn, Reflection, Deposit Idea

#### Props Interface
```typescript
interface ActionDetailsModalProps {
  visible: boolean;
  item: Task | Reflection | null;
  itemType: 'task' | 'event' | 'reflection';
  onClose: () => void;
  onUpdate?: (item: any) => void;
  onDelegate?: (item: any) => void;
  onCancel?: (item: any) => void;
  onCreateChild?: (parentId: string, parentType: string, childType: string) => void;
}
```

### 3. TaskEventForm Updates

#### Location
`/components/tasks/TaskEventForm.tsx`

#### New Props
- `parentId?: string` - ID of the parent item
- `parentType?: 'task' | 'reflection'` - Type of parent
- `preSelectedType?` - Pre-selects the form type (task, event, rose, thorn, etc.)

#### Features
- Automatically sets parent relationship when creating from a parent
- Pre-selects form type and reflection mode based on caller intent
- Saves parent_id and parent_type with new tasks/events/reflections
- Initializes form with parent context

#### Form Data Interface Updates
```typescript
interface FormData {
  // ... existing fields

  // Parent-child relationship fields
  parentId?: string;
  parentType?: 'task' | 'reflection';
}
```

### 4. Parent-Child Workflow

#### Creating a Child Action

1. User opens Task/Event/Reflection details
2. User clicks an action icon at the bottom (Task, Event, Rose, Thorn, Reflection, Deposit Idea)
3. TaskEventForm opens with:
   - `parentId` set to current item's ID
   - `parentType` set to current item's type ('task' or 'reflection')
   - Form type pre-selected based on clicked icon
4. User completes and submits form
5. New item is created with parent relationship
6. Parent's ActionDetailsModal refreshes to show new child in Associated list

#### Viewing Children

1. Open any task, event, or reflection details
2. Scroll to "Associated Actions and Reflections" section
3. See all child items with:
   - Icon indicating type
   - Title/content preview
   - Date information
   - Alternating row colors for readability

#### Data Flow

```
Parent Item (Task/Event/Reflection)
  ↓
  Opens ActionDetailsModal
  ↓
  User clicks action button (e.g., "Add Task")
  ↓
  Calls onCreateChild(parentId, parentType, 'task')
  ↓
  Opens TaskEventForm with parent info
  ↓
  User fills form and saves
  ↓
  New task created with parent_id and parent_type
  ↓
  Child appears in parent's Associated list
```

## UI/UX Details

### ActionDetailsModal Layout

```
┌─────────────────────────────────────┐
│ Task Details                     [X]│
├─────────────────────────────────────┤
│ Title: Complete Project Report      │
│                                     │
│ Due Date: Monday, Dec 4, 2025       │
│ Completed Date: Tuesday, Dec 5, 2025│
│                                     │
│ Priority: Important                 │
│                                     │
│ ── Notes ──────────────── [+] [📎] │
│ [Text input area when + clicked]    │
│ [Save Note]                         │
│                                     │
│ Existing note 1...                  │
│ Existing note 2...                  │
│                                     │
│ ── Associated Actions & Reflections │
│ ✓ Follow-up meeting (white row)    │
│ 🌹 Successful completion (gray row) │
│ 💡 Ideas for next phase (white row)│
│                                     │
│ ── Actions ────────────────────────│
│ [✓] [📅] [🌹] [⚠] [📖] [💡]        │
│ (with tooltips on hover)            │
├─────────────────────────────────────┤
│ [Update] [Delegate] [Cancel]       │
└─────────────────────────────────────┘
```

### Icon Legend

- ✓ (CheckSquare) - Task - Green (#16a34a)
- 📅 (Calendar) - Event - Blue (#0078d4)
- 🌹 (Flower2) - Rose - Red (#dc2626)
- ⚠ (AlertTriangle) - Thorn - Amber (#f59e0b)
- 📖 (BookText) - Reflection - Purple (#9333ea)
- 💡 (Lightbulb) - Deposit Idea - Yellow (#fbbf24)

## Database Constraints

### Parent Type Values
- `'task'` - Parent is a task or event (both stored in 0008-ap-tasks)
- `'reflection'` - Parent is a reflection (roses, thorns, reflections, deposit ideas)

### Validation Rules
1. `parent_id` and `parent_type` must both be set or both be NULL
2. Maximum nesting depth: 8 levels
3. No circular references (task cannot be its own ancestor)
4. Parent must exist in the appropriate table
5. When parent is deleted, children are orphaned (parent_id set to NULL)

### Triggers

#### validate_task_parent_depth()
Checks that task hierarchy doesn't exceed 8 levels

#### validate_task_parent_reference()
Validates that parent exists and prevents self-referencing

#### orphan_child_tasks_on_parent_delete()
Sets parent_id to NULL for children when parent task is deleted

#### validate_reflection_parent_depth()
Checks that reflection hierarchy doesn't exceed 8 levels

#### validate_reflection_parent_reference()
Validates that parent exists and prevents self-referencing

#### orphan_child_reflections_on_parent_delete()
Sets parent_id to NULL for children when parent is deleted

## Integration Points

### Components That Need Updates

#### Journal List View
- When clicking a task/event/reflection from the journal
- Should open ActionDetailsModal instead of TaskEventForm
- Pass itemType prop correctly

#### Calendar View
- When clicking an event on the calendar
- Should open ActionDetailsModal with itemType='event'

#### Reflections View
- When viewing roses/thorns/reflections
- Should open ActionDetailsModal with itemType='reflection'

### Example Integration

```typescript
// In Journal List
const handleItemPress = (item) => {
  setSelectedItem(item);
  setSelectedItemType(item.type === 'event' ? 'event' : item.type === 'task' ? 'task' : 'reflection');
  setDetailsModalVisible(true);
};

// Render ActionDetailsModal
<ActionDetailsModal
  visible={detailsModalVisible}
  item={selectedItem}
  itemType={selectedItemType}
  onClose={() => setDetailsModalVisible(false)}
  onCreateChild={(parentId, parentType, childType) => {
    // Close details modal
    setDetailsModalVisible(false);

    // Open TaskEventForm with parent info
    setTaskEventFormProps({
      mode: 'create',
      parentId,
      parentType,
      preSelectedType: childType
    });
    setTaskEventFormVisible(true);
  }}
  // ... other handlers
/>
```

## Benefits

1. **Hierarchical Organization**: Users can create structured action hierarchies
2. **Context Preservation**: Child actions maintain link to parent context
3. **Flexible Relationships**: Mix tasks, events, and reflections in hierarchy
4. **Easy Navigation**: View all related actions in one place
5. **Audit Trail**: Track which actions spawned from which reflections/tasks

## Future Enhancements

### Potential Additions
1. **Sibling Navigation**: Browse siblings of current item
2. **Breadcrumb Trail**: Show path from root to current item
3. **Bulk Operations**: Apply actions to entire hierarchy
4. **Hierarchy Visualization**: Tree or graph view of relationships
5. **Smart Suggestions**: Recommend creating child actions based on content
6. **Regular Reflection Type**: Add 4th reflection type with purple badge

## Testing Checklist

- [ ] Create task with child task
- [ ] Create task with child event
- [ ] Create task with child rose
- [ ] Create task with child thorn
- [ ] Create task with child reflection
- [ ] Create task with child deposit idea
- [ ] Create event with child task
- [ ] Create reflection with child task
- [ ] View children in Associated list
- [ ] Verify alternating row colors
- [ ] Add note from ActionDetailsModal
- [ ] Add attachment from ActionDetailsModal
- [ ] Verify completed date shows for completed items
- [ ] Verify event times show correctly
- [ ] Test tooltip hover on action icons
- [ ] Delete parent and verify children are orphaned
- [ ] Test maximum depth (8 levels)
- [ ] Test circular reference prevention

## Notes

- The implementation uses the existing TaskEventForm, avoiding duplication
- Parent-child relationships are stored at the database level for reliability
- The system automatically handles orphaning to prevent broken references
- Maximum depth of 8 levels provides flexibility while preventing infinite loops
- Icons and colors follow the existing app design system
