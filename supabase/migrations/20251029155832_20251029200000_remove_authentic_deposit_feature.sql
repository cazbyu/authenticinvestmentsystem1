/*
  # Remove Authentic Deposit Feature

  1. **Cleanup Actions**
     - Drop database functions for authentic deposit tracking
     - Drop performance index for authentic deposit queries
     - Remove is_authentic_deposit column from tasks table
     - All existing data preserved (column dropped, not deleted)

  2. **Removed Functions**
     - fn_get_user_week_start_day: User week start preference (no longer needed for authentic deposits)
     - fn_count_weekly_authentic_deposits: Weekly authentic deposit counter
     - fn_count_scoped_authentic_deposits: Scoped authentic deposit counter

  3. **Removed Indexes**
     - idx_tasks_authentic_week: Composite index for authentic deposit queries

  4. **Schema Changes**
     - Remove is_authentic_deposit column from 0008-ap-tasks table
     - This does not delete data, only removes the column from schema

  5. **Impact**
     - Task point calculations no longer include +2 authentic deposit bonus
     - Analytics no longer track authentic deposit metrics
     - Weekly 14-deposit limit removed
*/

-- Drop database functions
DROP FUNCTION IF EXISTS fn_count_scoped_authentic_deposits(uuid, timestamptz, timestamptz, text, uuid);
DROP FUNCTION IF EXISTS fn_count_weekly_authentic_deposits(uuid, timestamptz, timestamptz);
DROP FUNCTION IF EXISTS fn_get_user_week_start_day(uuid);

-- Drop performance index
DROP INDEX IF EXISTS idx_tasks_authentic_week;

-- Remove is_authentic_deposit column from tasks table
-- Using CASCADE to drop dependent views that will be recreated without this column
ALTER TABLE "0008-ap-tasks" DROP COLUMN IF EXISTS is_authentic_deposit CASCADE;
