# Migration Fix Summary - October 13, 2025

## Problem Identified

The database had conflicting migrations that created incompatible function definitions, resulting in the error:
```
ERROR: P0001: CRITICAL: generate_adjusted_global_weeks does not exist
```

## Root Cause Analysis

1. **Migration Conflict Chain:**
   - `20251012190740` created `generate_adjusted_global_weeks(uuid)` (user-specific weeks)
   - `20251012200000` dropped it and created `generate_canonical_global_weeks(uuid)` (cycle-level weeks)
   - `20251013000000` and `20251013050439` referenced the dropped `generate_adjusted_global_weeks`
   - `20251013053632` also called the non-existent function

2. **Initial Fix Attempt Issues:**
   - Used wrong column names (`start_date`/`end_date` instead of `week_start`/`week_end`)
   - Used `current_date` instead of actual cycle dates
   - Changed return types to `jsonb` breaking compatibility
   - Hardcoded test user ID (security risk)
   - Missing validation for `v_global_cycles.can_activate`
   - Missing snapshot column population

## Solution Implemented

### New Migration: `20251013160000_corrected_canonical_functions.sql`

This migration provides a comprehensive fix that:

1. **Drops All Conflicting Functions**
   - Removes both `generate_adjusted_global_weeks` and `generate_canonical_global_weeks`
   - Removes all versions of `fn_activate_user_global_timeline`

2. **Creates Corrected `generate_canonical_global_weeks`**
   - Returns `void` (not `jsonb`) for `PERFORM` compatibility
   - Uses correct column names: `week_start` and `week_end`
   - Calculates weeks from cycle's actual `start_date`, not `current_date`
   - Includes `ON CONFLICT` for idempotent operation
   - Properly handles date intervals for 12-week generation

3. **Creates Enhanced `fn_activate_user_global_timeline`**
   - Returns `uuid` (not `jsonb`) as originally designed
   - **Defensive Schema Checks:**
     - Detects if `v_global_cycles` view exists before validating `can_activate`
     - Detects if snapshot columns exist before populating them
     - Detects if `week_start_day` column exists in users table
   - **Proper Authentication:**
     - Requires authenticated user (no fallback test user)
     - Validates user permissions through RLS
   - **Complete Feature Support:**
     - Populates `title`, `start_date`, `end_date` snapshot columns if they exist
     - Reads and updates user's `week_start_day` preference if column exists
     - Validates `can_activate` flag if view exists
     - Prevents duplicate activations

4. **Built-in Verification**
   - Pre-migration state check
   - Post-migration verification
   - Week regeneration with success/error tracking
   - Duplicate detection

## Schema Dependencies

### Required Tables
- `0008-ap-global-cycles` (title, start_date, end_date, status)
- `0008-ap-global-weeks` (week_start, week_end, week_number, global_cycle_id)
- `0008-ap-user-global-timelines` (user_id, global_cycle_id, status, week_start_day, activated_at)

### Optional Schema Elements
- `0008-ap-user-global-timelines.title` (snapshot column)
- `0008-ap-user-global-timelines.start_date` (snapshot column)
- `0008-ap-user-global-timelines.end_date` (snapshot column)
- `0008-ap-users.week_start_day` (user preference column)
- `v_global_cycles` view with `can_activate` column

## Migration Execution Steps

1. **Backup Database** (recommended)
   ```sql
   -- Via Supabase Dashboard or CLI
   ```

2. **Run the Migration**
   ```sql
   -- Execute: 20251013160000_corrected_canonical_functions.sql
   ```

3. **Verify Output**
   - Check for "SUCCESS" notices in regeneration
   - Verify function count = 2
   - Verify duplicate weeks = 0
   - Review any warnings

4. **Test Activation**
   ```sql
   SELECT fn_activate_user_global_timeline(
     '<global_cycle_id>'::uuid,
     'monday'
   );
   ```

## Files Modified

### Created
- `supabase/migrations/20251013160000_corrected_canonical_functions.sql` (corrected version)
- `MIGRATION_FIX_SUMMARY.md` (this file)

### Archived
- `supabase/migrations/20251013_finalize_canonical_functions.sql` → `_archived/`

### Left Unchanged
- All other migrations (historical record preserved)
- Application code (no changes required)

## Cleanup Recommendations

### Optional: Archive Conflicting Migrations

Consider moving these to `_archived/` folder to prevent confusion:
```bash
# These created the conflict chain
20251012190740_implement_week_start_day_adjustment.sql
20251012200000_fix_canonical_week_generation.sql
20251012211141_20251012200000_fix_canonical_week_generation.sql
20251013000000_implement_dynamic_global_cycles_view.sql
20251013050439_20251013000001_implement_dynamic_global_cycles_view.sql
20251013053632_add_snapshot_columns_to_user_global_timelines.sql
```

**Note:** Only archive if you're certain the new migration covers all functionality.

### Verify Application Code

Check that your application code calls:
- `fn_activate_user_global_timeline(cycle_id, week_start_day)` → Returns UUID
- Does NOT call `generate_adjusted_global_weeks` directly
- Does NOT expect `jsonb` return types

## Success Criteria Checklist

- [x] `generate_adjusted_global_weeks` function removed
- [x] `generate_canonical_global_weeks` returns `void`
- [x] `fn_activate_user_global_timeline` returns `uuid`
- [x] Correct column names used (`week_start`/`week_end`)
- [x] Uses actual cycle dates (not `current_date`)
- [x] Validates `can_activate` when view exists
- [x] Populates snapshot columns when they exist
- [x] Reads user preference when column exists
- [x] No hardcoded test user IDs
- [x] Proper authentication required
- [x] Idempotent operations (safe to re-run)

## Next Steps

1. **Test the Migration**
   - Run in development/staging first
   - Verify all functions work as expected
   - Test timeline activation from the application

2. **Monitor Production**
   - Watch for any errors after deployment
   - Verify week generation works correctly
   - Check that user preferences are saved

3. **Clean Up Application Code**
   - Remove any references to `generate_adjusted_global_weeks`
   - Ensure proper error handling for activation failures
   - Update any documentation

## Contact

For questions or issues with this migration:
- Review the inline comments in the migration file
- Check function comments: `\df+ function_name` in psql
- Test in development environment first

---

**Migration Author:** Africa Thryves Development Team  
**Date:** October 13, 2025  
**Status:** Ready for Testing
