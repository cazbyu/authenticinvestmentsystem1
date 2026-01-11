/*
  # Fix Parent Type Mismatches in Follow-Through Items

  This migration corrects parent_type values in child items that were created with incorrect parent_type values.

  ## Issues Fixed

  1. **Tasks Table (`0008-ap-tasks`)**
     - Child tasks/events of EVENT parents: parent_type 'task' → 'event'
     - Child tasks/events of ROSE parents: parent_type 'reflection' → 'rose'
     - Child tasks/events of THORN parents: parent_type 'reflection' → 'thorn'

  2. **Reflections Table (`0008-ap-reflections`)**
     - Child reflections of EVENT parents: parent_type 'task' → 'event'
     - Child reflections of ROSE parents: parent_type 'reflection' → 'rose'
     - Child reflections of THORN parents: parent_type 'reflection' → 'thorn'

  3. **Deposit Ideas Table (`0008-ap-deposit-ideas`)**
     - Child deposit ideas of EVENT parents: parent_type 'task' → 'event'
     - Child deposit ideas of ROSE parents: parent_type 'reflection' → 'rose'
     - Child deposit ideas of THORN parents: parent_type 'reflection' → 'thorn'

  ## Background

  The issue occurred because the detail modals were passing hardcoded parent_type values
  ('task' for all tasks/events, 'reflection' for all reflections) instead of determining
  the correct type dynamically. This caused child items to be created with incorrect
  parent_type values, preventing them from being displayed when the parent item was viewed.
*/

-- Fix tasks table: Update children of events
UPDATE "0008-ap-tasks" child
SET parent_type = 'event'
FROM "0008-ap-tasks" parent
WHERE child.parent_id = parent.id
  AND child.parent_type = 'task'
  AND parent.type = 'event';

-- Fix tasks table: Update children of roses
UPDATE "0008-ap-tasks" child
SET parent_type = 'rose'
FROM "0008-ap-reflections" parent
WHERE child.parent_id = parent.id
  AND child.parent_type = 'reflection'
  AND parent.daily_rose = true;

-- Fix tasks table: Update children of thorns
UPDATE "0008-ap-tasks" child
SET parent_type = 'thorn'
FROM "0008-ap-reflections" parent
WHERE child.parent_id = parent.id
  AND child.parent_type = 'reflection'
  AND parent.daily_thorn = true;

-- Fix reflections table: Update children of events
UPDATE "0008-ap-reflections" child
SET parent_type = 'event'
FROM "0008-ap-tasks" parent
WHERE child.parent_id = parent.id
  AND child.parent_type = 'task'
  AND parent.type = 'event';

-- Fix reflections table: Update children of roses
UPDATE "0008-ap-reflections" child
SET parent_type = 'rose'
FROM "0008-ap-reflections" parent
WHERE child.parent_id = parent.id
  AND child.parent_type = 'reflection'
  AND child.id != parent.id
  AND parent.daily_rose = true;

-- Fix reflections table: Update children of thorns
UPDATE "0008-ap-reflections" child
SET parent_type = 'thorn'
FROM "0008-ap-reflections" parent
WHERE child.parent_id = parent.id
  AND child.parent_type = 'reflection'
  AND child.id != parent.id
  AND parent.daily_thorn = true;

-- Fix deposit ideas table: Update children of events
UPDATE "0008-ap-deposit-ideas" child
SET parent_type = 'event'
FROM "0008-ap-tasks" parent
WHERE child.parent_id = parent.id
  AND child.parent_type = 'task'
  AND parent.type = 'event';

-- Fix deposit ideas table: Update children of roses
UPDATE "0008-ap-deposit-ideas" child
SET parent_type = 'rose'
FROM "0008-ap-reflections" parent
WHERE child.parent_id = parent.id
  AND child.parent_type = 'reflection'
  AND parent.daily_rose = true;

-- Fix deposit ideas table: Update children of thorns
UPDATE "0008-ap-deposit-ideas" child
SET parent_type = 'thorn'
FROM "0008-ap-reflections" parent
WHERE child.parent_id = parent.id
  AND child.parent_type = 'reflection'
  AND parent.daily_thorn = true;