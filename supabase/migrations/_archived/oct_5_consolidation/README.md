# October 5, 2025 Consolidation - Archived Duplicates

**Date Archived:** January 25, 2026
**Reason:** These migrations were duplicates of earlier migrations from August-September 2025

## What Happened

On October 5, 2025, someone created consolidated versions of several core table migrations. However, the original migrations were still present and had already been applied to the database. This created duplicate migration files that could cause confusion.

## Archived Files

These 7 files were duplicates and have been archived:

| Archived File | Original Migration | Purpose |
|--------------|-------------------|---------|
| `20251005173501_20250820000000_create_core_tables.sql` | Unknown (possibly 20250820005157) | Core tables creation |
| `20251005173530_20250828041242_create_global_cycles_and_goals.sql` | `20250828041242_super_credit.sql` | Global cycles and 12-week goals |
| `20251005173550_20250901045358_create_user_cycles_system.sql` | `20250901045358_mellow_cave.sql` | User cycles system |
| `20251005173602_20250906222403_create_custom_goals.sql` | `20250906222403_divine_queen.sql` | Custom goals |
| `20251005173615_20250908233519_create_custom_timelines.sql` | `20250908233519_calm_hall.sql` | Custom timelines |
| `20251005173627_20250913172039_create_user_global_timelines.sql` | `20250913172039_jade_reef.sql` | User global timelines |
| `20251005173641_20250820143036_create_deposit_ideas.sql` | `20250820143036_pale_wood.sql` | Deposit ideas |

## Active Migrations

The original migrations from August-September 2025 remain active and are the source of truth:

- `20250820143036_pale_wood.sql` - Deposit Ideas
- `20250828041242_super_credit.sql` - Global Cycles & 12-Week Goals
- `20250901045358_mellow_cave.sql` - User Cycles System
- `20250906222403_divine_queen.sql` - Custom Goals
- `20250908233519_calm_hall.sql` - Custom Timelines
- `20250913172039_jade_reef.sql` - User Global Timelines

## Why Archive Instead of Delete?

1. **Supabase Tracking** - These migrations were already applied to the database
2. **History Preservation** - Documents the consolidation attempt
3. **Reference Material** - Available if needed for troubleshooting
4. **Safety** - Can be reviewed if questions arise about schema evolution

## Database Impact

No database changes were needed. The archived migrations were redundant - the original migrations had already created all necessary tables, columns, and constraints.

## Verification

To verify the active schema, check these tables exist:
- `0008-ap-global-cycles`
- `0008-ap-goals-12wk`
- `0008-ap-goals-custom`
- `0008-ap-custom-timelines`
- `0008-ap-deposit-ideas`
- `0008-ap-user-global-timelines`

All should have proper RLS policies and foreign key constraints as defined in the original migrations.

## Additional Files Cleaned Up

**Test File Moved:**
- `TEST_20251013160000_migration.sql` - Moved to `/z tests/` directory
  - This was a verification script, not an actual migration
  - Contains test queries to verify the corrected canonical functions

---

**Status:** ✓ Archive Complete
**Action Required:** None - original migrations remain active
**Files Archived:** 7 duplicate migrations
**Files Moved:** 1 test script
**Active Migrations:** 141
