# Database Views Implementation Plan

## Executive Summary

This plan outlines the implementation of PostgreSQL database views to improve performance, maintainability, and data consistency for the Weekly Reflection feature and related analytics. The views will replace complex TypeScript queries with optimized database-level aggregations.

## Problem Statement

Currently, the Weekly Reflection feature:
- Performs multiple nested queries in loops (N+1 query problem)
- Has date format inconsistencies causing data mismatches
- Duplicates logic across multiple TypeScript functions
- Suffers from performance issues with large datasets
- Makes debugging and maintenance difficult

## Solution: Database Views

Database views will provide:
- **Performance**: Single optimized query instead of multiple loops
- **Consistency**: Date handling done consistently at database level
- **Maintainability**: Single source of truth for aggregation logic
- **Scalability**: Database-optimized joins and aggregations
- **Debugging**: Easy to test and validate SQL directly

---

## Phase 1: Core Weekly Aggregation Views

### View 1: v_weekly_completed_tasks

**Purpose**: Pre-aggregate all completed tasks by week with their associations

```sql
CREATE OR REPLACE VIEW v_weekly_completed_tasks AS
SELECT
  t.user_id,
  t.id as task_id,
  t.title,
  t.completed_at,
  date_trunc('week', t.completed_at)::date as week_start_date,
  (date_trunc('week', t.completed_at) + interval '6 days')::date as week_end_date,
  t.is_authentic_deposit,
  t.is_urgent,
  t.is_important,
  -- Aggregate roles as array
  COALESCE(
    array_agg(DISTINCT rj.role_id) FILTER (WHERE rj.role_id IS NOT NULL),
    ARRAY[]::uuid[]
  ) as role_ids,
  -- Aggregate domains as array
  COALESCE(
    array_agg(DISTINCT dj.domain_id) FILTER (WHERE dj.domain_id IS NOT NULL),
    ARRAY[]::uuid[]
  ) as domain_ids,
  -- Aggregate goals as array
  COALESCE(
    array_agg(DISTINCT COALESCE(gj.twelve_wk_goal_id, gj.custom_goal_id))
    FILTER (WHERE gj.twelve_wk_goal_id IS NOT NULL OR gj.custom_goal_id IS NOT NULL),
    ARRAY[]::uuid[]
  ) as goal_ids,
  -- Check for notes
  EXISTS(
    SELECT 1 FROM "0008-ap-universal-notes-join" nj
    WHERE nj.parent_id = t.id AND nj.parent_type = 'task'
  ) as has_notes
FROM "0008-ap-tasks" t
LEFT JOIN "0008-ap-universal-roles-join" rj
  ON rj.parent_id = t.id AND rj.parent_type = 'task'
LEFT JOIN "0008-ap-universal-domains-join" dj
  ON dj.parent_id = t.id AND dj.parent_type = 'task'
LEFT JOIN "0008-ap-universal-goals-join" gj
  ON gj.parent_id = t.id AND gj.parent_type = 'task'
WHERE t.completed_at IS NOT NULL
GROUP BY t.id, t.user_id, t.title, t.completed_at, t.is_authentic_deposit, t.is_urgent, t.is_important;
```

**Benefits**:
- Single query replaces multiple joins
- Week calculation done once by database
- Arrays make it easy to count associations
- Ready for efficient filtering

---

### View 2: v_weekly_goal_actions

**Purpose**: Count completed actions per goal per week

```sql
CREATE OR REPLACE VIEW v_weekly_goal_actions AS
SELECT
  t.user_id,
  COALESCE(gj.twelve_wk_goal_id, gj.custom_goal_id) as goal_id,
  gj.goal_type,
  date_trunc('week', t.completed_at)::date as week_start_date,
  COUNT(*) as action_count,
  -- Include goal details for convenience
  CASE
    WHEN gj.goal_type = 'twelve_wk_goal' THEN tw.title
    WHEN gj.goal_type = 'custom_goal' THEN cg.title
  END as goal_title,
  CASE
    WHEN gj.goal_type = 'twelve_wk_goal' THEN tw.status
    WHEN gj.goal_type = 'custom_goal' THEN cg.status
  END as goal_status
FROM "0008-ap-tasks" t
INNER JOIN "0008-ap-universal-goals-join" gj
  ON gj.parent_id = t.id AND gj.parent_type = 'task'
LEFT JOIN "0008-ap-goals-12wk" tw
  ON gj.twelve_wk_goal_id = tw.id
LEFT JOIN "0008-ap-goals-custom" cg
  ON gj.custom_goal_id = cg.id
WHERE t.completed_at IS NOT NULL
GROUP BY
  t.user_id,
  goal_id,
  gj.goal_type,
  date_trunc('week', t.completed_at)::date,
  goal_title,
  goal_status;
```

**Usage Example**:
```typescript
const { data } = await supabase
  .from('v_weekly_goal_actions')
  .select('*')
  .eq('user_id', userId)
  .eq('week_start_date', weekStartDate)
  .eq('goal_status', 'active');
// Returns complete goal summary with counts
```

---

### View 3: v_weekly_role_investments

**Purpose**: Aggregate task and deposit idea activity by role per week

```sql
CREATE OR REPLACE VIEW v_weekly_role_investments AS
WITH task_activities AS (
  SELECT
    t.user_id,
    rj.role_id,
    date_trunc('week', t.completed_at)::date as week_start_date,
    COUNT(*) as task_count
  FROM "0008-ap-tasks" t
  INNER JOIN "0008-ap-universal-roles-join" rj
    ON rj.parent_id = t.id AND rj.parent_type = 'task'
  WHERE t.completed_at IS NOT NULL
  GROUP BY t.user_id, rj.role_id, date_trunc('week', t.completed_at)::date
),
deposit_activities AS (
  SELECT
    di.user_id,
    rj.role_id,
    date_trunc('week', di.created_at)::date as week_start_date,
    COUNT(*) as deposit_idea_count
  FROM "0008-ap-deposit-ideas" di
  INNER JOIN "0008-ap-universal-roles-join" rj
    ON rj.parent_id = di.id AND rj.parent_type = 'depositIdea'
  WHERE di.archived = false
  GROUP BY di.user_id, rj.role_id, date_trunc('week', di.created_at)::date
)
SELECT
  COALESCE(ta.user_id, da.user_id) as user_id,
  COALESCE(ta.role_id, da.role_id) as role_id,
  COALESCE(ta.week_start_date, da.week_start_date) as week_start_date,
  COALESCE(ta.task_count, 0) as task_count,
  COALESCE(da.deposit_idea_count, 0) as deposit_idea_count,
  COALESCE(ta.task_count, 0) + COALESCE(da.deposit_idea_count, 0) as total_activities,
  -- Join role details
  r.label as role_label,
  r.color as role_color
FROM task_activities ta
FULL OUTER JOIN deposit_activities da
  ON ta.user_id = da.user_id
  AND ta.role_id = da.role_id
  AND ta.week_start_date = da.week_start_date
INNER JOIN "0008-ap-roles" r
  ON r.id = COALESCE(ta.role_id, da.role_id);
```

**Usage Example**:
```typescript
const { data } = await supabase
  .from('v_weekly_role_investments')
  .select('*')
  .eq('user_id', userId)
  .eq('week_start_date', weekStartDate)
  .order('total_activities', { ascending: false });
// Returns roles with activity counts, sorted by most active
```

---

### View 4: v_weekly_domain_balance

**Purpose**: Count activities per wellness domain per week

```sql
CREATE OR REPLACE VIEW v_weekly_domain_balance AS
SELECT
  t.user_id,
  dj.domain_id,
  date_trunc('week', t.completed_at)::date as week_start_date,
  COUNT(*) as activity_count,
  -- Join domain details
  d.name as domain_name,
  d.color as domain_color
FROM "0008-ap-tasks" t
INNER JOIN "0008-ap-universal-domains-join" dj
  ON dj.parent_id = t.id AND dj.parent_type = 'task'
INNER JOIN "0008-ap-domains" d
  ON d.id = dj.domain_id
WHERE t.completed_at IS NOT NULL
GROUP BY
  t.user_id,
  dj.domain_id,
  date_trunc('week', t.completed_at)::date,
  d.name,
  d.color;
```

---

### View 5: v_weekly_withdrawals

**Purpose**: Aggregate withdrawals with associated roles per week

```sql
CREATE OR REPLACE VIEW v_weekly_withdrawals AS
SELECT
  w.user_id,
  w.id as withdrawal_id,
  w.title,
  w.amount,
  w.withdrawn_at,
  date_trunc('week', w.withdrawn_at)::date as week_start_date,
  -- Aggregate roles
  COALESCE(
    array_agg(DISTINCT rj.role_id) FILTER (WHERE rj.role_id IS NOT NULL),
    ARRAY[]::uuid[]
  ) as role_ids,
  -- Aggregate domains
  COALESCE(
    array_agg(DISTINCT dj.domain_id) FILTER (WHERE dj.domain_id IS NOT NULL),
    ARRAY[]::uuid[]
  ) as domain_ids
FROM "0008-ap-withdrawals" w
LEFT JOIN "0008-ap-universal-roles-join" rj
  ON rj.parent_id = w.id AND rj.parent_type = 'withdrawal'
LEFT JOIN "0008-ap-universal-domains-join" dj
  ON dj.parent_id = w.id AND dj.parent_type = 'withdrawal'
GROUP BY w.id, w.user_id, w.title, w.amount, w.withdrawn_at;
```

---

## Phase 2: Materialized Views (Optional Performance Optimization)

For even better performance, convert views to **materialized views** with refresh strategy:

```sql
CREATE MATERIALIZED VIEW mv_weekly_goal_actions AS
SELECT * FROM v_weekly_goal_actions;

-- Create index for fast lookups
CREATE INDEX idx_mv_weekly_goal_actions_user_week
  ON mv_weekly_goal_actions(user_id, week_start_date);

-- Refresh function (call after task completions)
CREATE OR REPLACE FUNCTION refresh_weekly_aggregations()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_weekly_goal_actions;
  -- Add other materialized views as needed
END;
$$ LANGUAGE plpgsql;
```

**When to use materialized views**:
- Large datasets (10,000+ completed tasks per user)
- Historical data (older weeks that won't change)
- Real-time performance critical

**Refresh strategy**:
- Automatic: Trigger on task completion
- Scheduled: Nightly refresh for historical data
- Manual: On-demand for current week

---

## Phase 3: TypeScript Integration

### Updated fetchGoalActionsSummary

**Before** (multiple queries in loops):
```typescript
for (const goal of goals) {
  const { count } = await supabase
    .from('0008-ap-universal-goals-join')
    .select('*, 0008-ap-tasks!inner(completed_at)', { count: 'exact' })
    // ... complex filtering
}
```

**After** (single query):
```typescript
export const fetchGoalActionsSummary = async (
  userId: string,
  weekStartDate: string // Now just needs date string YYYY-MM-DD
): Promise<GoalActionSummary[]> => {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('v_weekly_goal_actions')
    .select('*')
    .eq('user_id', userId)
    .eq('week_start_date', weekStartDate)
    .eq('goal_status', 'active')
    .gt('action_count', 0);

  if (error) {
    console.error('Error fetching goal actions:', error);
    return [];
  }

  return data.map(row => ({
    goal_id: row.goal_id,
    goal_title: row.goal_title,
    action_count: row.action_count,
  }));
};
```

### Updated fetchWeeklyRoleInvestments

**After**:
```typescript
export const fetchWeeklyRoleInvestments = async (
  userId: string,
  weekStartDate: string
): Promise<WeeklyRoleInvestment[]> => {
  const { data, error } = await supabase
    .from('v_weekly_role_investments')
    .select('*')
    .eq('user_id', userId)
    .eq('week_start_date', weekStartDate)
    .gt('total_activities', 0)
    .order('total_activities', { ascending: false });

  if (error) return [];

  return data.map(row => ({
    role_id: row.role_id,
    role_label: row.role_label,
    role_color: row.role_color,
    task_count: row.task_count,
    deposit_idea_count: row.deposit_idea_count,
  }));
};
```

---

## Implementation Steps

### Step 1: Create Migration File

Create: `supabase/migrations/YYYYMMDDHHMMSS_create_weekly_reflection_views.sql`

Include all 5 views with:
- Detailed comments explaining each view
- Index recommendations
- RLS consideration note

### Step 2: Apply Migration

```bash
# Test locally first
npm run db:migrate

# Verify views created
# Check via Supabase dashboard or SQL:
SELECT * FROM v_weekly_goal_actions LIMIT 5;
```

### Step 3: Update TypeScript Code

1. Update `lib/weeklyReflectionData.ts` to use views
2. Remove complex loop-based queries
3. Simplify date handling (database handles it now)
4. Add error handling and logging

### Step 4: Test Thoroughly

- **Unit tests**: Test view queries with sample data
- **Integration tests**: Verify Weekly Reflection shows correct data
- **Performance tests**: Compare query execution times
- **Edge cases**: Empty weeks, timezone boundaries, archived goals

### Step 5: Monitor and Optimize

- Add database query performance monitoring
- Check view query plans with EXPLAIN ANALYZE
- Add indexes if needed for common filter patterns
- Consider materialized views if performance becomes an issue

---

## Benefits Summary

### Performance Improvements
- **Query reduction**: 5-20 queries → 1-2 queries per aggregation
- **Execution time**: Estimated 70-90% faster for typical data
- **Scalability**: Linear scaling instead of quadratic

### Code Quality
- **Lines of code**: ~400 lines → ~100 lines in TypeScript
- **Complexity**: O(n²) → O(1) query complexity
- **Maintainability**: Single source of truth in database

### Reliability
- **Date handling**: Consistent timezone handling
- **Data accuracy**: No format mismatches
- **Debugging**: Easy to test SQL directly

---

## Rollback Plan

If issues arise:

1. **Keep old functions**: Don't delete original TypeScript functions immediately
2. **Feature flag**: Add toggle to switch between view-based and old queries
3. **Monitoring**: Track errors and performance metrics
4. **Quick rollback**: Revert to old functions if needed

```typescript
const USE_DATABASE_VIEWS = process.env.EXPO_PUBLIC_USE_DB_VIEWS === 'true';

export const fetchGoalActionsSummary = async (...args) => {
  return USE_DATABASE_VIEWS
    ? fetchGoalActionsSummaryFromView(...args)
    : fetchGoalActionsSummaryLegacy(...args);
};
```

---

## Future Enhancements

Once views are stable:

1. **Analytics Dashboard**: Use views for charts and trends
2. **Historical Comparisons**: Week-over-week, month-over-month
3. **Predictive Analytics**: Trend analysis and goal forecasting
4. **Export Features**: CSV/PDF reports from aggregated data
5. **Real-time Updates**: WebSocket subscriptions to view changes

---

## Conclusion

Implementing database views will significantly improve the Weekly Reflection feature's performance, reliability, and maintainability. The views provide a solid foundation for current needs and future analytics features.

**Recommended Timeline**:
- Phase 1 (Core Views): 1-2 days
- Testing & Validation: 1 day
- TypeScript Integration: 1 day
- Total: 3-4 days

**Priority**: High - Fixes current bugs and prevents future issues
