# Deletion Filter Consistency Audit (Nov 10)

## Server-side SQL
- `v_tasks_with_recurrence_expanded` already enforced `t.deleted_at IS NULL` for all unions. `v_dashboard_next_occurrences` inherits that filter.
- `get_notes_for_reflection_date` previously returned deleted tasks and archived deposit ideas. Updated to require `t.deleted_at IS NULL` and `di.archived = false`/`di.is_active = true`.
- `get_month_dates_with_items` and `get_monthly_item_counts` already filtered task/event rows; deposit idea and withdrawal branches lacked delete/archival checks. Added `archived = false` and `is_active = true` for deposit ideas. Withdrawals remain hard deletes (no `deleted_at` column available).
- Weekly/daily reflection views (`v_weekly_*`, `v_daily_*`) previously missed `deleted_at`/`archived` checks. Added `t.deleted_at IS NULL` to every task source and `di.archived = false AND di.is_active = true` to deposit idea aggregates.

## Frontend Queries
- Added `.is('deleted_at', null)` to every task fetch used in dashboards, analytics, suggestions, reflections, goal progress, and completion utilities.
- Added `.eq('archived', false)` + `.eq('is_active', true)` pairs (or ensured both) for all deposit idea fetches across dashboard, wellness, roles, and reflection views.
- Withdrawal fetches remain unchanged; the table performs hard deletes, so no additional flag exists to filter.

All main data paths now consistently hide soft-deleted tasks and archived/inactive deposit ideas.
