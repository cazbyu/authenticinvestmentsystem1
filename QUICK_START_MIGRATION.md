# Quick Start: Apply the Migration Fix

## Overview
This guide helps you apply the corrected migration `20251013160000_corrected_canonical_functions.sql` to fix the database function conflicts.

## Prerequisites
- Supabase project access
- Database backup (recommended)
- SQL Editor access in Supabase Dashboard

## Option 1: Via Supabase Dashboard (Recommended)

### Step 1: Backup (Optional but Recommended)
```
1. Go to Supabase Dashboard
2. Navigate to Database > Backups
3. Create a manual backup before proceeding
```

### Step 2: Run the Migration
```
1. Go to Supabase Dashboard
2. Navigate to SQL Editor
3. Open: supabase/migrations/20251013160000_corrected_canonical_functions.sql
4. Copy the entire content
5. Paste into SQL Editor
6. Click "Run" or press Cmd/Ctrl + Enter
```

### Step 3: Review Output
Check the notices/logs for:
- ✓ "Generated 12 canonical weeks" messages
- ✓ "Functions created: 2"
- ✓ "Duplicate weeks: 0"
- ✓ SUCCESS notices in regeneration

### Step 4: Run Tests
```
1. Still in SQL Editor
2. Open: supabase/migrations/TEST_20251013160000_migration.sql
3. Copy and paste content
4. Run the test script
5. Verify all tests show "PASS"
```

## Option 2: Via Supabase CLI

### Step 1: Ensure CLI is installed
```bash
npm install -g supabase
supabase --version
```

### Step 2: Link to your project
```bash
supabase link --project-ref YOUR_PROJECT_REF
```

### Step 3: Apply migration
```bash
supabase db push
```

### Step 4: Run tests manually
```bash
supabase db execute --file supabase/migrations/TEST_20251013160000_migration.sql
```

## Option 3: Direct psql Connection

### If you have direct database access:
```bash
# Connect to database
psql "postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres"

# Run migration
\i supabase/migrations/20251013160000_corrected_canonical_functions.sql

# Run tests
\i supabase/migrations/TEST_20251013160000_migration.sql

# Exit
\q
```

## Verification Checklist

After running the migration, verify:

- [ ] No error messages in output
- [ ] Function `generate_canonical_global_weeks` exists
- [ ] Function `fn_activate_user_global_timeline` exists
- [ ] Function `generate_adjusted_global_weeks` does NOT exist
- [ ] All global cycles have 12 weeks each
- [ ] No duplicate week records
- [ ] Test script shows all "PASS" results

## Quick Test from Application

Try activating a timeline from your application:

```javascript
// Example using Supabase client
const { data, error } = await supabase
  .rpc('fn_activate_user_global_timeline', {
    p_global_cycle_id: 'YOUR_CYCLE_ID',
    p_week_start_day: 'monday'
  });

if (error) {
  console.error('Activation failed:', error);
} else {
  console.log('Timeline activated:', data);
}
```

Expected result: Should return a UUID (timeline ID), not an error.

## Troubleshooting

### Error: "Function does not exist"
- Ensure migration ran successfully
- Check function names match exactly
- Verify schema is 'public'

### Error: "Permission denied"
- Run as database owner/admin
- Check RLS policies
- Verify GRANT statements executed

### Error: "Column does not exist"
- This is OK - the function adapts to your schema
- Check which columns exist in your tables
- Migration works with or without optional columns

### Weeks not generating correctly
- Check that global_cycles have start_date and end_date
- Verify dates are not NULL
- Run regeneration manually:
```sql
SELECT generate_canonical_global_weeks('CYCLE_ID'::uuid);
```

## Rollback (If Needed)

If something goes wrong:

```sql
-- Restore from backup OR

-- Drop the new functions
DROP FUNCTION IF EXISTS generate_canonical_global_weeks(uuid);
DROP FUNCTION IF EXISTS fn_activate_user_global_timeline(uuid, text);

-- Then restore from your backup
-- Or re-run previous migration files
```

## Next Steps After Success

1. **Update Application Code** (if needed)
   - Remove any direct calls to `generate_adjusted_global_weeks`
   - Ensure activation expects UUID return type
   - Update error handling

2. **Monitor Production**
   - Watch for any timeline activation errors
   - Check week generation logs
   - Verify user preferences are saved

3. **Clean Up (Optional)**
   - Archive conflicting migration files
   - Update documentation
   - Remove temporary test files

## Support

- **Migration Issues:** Check MIGRATION_FIX_SUMMARY.md
- **Function Details:** See inline comments in migration file
- **Schema Questions:** Review test script output

---

**Status:** Ready to apply  
**Estimated Time:** 2-5 minutes  
**Risk Level:** Low (idempotent, includes verification)
