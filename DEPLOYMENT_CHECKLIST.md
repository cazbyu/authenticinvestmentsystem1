# Deployment Checklist - Database Migration Fix

Use this checklist to ensure a smooth deployment of the migration fix.

## Pre-Deployment

- [ ] **Review migration file**
  - Read through `20251013160000_corrected_canonical_functions.sql`
  - Understand what changes will be made
  - Note the verification steps included

- [ ] **Backup database** (Strongly Recommended)
  - Via Supabase Dashboard: Database > Backups
  - Or use `pg_dump` if you have direct access
  - Store backup in safe location

- [ ] **Review documentation**
  - `README_MIGRATION_FIX.md` - Overview
  - `QUICK_START_MIGRATION.md` - Application steps
  - `MIGRATION_FIX_SUMMARY.md` - Technical details

- [ ] **Identify current state**
  - Which functions currently exist?
  - What errors are currently happening?
  - Document current behavior for comparison

## Deployment (Development/Staging First)

- [ ] **Access Supabase Dashboard**
  - Log into your project
  - Navigate to SQL Editor

- [ ] **Execute migration**
  - Copy content from `20251013160000_corrected_canonical_functions.sql`
  - Paste into SQL Editor
  - Click "Run"
  - Wait for completion

- [ ] **Review output**
  - Look for "SUCCESS" messages
  - Check function count = 2
  - Verify no duplicate weeks
  - Note any warnings

- [ ] **Run test suite**
  - Copy content from `TEST_20251013160000_migration.sql`
  - Paste into SQL Editor
  - Click "Run"
  - Verify all tests show "PASS"

## Post-Deployment Verification

- [ ] **Function verification**
  ```sql
  -- Run this to verify functions exist
  SELECT proname, pg_get_function_result(p.oid) as return_type
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public' 
    AND p.proname IN ('generate_canonical_global_weeks', 'fn_activate_user_global_timeline');
  ```
  - Should return 2 functions
  - `generate_canonical_global_weeks` returns `void`
  - `fn_activate_user_global_timeline` returns `uuid`

- [ ] **Week data verification**
  ```sql
  -- Check all cycles have 12 weeks
  SELECT 
    gc.title,
    COUNT(gw.id) as week_count
  FROM "0008-ap-global-cycles" gc
  LEFT JOIN "0008-ap-global-weeks" gw ON gc.id = gw.global_cycle_id
  GROUP BY gc.id, gc.title;
  ```
  - Each cycle should show 12 weeks
  - No cycles should show 0 weeks (if they have dates)

- [ ] **Test timeline activation**
  - From your application, try activating a timeline
  - Should complete without errors
  - Should return a timeline UUID
  - Weeks should display correctly

- [ ] **Check application logs**
  - No database function errors
  - No "function does not exist" errors
  - Timeline activation succeeds

## Production Deployment

- [ ] **Schedule maintenance window** (optional)
  - Brief downtime recommended but not required
  - Migration is fast (2-5 minutes)

- [ ] **Notify team**
  - Alert team of deployment
  - Share this checklist
  - Prepare rollback plan if needed

- [ ] **Execute in production**
  - Follow same steps as staging
  - Monitor logs closely
  - Be ready to rollback if issues occur

- [ ] **Monitor for 24-48 hours**
  - Watch error logs
  - Monitor timeline activations
  - Check user reports
  - Verify week generation

## Post-Deployment Cleanup (Optional)

- [ ] **Archive conflicting migrations**
  - Move old migration files to `_archived/`
  - Document which migrations were superseded
  - Keep for historical reference

- [ ] **Update application documentation**
  - Note the function signatures
  - Update any developer guides
  - Document the fix for future reference

- [ ] **Remove test files** (after verification)
  - `TEST_20251013160000_migration.sql` (keep if helpful)
  - Any temporary debugging files

## Rollback Procedure (If Needed)

If issues occur after deployment:

- [ ] **Stop using affected features**
  - Disable timeline activation in UI if possible
  - Prevent new activations temporarily

- [ ] **Restore from backup**
  - Use backup created in pre-deployment
  - Via Supabase Dashboard or `pg_restore`
  - Verify restoration successful

- [ ] **Or manual rollback:**
  ```sql
  DROP FUNCTION IF EXISTS generate_canonical_global_weeks(uuid);
  DROP FUNCTION IF EXISTS fn_activate_user_global_timeline(uuid, text);
  -- Then restore previous function versions
  ```

- [ ] **Investigate issue**
  - Review error logs
  - Check test results
  - Consult documentation
  - Adjust migration if needed

## Success Criteria

Mark as successful when:

- [ ] Migration executed without errors
- [ ] All tests pass
- [ ] 2 functions exist with correct signatures
- [ ] All cycles have 12 weeks
- [ ] No duplicate weeks
- [ ] Timeline activation works from application
- [ ] No errors in logs for 24 hours
- [ ] User workflows function normally

## Support Contacts

- **Technical Details:** See `MIGRATION_FIX_SUMMARY.md`
- **Application Guide:** See `QUICK_START_MIGRATION.md`
- **Migration Code:** Check inline comments in SQL file
- **Troubleshooting:** Section included in `QUICK_START_MIGRATION.md`

## Notes

_Use this space to document any issues, observations, or deviations from the checklist:_

```
Date: ________________
Deployed by: ________________
Environment: ________________

Notes:




```

---

**Document Version:** 1.0  
**Last Updated:** October 13, 2025  
**Status:** Ready for use
