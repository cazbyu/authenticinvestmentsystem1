# Parent Information Display Implementation

## Summary

Successfully implemented the missing parent information display feature. When viewing a task, event, reflection, rose, thorn, or deposit idea that was created as a follow-through item from another parent item, the detail modal now displays information about the parent item.

## Changes Made

### 1. Created ParentItemInfo Component
**File:** `components/followThrough/ParentItemInfo.tsx`

- Reusable component that displays parent item information
- Accepts `parentId`, `parentType`, and `onPress` props
- Fetches parent item details from the appropriate table based on type
- Shows icon, type label, title, and date for the parent
- Handles loading and error states
- Clickable to navigate to parent item when `onPress` handler is provided

### 2. Updated Task Interface
**File:** `components/tasks/TaskCard.tsx`

Added fields to the `Task` interface:
- `parent_id?: string` - ID of the parent item
- `parent_type?: string` - Type of parent (task, event, reflection, rose, thorn, depositIdea)
- `delegates?: Array<{id: string; name: string}>` - Added for consistency

### 3. Updated ActionDetailsModal
**File:** `components/tasks/ActionDetailsModal.tsx`

- Added import for `ParentItemInfo` component
- Added import for `Edit` icon from lucide-react-native
- Integrated `ParentItemInfo` component into the detail view
- Displays parent info between task title and task details
- Passes `onItemPress` handler for navigation to parent item

### 4. Updated ReflectionWithRelations Interface
**File:** `lib/reflectionUtils.ts`

Added fields to the `ReflectionWithRelations` interface:
- `parent_id?: string` - ID of the parent item
- `parent_type?: string` - Type of parent item

### 5. Updated ReflectionDetailsModal
**File:** `components/reflections/ReflectionDetailsModal.tsx`

- Added import for `ParentItemInfo` component
- Integrated `ParentItemInfo` component into the detail view
- Displays parent info between reflection title and reflection content
- Passes `onItemPress` handler for navigation to parent item

### 6. Updated DepositIdea Interfaces
**Files:**
- `components/depositIdeas/DepositIdeaCard.tsx`
- `components/depositIdeas/DepositIdeaDetailModal.tsx`

Added fields to both `DepositIdea` interfaces:
- `parent_id?: string` - ID of the parent item
- `parent_type?: string` - Type of parent item

### 7. Updated DepositIdeaDetailModal
**File:** `components/depositIdeas/DepositIdeaDetailModal.tsx`

- Added import for `ParentItemInfo` component
- Integrated `ParentItemInfo` component into the detail view
- Displays parent info between deposit idea title and status section
- Passes `onItemPress` handler for navigation to parent item

## How It Works

1. When a user creates a follow-through item from a parent (task, event, reflection, etc.), the `parent_id` and `parent_type` are stored in the database

2. When viewing the child item in any detail modal, the component checks if `parent_id` and `parent_type` exist

3. If parent information exists, the `ParentItemInfo` component is rendered

4. The component fetches the parent item details from the appropriate table and displays:
   - An icon representing the parent type
   - The parent type label
   - The parent item title
   - The parent item date (if available)

5. Users can click on the parent info card to navigate to the parent item

## Database Schema

The parent-child relationship columns already exist in the database:
- `0008-ap-tasks` table has `parent_id` and `parent_type` columns
- `0008-ap-reflections` table has `parent_id` and `parent_type` columns
- `0008-ap-deposit-ideas` table has `parent_id` and `parent_type` columns

These were added in migration: `20251204223238_add_parent_child_relationships_to_tasks.sql`

## Testing Notes

To test this feature:

1. Create a task or reflection
2. Open the detail view
3. Use the "Follow Through Actions or Thoughts" section to create a child item
4. Open the child item's detail view
5. Verify that the parent information is displayed at the top
6. Click on the parent info card to navigate back to the parent

## Known Limitations

- The build currently has an unrelated error with `assets/images/rose.png` file
- Some pre-existing TypeScript errors in the codebase (unrelated to this feature)
- Parent information queries are not yet included in all task fetching functions (may need to update `taskUtils.ts` functions to SELECT parent_id and parent_type)

## Future Improvements

1. Update all task/reflection/deposit idea fetching queries to include `parent_id` and `parent_type` in SELECT statements
2. Add visual indicators in list views to show which items have parents
3. Add breadcrumb navigation showing the parent-child hierarchy
4. Consider adding a "View Children" section in parent items to show all follow-through items
