# Timeline Activation Failure - Debug Steps

## Symptom
Clicked "Activate" button, appeared to save, but:
- No row created in `0008-ap-user-global-timelines`
- Timeline did not move to Active Timelines section
- No timeline visible on Goal Bank landing page

## Step 1: Check Browser Console Logs

The ManageGlobalTimelinesModal has extensive logging. Open browser console (F12) and look for:

```
[ManageGlobalTimelinesModal] Starting timeline activation
[ManageGlobalTimelinesModal] Cycle ID: <uuid>
[ManageGlobalTimelinesModal] Week start day: sunday/monday
[ManageGlobalTimelinesModal] Current user ID: <uuid>
[ManageGlobalTimelinesModal] Calling fn_activate_user_global_timeline...
[ManageGlobalTimelinesModal] RPC Response: { data, error }
```

**What to look for:**
- Is there an error object in the RPC Response?
- Does it say "Success" or show an error?
- Is the user ID present?

## Step 2: Run Database Tests

Copy and run this in Supabase SQL Editor:

```sql
-- Test 1: Check function exists and returns UUID
SELECT 
  p.proname,
  pg_get_function_result(p.oid) as return_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname = 'fn_activate_user_global_timeline';
-- Expected: return_type should be 'uuid'

-- Test 2: Check available cycles
SELECT 
  global_cycle_id,
  title,
  can_activate
FROM v_global_cycles
WHERE can_activate = true;
-- Expected: Should show at least one cycle with can_activate = true

-- Test 3: Check current user
SELECT auth.uid() as my_user_id;
-- Expected: Should return your user UUID

-- Test 4: Try manual activation (REPLACE cycle_id)
SELECT fn_activate_user_global_timeline(
  'YOUR_CYCLE_ID_FROM_STEP_2'::uuid,
  'sunday'
);
-- Expected: Should return a UUID (new timeline ID)
-- If error, note the exact error message
```

## Step 3: Check RLS Policies

```sql
-- Check if RLS is blocking inserts
SELECT 
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename = '0008-ap-user-global-timelines';

-- Test manual insert to verify permissions
INSERT INTO "0008-ap-user-global-timelines" (
  user_id,
  global_cycle_id,
  status,
  week_start_day
) VALUES (
  auth.uid(),
  'YOUR_CYCLE_ID'::uuid,
  'active',
  'sunday'
);
-- If this fails, RLS policy is blocking you
```

## Common Issues & Solutions

### Issue 1: "This global cycle is already activated"
**Cause:** You already have an active timeline for this cycle
**Solution:** Check existing active timelines first
```sql
SELECT * FROM "0008-ap-user-global-timelines" 
WHERE user_id = auth.uid() AND status = 'active';
```

### Issue 2: "Global cycle not found or not active"
**Cause:** The cycle doesn't exist or isn't marked as active
**Solution:** Verify cycle exists and has correct status
```sql
SELECT id, title, status 
FROM "0008-ap-global-cycles" 
WHERE id = 'YOUR_CYCLE_ID';
```

### Issue 3: "This global cycle cannot be activated yet"
**Cause:** can_activate is false (wrong cycle position or not in reflection window)
**Solution:** Check cycle position
```sql
SELECT 
  title,
  cycle_position,
  can_activate,
  reflection_start,
  reflection_end
FROM v_global_cycles
WHERE global_cycle_id = 'YOUR_CYCLE_ID';
```

### Issue 4: "User not authenticated"
**Cause:** auth.uid() returns NULL
**Solution:** 
- Verify you're logged in
- Check if session expired
- Try logging out and back in

### Issue 5: Function succeeds but no row appears
**Cause:** RLS policy blocking SELECT
**Solution:** Check SELECT policy
```sql
-- This should work for the row you just created
SELECT * FROM "0008-ap-user-global-timelines"
WHERE user_id = auth.uid()
ORDER BY created_at DESC
LIMIT 1;
```

## Step 4: Check Week Generation

If timeline was created but weeks weren't generated:

```sql
-- Check if weeks exist for your cycle
SELECT 
  week_number,
  week_start,
  week_end
FROM "0008-ap-global-weeks"
WHERE global_cycle_id = 'YOUR_CYCLE_ID'
ORDER BY week_number;
-- Expected: Should show 12 weeks

-- If no weeks, manually trigger generation
SELECT generate_canonical_global_weeks('YOUR_CYCLE_ID'::uuid);
```

## Step 5: Check Application State

After activation, the code calls:
1. `fetchData()` - refreshes both active timelines and available cycles
2. `onUpdate?.()` - triggers parent component refresh

Check if:
- Modal closes after activation
- Data refresh happens
- Active timelines section updates

## Step 6: Network Tab

Check browser Network tab:
1. Look for RPC call to `fn_activate_user_global_timeline`
2. Check the response status (200 = success)
3. Check response body for data or error
4. Verify subsequent queries for refreshed data

## Quick Fix Attempts

### Fix 1: Force Refresh
Close and reopen the ManageGlobalTimelinesModal

### Fix 2: Clear Cache
1. Log out
2. Clear browser cache
3. Log back in
4. Try activation again

### Fix 3: Direct Database Activation
```sql
-- Manually create the timeline (REPLACE VALUES)
INSERT INTO "0008-ap-user-global-timelines" (
  user_id,
  global_cycle_id,
  status,
  week_start_day,
  activated_at
) VALUES (
  auth.uid(),
  'YOUR_CYCLE_ID'::uuid,
  'active',
  'sunday',
  now()
) RETURNING *;

-- Then generate weeks
SELECT generate_canonical_global_weeks('YOUR_CYCLE_ID'::uuid);

-- Refresh app
```

## Report Back

When reporting the issue, please provide:
1. Browser console logs (especially the RPC Response)
2. Results from Step 2 database tests
3. Any error messages from SQL Editor
4. Your user role (authenticated user vs service_role)

This will help diagnose whether it's:
- A function error
- An RLS policy issue
- A client-side state management issue
- A permission problem

---
**Status:** Debugging Guide
**Next:** Run these steps and report findings
