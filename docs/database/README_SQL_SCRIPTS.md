# SQL Scripts Quick Reference

## What Happened So Far

1. ✅ You ran **FIX_SUPABASE_VIEWS.sql** - Fixed view column naming conflicts
2. ❌ Timeline activation still doesn't work - No errors but no rows created

## Next Steps (In Order)

### 1. DIAGNOSE_DATABASE.sql
**Purpose**: Find out what's wrong
**What it does**: Shows current state of all tables, functions, and policies
**Action**: Run this and SHARE THE COMPLETE OUTPUT with me

```
Copy → Paste into Supabase SQL Editor → Run → Copy output → Share with me
```

### 2. FIX_ACTIVATION_COMPLETE.sql
**Purpose**: Fix activation system issues
**What it does**: 
- Adds missing columns if needed
- Fixes status column confusion
- Recreates activation function with logging
- Shows verification results

**When to run**: After I review your diagnostic output, OR run it now if you want

```
Copy → Paste into Supabase SQL Editor → Run → Check NOTICE messages
```

### 3. TEST_ACTIVATION.sql
**Purpose**: Manually test if activation works
**What it does**:
- Shows your user ID
- Lists available cycles
- Lets you manually activate a timeline
- Shows if it worked

**When to run**: After FIX_ACTIVATION_COMPLETE.sql

```
Copy → Paste → Edit the cycle ID → Run → See results
```

## File Summary

| File | Purpose | When to Use |
|------|---------|-------------|
| FIX_SUPABASE_VIEWS.sql | Fix view column names | ✅ Already done |
| DIAGNOSE_DATABASE.sql | See what's wrong | ⚡ Do this NOW |
| FIX_ACTIVATION_COMPLETE.sql | Fix activation issues | After diagnosis |
| TEST_ACTIVATION.sql | Test manually | After fix |
| SUPABASE_FIX_GUIDE.md | Original guide | Reference |
| TROUBLESHOOTING_STEPS.md | Detailed troubleshooting | Reference |

## Most Likely Issues

Based on your symptoms:

1. **Missing `activated_at` column** - Function tries to insert but column doesn't exist
2. **status vs is_active** - Function checks `status='active'` but only `is_active` exists
3. **RLS policy blocking** - Policy prevents insert even though no error shows
4. **Function doesn't return properly** - SECURITY DEFINER issue with RLS

## What I Need From You

Please run **DIAGNOSE_DATABASE.sql** and paste the ENTIRE output here.

That will show me exactly what's wrong and I can create a targeted fix.

## Quick Commands

```sql
-- See if cycles exist
SELECT * FROM "0008-ap-global-cycles";

-- See if function exists
\df fn_activate_user_global_timeline

-- See your user ID
SELECT auth.uid();

-- See if weeks exist
SELECT COUNT(*) FROM "0008-ap-global-weeks";
```

## Emergency: If Nothing Works

Run these in order:

```sql
-- 1. Check you're logged in
SELECT auth.uid(), auth.role();

-- 2. Check cycles exist
SELECT * FROM "0008-ap-global-cycles" LIMIT 1;

-- 3. Try direct insert (bypasses function)
INSERT INTO "0008-ap-user-global-timelines" (
  user_id, global_cycle_id, status, week_start_day
) VALUES (
  auth.uid(),
  (SELECT id FROM "0008-ap-global-cycles" WHERE is_active = true LIMIT 1),
  'active',
  'monday'
);

-- 4. Check if it worked
SELECT * FROM "0008-ap-user-global-timelines" WHERE user_id = auth.uid();
```

If direct insert fails, the error message will tell us exactly what's wrong (missing column, RLS policy, etc).
