# Archived Monthly History Function Migrations

## Purpose

This directory contains superseded migration files that were intermediate versions of the `get_month_dates_with_items` function. These files have been archived to avoid confusion and prevent duplicate function definitions.

## Active Migrations

Only two migrations remain active for the monthly history functions:

1. **20251107030016_create_monthly_history_functions.sql** - Original creation of the function
2. **20251202221646_add_item_types_to_monthly_history.sql** - Latest version with item_details JSONB

## Archived Migrations

The following migrations were archived on 2025-12-02 because they represented intermediate iterations that have been superseded:

### 20251107031048_fix_monthly_dates_function_ambiguous_column.sql
- Fixed ambiguous column references
- Superseded by later timezone and filtering improvements

### 20251107230503_fix_timezone_and_add_reflection_titles.sql
- Added timezone handling and reflection titles
- Superseded by the notes filter implementation

### 20251111120000_update_monthly_history_notes_filter.sql
- Updated to filter notes by content
- Superseded by the real notes filtering logic

### 20251112090000_filter_monthly_history_to_real_notes.sql
- Ensured only real notes (with content or attachments) appear
- Superseded by the item_details enhancement

## Why Archive?

Having multiple migrations redefining the same function caused:
- Confusion about which version was active
- Potential duplicate data issues
- Difficulty understanding the migration history

By archiving intermediate versions, we maintain a clean migration path with only the original creation and the final version.

## Current Function Signature

```sql
CREATE FUNCTION get_month_dates_with_items(
  p_year integer,
  p_month integer,
  p_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  item_date date,
  reflections_count bigint,
  tasks_count bigint,
  events_count bigint,
  deposit_ideas_count bigint,
  withdrawals_count bigint,
  notes_count bigint,
  content_summary text,
  item_details jsonb
)
```

The `item_details` column provides structured data with item types and titles for proper icon display in the UI.
