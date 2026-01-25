# January 2026 Migration Cleanup

**Date:** January 25, 2026
**Issue:** Duplicate migration files from October 5, 2025 consolidation effort

## Summary

Successfully archived 7 duplicate migration files and moved 1 test script, reducing migration count from 149 to 141 active files.

## Changes Made

### Archived Duplicate Migrations (7 files)

Created `/supabase/migrations/_archived/oct_5_consolidation/` directory containing:

1. `20251005173501_20250820000000_create_core_tables.sql`
2. `20251005173530_20250828041242_create_global_cycles_and_goals.sql`
3. `20251005173550_20250901045358_create_user_cycles_system.sql`
4. `20251005173602_20250906222403_create_custom_goals.sql`
5. `20251005173615_20250908233519_create_custom_timelines.sql`
6. `20251005173627_20250913172039_create_user_global_timelines.sql`
7. `20251005173641_20250820143036_create_deposit_ideas.sql`

**Reason:** These were consolidation attempts that duplicated existing migrations from August-September 2025. The original migrations remain active as the source of truth.

### Moved Test File (1 file)

Moved to `/z tests/` directory:

- `TEST_20251013160000_migration.sql` - Verification script for canonical functions

**Reason:** This was a test/verification script, not an actual database migration. Test scripts belong in the test directory, not migrations.

## Active Original Migrations Preserved

These migrations remain active and are the source of truth:

- `20250820143036_pale_wood.sql` - Deposit Ideas table
- `20250828041242_super_credit.sql` - Global Cycles & 12-Week Goals
- `20250901045358_mellow_cave.sql` - User Cycles System
- `20250906222403_divine_queen.sql` - Custom Goals
- `20250908233519_calm_hall.sql` - Custom Timelines
- `20250913172039_jade_reef.sql` - User Global Timelines

## Impact

**Before Cleanup:**
- Total files: 149 migrations
- Duplicates: 7
- Test files in migrations: 1

**After Cleanup:**
- Active migrations: 141
- Archived duplicates: 7
- Test files properly located: 1

**Database Impact:** None - the archived migrations had already been applied and the original migrations create the same schema.

## Verification

To verify the schema is correct, check these tables exist in Supabase:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE '0008-ap-%'
ORDER BY table_name;
```

Expected tables:
- `0008-ap-custom-timelines`
- `0008-ap-deposit-ideas`
- `0008-ap-global-cycles`
- `0008-ap-goals-12wk`
- `0008-ap-goals-custom`
- `0008-ap-user-global-timelines`
- And many more...

## Archive Structure

```
supabase/migrations/
├── _archived/
│   ├── conflicting_functions/ (from Oct 2025)
│   ├── monthly_history_functions/ (from Dec 2025)
│   └── oct_5_consolidation/ (NEW - from Jan 2026)
│       ├── README.md
│       └── 7 duplicate migration files
└── 141 active migration files

z tests/
└── TEST_20251013160000_migration.sql (moved from migrations)
```

## Why Archive Instead of Delete?

Following the established project pattern:

1. **Supabase Tracking** - These migrations were already applied
2. **History Preservation** - Shows migration evolution
3. **Reference Material** - Available for troubleshooting
4. **Safety** - Can be reviewed if needed

## Future Migration Management

Best practices going forward:

1. **Check for existing migrations** before creating new ones
2. **Use descriptive names** that clearly indicate purpose
3. **Test migrations** in development before production
4. **Document consolidation** efforts in separate tracking docs
5. **Archive, don't delete** when cleaning up duplicates

## Related Documentation

- `/docs/migrations/MIGRATION_CLEANUP_SUMMARY.md` - October 2025 cleanup
- `/MIGRATION_CONSOLIDATION_SUMMARY.md` - December 2025 cleanup
- `/supabase/migrations/_archived/oct_5_consolidation/README.md` - Archive details

---

**Status:** ✓ Cleanup Complete
**Database State:** Stable - No changes required
**Migration Count:** 141 active migrations
**Action Required:** None
