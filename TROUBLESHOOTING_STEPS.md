# Timeline Activation Troubleshooting Guide

## Your Situation
- Timeline activation from UI shows no errors but creates no records
- Deactivation works (removes rows)
- Different user experiences same issue
- "Success. No rows received." message from Supabase

## Step-by-Step Troubleshooting

### Step 1: Run Diagnostic Script
1. Open Supabase SQL Editor
2. Copy and paste **DIAGNOSE_DATABASE.sql**
3. Click Run
4. **Copy all the output and share it with me**

This will show:
- Current global cycles
- Generated weeks
- Existing timelines
- Function status
- RLS policies

### Step 2: Run Complete Fix Script (if needed)
1. Open Supabase SQL Editor
2. Copy and paste **FIX_ACTIVATION_COMPLETE.sql**
3. Click Run
4. Look for NOTICE messages showing what was fixed

This script will:
- Ensure all columns exist (activated_at, status)
- Fix global_cycles status column issue
- Recreate activation function with enhanced logging
- Show final status

### Step 3: Test Activation Manually
1. Open Supabase SQL Editor
2. Copy and paste **TEST_ACTIVATION.sql**
3. Find your cycle ID from the output
4. Uncomment the activation line and replace `<YOUR_CYCLE_ID>` with actual ID
5. Run the script
6. Check if a timeline was created

### Step 4: Check for Console Logs
After running FIX_ACTIVATION_COMPLETE.sql, try activating from your app again.

Check browser console for logs from the frontend (lines 488-532 in ManageGlobalTimelinesModal.tsx).

The function now has RAISE NOTICE statements that will help us see where it's failing.

## Common Issues

### Issue 1: Missing `activated_at` column
**Symptom**: Function fails silently
**Fix**: FIX_ACTIVATION_COMPLETE.sql adds it

### Issue 2: status vs is_active confusion
**Symptom**: "Global cycle not found or not active" error
**Fix**: FIX_ACTIVATION_COMPLETE.sql adds status column based on is_active

### Issue 3: RLS Policy blocks insert
**Symptom**: No error but no row created
**Fix**: Check RLS policies in diagnostic output

### Issue 4: Function doesn't exist
**Symptom**: "function fn_activate_user_global_timeline does not exist"
**Fix**: FIX_ACTIVATION_COMPLETE.sql recreates it

## What I Need From You

Please run **DIAGNOSE_DATABASE.sql** and share the complete output. This will tell us:

1. Do you have any global cycles?
2. Are they marked as active?
3. Do weeks exist for them?
4. Does the activation function exist?
5. What RLS policies are active?
6. Are you properly authenticated?

## Files Created

1. **DIAGNOSE_DATABASE.sql** - Shows current state
2. **FIX_ACTIVATION_COMPLETE.sql** - Fixes common issues
3. **TEST_ACTIVATION.sql** - Manually test activation
4. **FIX_SUPABASE_VIEWS.sql** - Original view fix (already ran)
5. **SUPABASE_FIX_GUIDE.md** - Original guide

## Quick Test

Try this in SQL Editor after running FIX_ACTIVATION_COMPLETE.sql:

```sql
-- Check if cycles exist
SELECT id, title, is_active, status FROM "0008-ap-global-cycles";

-- Try to activate (replace UUID with real cycle ID)
SELECT fn_activate_user_global_timeline('your-cycle-id-here'::uuid, 'monday');

-- Check if it worked
SELECT * FROM "0008-ap-user-global-timelines" WHERE user_id = auth.uid();
```

## Need More Help?

Share the output from DIAGNOSE_DATABASE.sql and I'll pinpoint the exact issue.
