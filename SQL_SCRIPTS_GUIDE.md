# SQL Scripts - Quick Copy & Paste Guide

## Available Scripts

I've created **2 ready-to-use SQL scripts** that you can copy and paste directly into your Supabase SQL Editor.

### 1. CALENDAR_FIX_WITH_PAST_DATES.sql

**Purpose:** Fix the calendar so tasks/events show up when navigating to past dates

**What it does:**
- Updates the `fn_expand_recurrence_dates` function to support past dates (90 days back)
- Updates the `v_tasks_with_recurrence_expanded` view to remove date restrictions
- Enables calendar history viewing

**When to use:**
- Your calendar doesn't show tasks when you navigate to yesterday or last week
- You want to see your task history in the calendar

**How to use:**
1. Open Supabase Dashboard → SQL Editor
2. Copy the **entire contents** of `CALENDAR_FIX_WITH_PAST_DATES.sql`
3. Paste into SQL Editor
4. Click "Run"
5. Check for success messages in the output

**Expected result:**
```
✓ Function fn_expand_recurrence_dates updated
✓ View v_tasks_with_recurrence_expanded updated
✓ Permissions granted
```

After running this script, your calendar will display:
- **Past dates:** 90 days back from today
- **Future dates:** 365 days forward from today
- **Total window:** ~455 days of task/event data

---

### 2. DATABASE_VERIFICATION_TESTS.sql

**Purpose:** Comprehensive diagnostics to verify your database setup and find issues

**What it does:**
- Checks if you're authenticated
- Lists all tables, functions, and views
- Verifies data exists (wellness domains, global cycles, etc.)
- Tests timeline activation
- Checks week generation
- Tests calendar views
- Validates RLS policies
- Tests recurrence expansion

**When to use:**
- You want to check if your database is set up correctly
- Something isn't working and you need to diagnose the issue
- You want to verify data exists before using the app

**How to use:**
1. Open Supabase Dashboard → SQL Editor
2. You can copy **specific sections** or the entire file
3. Paste into SQL Editor
4. Click "Run"
5. Review the results - look for ✓, ⚠, or ✗ symbols

**Sections you can run individually:**

| Section | Purpose | When to Use |
|---------|---------|-------------|
| 1. Authentication Check | Verify you're logged in | Always run first |
| 2. Table Existence | Check all tables exist | Initial setup verification |
| 3. Functions Check | Verify database functions | After running migrations |
| 4. Views Check | Verify database views | After running migrations |
| 5. Data Existence | Check wellness domains and cycles | Before using the app |
| 6. User Data Check | See your profile, roles, tasks | Check your personal data |
| 7. Timeline Activation | Verify timeline system works | If activation fails |
| 8. Week Generation | Check weeks were created | If timeline has no weeks |
| 9. Calendar View | Test calendar data | If calendar is empty |
| 10. RLS Policy Check | Verify security policies | Security verification |
| 11. Storage Buckets | Check image storage setup | Before uploading images |
| 12. Test Recurrence | Test recurring task expansion | If recurring tasks don't show |
| 13. Emergency Diagnostic | Full diagnostic with debug output | When something is broken |

---

## Quick Start: What to Run First

### Step 1: Verify Your Database
```sql
-- Copy and run Section 1 from DATABASE_VERIFICATION_TESTS.sql
-- This checks if you're authenticated
```

### Step 2: Check Tables and Functions Exist
```sql
-- Copy and run Sections 2, 3, and 4 from DATABASE_VERIFICATION_TESTS.sql
-- This verifies your database structure is correct
```

### Step 3: Fix Calendar History (if needed)
```
-- Copy and run the entire CALENDAR_FIX_WITH_PAST_DATES.sql
-- Only needed if calendar doesn't show past dates
```

### Step 4: Verify Everything Works
```sql
-- Copy and run Section 13 from DATABASE_VERIFICATION_TESTS.sql
-- This runs a comprehensive diagnostic
```

---

## Common Issues and Solutions

### Issue: "User not authenticated"
**Solution:** Make sure you're logged in to Supabase. The SQL Editor should show your user email in the top right.

### Issue: "Table does not exist"
**Solution:**
1. Check if you've run all migrations in the `supabase/migrations/` folder
2. Run Section 2 of `DATABASE_VERIFICATION_TESTS.sql` to see which tables are missing
3. Contact support with the list of missing tables

### Issue: "Function does not exist"
**Solution:**
1. Run Section 3 of `DATABASE_VERIFICATION_TESTS.sql` to see which functions are missing
2. The most important functions are:
   - `fn_expand_recurrence_dates`
   - `generate_canonical_global_weeks`
   - `fn_activate_user_global_timeline`
3. Re-run the migrations that create these functions

### Issue: "No wellness domains"
**Solution:**
Run this quick fix:
```sql
INSERT INTO "0008-ap-domains" (name, description, sort_order)
VALUES
  ('Community', 'Building relationships and connections', 1),
  ('Financial', 'Managing money and finances', 2),
  ('Physical', 'Health, fitness, and physical well-being', 3),
  ('Social', 'Social interactions and relationships', 4),
  ('Emotional', 'Emotional health and self-awareness', 5),
  ('Intellectual', 'Learning and intellectual growth', 6),
  ('Recreational', 'Hobbies, leisure, and fun', 7),
  ('Spiritual', 'Purpose, meaning, and spiritual practices', 8)
ON CONFLICT DO NOTHING;
```

### Issue: "Timeline activation fails"
**Solution:**
1. Run Section 13 (Emergency Diagnostic) from `DATABASE_VERIFICATION_TESTS.sql`
2. Check the output for specific error messages
3. Common causes:
   - No active global cycles exist
   - Weeks not generated for the cycle
   - Already activated this cycle
   - RLS policy blocking the insert

### Issue: "Calendar shows no tasks"
**Solution:**
1. First check if you have any tasks: Run Section 6 from `DATABASE_VERIFICATION_TESTS.sql`
2. If you have tasks but they don't show: Run Section 9 (Calendar View Check)
3. If calendar doesn't show past dates: Run `CALENDAR_FIX_WITH_PAST_DATES.sql`

---

## Understanding the Output

### Success Indicators
- `✓` Green checkmark = Everything is working
- `○` Circle = Optional or not set up yet (this is OK)

### Warning Indicators
- `⚠` Warning triangle = Something might be wrong, check details

### Error Indicators
- `✗` Red X = Something is broken, needs fixing

---

## Need More Help?

If you encounter issues not covered here:

1. **Run the Emergency Diagnostic:**
   ```sql
   -- Copy Section 13 from DATABASE_VERIFICATION_TESTS.sql
   ```
   This will give you detailed debug output

2. **Check the NOTICE messages:**
   After running a script, look at the "Messages" tab in Supabase SQL Editor for detailed logs

3. **Gather information:**
   - What were you trying to do?
   - What error message did you get?
   - What do the verification tests show?

---

## File Locations

All SQL scripts are in the project root:

```
project/
├── CALENDAR_FIX_WITH_PAST_DATES.sql    ← Calendar history fix
├── DATABASE_VERIFICATION_TESTS.sql      ← Diagnostics & testing
└── SQL_SCRIPTS_GUIDE.md                 ← This guide
```

---

## Pro Tips

1. **Always run Section 1 first** - Check authentication before anything else
2. **Run diagnostics before fixes** - Understand the problem before applying solutions
3. **Copy specific sections** - You don't need to run everything at once
4. **Read the NOTICE messages** - They contain helpful debug information
5. **Bookmark this guide** - You'll reference it often

---

## Quick Command Reference

```sql
-- See your user ID
SELECT auth.uid();

-- Check if you have any tasks
SELECT COUNT(*) FROM "0008-ap-tasks" WHERE user_id = auth.uid();

-- See all global cycles
SELECT * FROM "0008-ap-global-cycles" ORDER BY start_date;

-- Check if weeks exist for a cycle
SELECT COUNT(*) FROM "0008-ap-global-weeks" WHERE global_cycle_id = 'CYCLE_ID_HERE';

-- See your activated timelines
SELECT * FROM "0008-ap-user-global-timelines" WHERE user_id = auth.uid();

-- Force regenerate weeks for a cycle
SELECT generate_canonical_global_weeks('CYCLE_ID_HERE');
```

---

**Last Updated:** October 2025
**Version:** 1.0
