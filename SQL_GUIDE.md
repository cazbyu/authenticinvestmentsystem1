# SQL Scripts Guide - Copy & Paste Reference

## Quick Start

**New to the SQL scripts?** Start here:

1. **Verify your database:** Run Section 1 of `sql/database-updates/DATABASE_VERIFICATION_TESTS.sql`
2. **Check setup:** Run Sections 2-5 of verification tests
3. **Fix issues:** Use appropriate scripts from the sections below

All scripts are **safe to run multiple times** and **won't delete your data**.

---

## Available SQL Scripts

### Database Updates (`sql/database-updates/`)

#### CALENDAR_FIX_WITH_PAST_DATES.sql

**Purpose:** Enable calendar to show tasks/events from past dates

**What it fixes:**
- Calendar doesn't show tasks when you navigate to yesterday
- Calendar doesn't show tasks from last week
- Can't see historical task data

**What it does:**
- Adds support for viewing past 90 days in calendar
- Updates the `fn_expand_recurrence_dates` function
- Updates the `v_tasks_with_recurrence_expanded` view
- Removes date restrictions blocking past dates

**When to use:**
- Your calendar doesn't show tasks when you navigate to past dates
- You want to see your task history in the calendar

**How to use:**
1. Open Supabase Dashboard → SQL Editor → New Query
2. Open file: `sql/database-updates/CALENDAR_FIX_WITH_PAST_DATES.sql`
3. Copy the entire contents (Ctrl+A or Cmd+A, then Ctrl+C or Cmd+C)
4. Paste into SQL Editor (Ctrl+V or Cmd+V)
5. Click "Run"
6. Check for success messages in the output

**Expected result:**
```
✓ Function fn_expand_recurrence_dates updated
✓ View v_tasks_with_recurrence_expanded updated
✓ Permissions granted
```

After running, your calendar will display:
- **Past dates:** 90 days back from today
- **Future dates:** 365 days forward from today
- **Total window:** ~455 days of task/event data

**Size:** ~400 lines of SQL
**Safe to run:** Yes, idempotent (safe to run multiple times)

---

#### DATABASE_VERIFICATION_TESTS.sql

**Purpose:** Comprehensive diagnostics to verify database setup and find issues

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
- Troubleshooting any database-related problems

**How to use:**

You can copy **specific sections** or the **entire file**:

1. Open Supabase Dashboard → SQL Editor → New Query
2. Open file: `sql/database-updates/DATABASE_VERIFICATION_TESTS.sql`
3. Copy the section(s) you need or the entire file
4. Paste into SQL Editor
5. Click "Run"
6. Review the results - look for ✓, ⚠, or ✗ symbols

**Sections you can run individually:**

| Section | Purpose | When to Use |
|---------|---------|-------------|
| 1. Authentication Check | Verify you're logged in | **Always run first** |
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
| 13. Emergency Diagnostic | Full diagnostic with debug output | **When something is broken** |

**Size:** ~550 lines of SQL (13 sections)
**Safe to run:** Yes, read-only (no modifications to data)

---

### Fix Scripts (`sql/fixes/`)

#### fix_notes_join_schema.sql
**Purpose:** Fix schema issues in the notes join table
**When to use:** If notes aren't properly linking to tasks, reflections, or other entities

#### FIX_SUPABASE_VIEWS.sql
**Purpose:** Fix view column naming conflicts
**When to use:** If you get errors about column name conflicts in database views

#### FIX_P_MAX_OCCURRENCES_ERROR.sql
**Purpose:** Fix the max occurrences parameter error in recurrence functions
**When to use:** If recurring tasks fail to expand or show parameter errors

---

### Diagnostic Scripts (`sql/checks/`)

#### CHECK_RLS_POLICIES.sql
**Purpose:** Verify Row Level Security policies are correctly configured
**When to use:** Security verification or if users can't access their own data

#### DEBUG_ACTIVATION_TEST.sql
**Purpose:** Debug timeline activation issues
**When to use:** If timeline activation is failing

---

### Troubleshooting Toolkit (`z tests/`)

#### DIAGNOSE_ACTIVATION_FAILURE.sql
**Purpose:** Identify why timeline activation fails silently
**Run each section in order** and review output to find the failure point

#### DIAGNOSE_DATABASE.sql
**Purpose:** General database diagnostics
**When to use:** Initial investigation of any database issue

#### FINAL_FIX.sql
**Purpose:** Comprehensive fix for timeline activation
**What it does:**
- Adds `status` column to `global_cycles` if missing
- Sets status='active' for all active cycles
- Recreates activation function with correct logic
- Generates canonical weeks for all cycles
- Shows verification report

#### TEST_ACTIVATION.sql
**Purpose:** Test timeline activation functionality
**When to use:** After applying activation fixes to verify they work

#### FIX_ACTIVATION_COMPLETE.sql
**Purpose:** Complete activation fix with full diagnostic output
**When to use:** If FINAL_FIX.sql didn't resolve the issue

---

## Step-by-Step Workflow

### Step 1: Verify Your Database
```
1. Open Supabase Dashboard → SQL Editor
2. Copy Section 1 from sql/database-updates/DATABASE_VERIFICATION_TESTS.sql
3. Paste and run
4. Verify you see your user ID
```

### Step 2: Check Tables and Functions Exist
```
1. Copy Sections 2, 3, and 4 from DATABASE_VERIFICATION_TESTS.sql
2. Paste and run
3. Look for any missing tables or functions
```

### Step 3: Fix Calendar History (if needed)
```
1. Only run if calendar doesn't show past dates
2. Copy entire sql/database-updates/CALENDAR_FIX_WITH_PAST_DATES.sql
3. Paste and run
4. Verify success messages
```

### Step 4: Run Full Diagnostic
```
1. Copy Section 13 from DATABASE_VERIFICATION_TESTS.sql
2. Paste and run
3. Review comprehensive diagnostic output
```

---

## Common Issues and Solutions

### Issue: "User not authenticated"
**Solution:** Make sure you're logged in to Supabase. The SQL Editor should show your user email in the top right.

### Issue: "Table does not exist"
**Solution:**
1. Check if you've run all migrations in `supabase/migrations/`
2. Run Section 2 of `DATABASE_VERIFICATION_TESTS.sql` to see which tables are missing
3. Re-run migrations or contact support with the list of missing tables

### Issue: "Function does not exist"
**Solution:**
1. Run Section 3 of `DATABASE_VERIFICATION_TESTS.sql` to see which functions are missing
2. The most important functions are:
   - `fn_expand_recurrence_dates`
   - `generate_canonical_global_weeks`
   - `fn_activate_user_global_timeline`
3. Re-run the migrations that create these functions

### Issue: "No wellness domains"
**Solution:** Run this quick fix:
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
4. If diagnostics don't help, run `z tests/FINAL_FIX.sql`

### Issue: "Calendar shows no tasks"
**Solution:**
1. First check if you have any tasks: Run Section 6 from `DATABASE_VERIFICATION_TESTS.sql`
2. If you have tasks but they don't show: Run Section 9 (Calendar View Check)
3. If calendar doesn't show past dates: Run `sql/database-updates/CALENDAR_FIX_WITH_PAST_DATES.sql`

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

-- Check migration status
SELECT * FROM supabase_migrations.schema_migrations
ORDER BY version DESC LIMIT 20;
```

---

## Pro Tips

1. **Always run Section 1 first** - Check authentication before anything else
2. **Run diagnostics before fixes** - Understand the problem before applying solutions
3. **Copy specific sections** - You don't need to run everything at once
4. **Read the NOTICE messages** - They contain helpful debug information
5. **Bookmark this guide** - You'll reference it often
6. **All scripts are idempotent** - Safe to run multiple times
7. **Verification tests are read-only** - They won't modify your data

---

## Need More Help?

If you encounter issues not covered here:

1. **Run the Emergency Diagnostic:**
   ```
   Copy Section 13 from sql/database-updates/DATABASE_VERIFICATION_TESTS.sql
   ```
   This will give you detailed debug output

2. **Check the NOTICE messages:**
   After running a script, look at the "Messages" tab in Supabase SQL Editor for detailed logs

3. **Gather information:**
   - What were you trying to do?
   - What error message did you get?
   - What do the verification tests show?

4. **Check the troubleshooting docs:**
   - See [TROUBLESHOOTING_STEPS.md](TROUBLESHOOTING_STEPS.md) for general troubleshooting
   - See [START_HERE.md](START_HERE.md) for timeline activation quick fix
   - See [DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md) for all documentation

---

## File Organization

```
sql/
├── fixes/                          # One-time fix scripts
│   ├── fix_notes_join_schema.sql
│   ├── FIX_SUPABASE_VIEWS.sql
│   └── FIX_P_MAX_OCCURRENCES_ERROR.sql
├── database-updates/               # Schema updates
│   ├── CALENDAR_FIX_WITH_PAST_DATES.sql
│   └── DATABASE_VERIFICATION_TESTS.sql
└── checks/                         # Diagnostic queries
    ├── CHECK_RLS_POLICIES.sql
    └── DEBUG_ACTIVATION_TEST.sql

z tests/                            # Troubleshooting toolkit
├── DIAGNOSE_ACTIVATION_FAILURE.sql
├── DIAGNOSE_DATABASE.sql
├── FINAL_FIX.sql
├── TEST_ACTIVATION.sql
└── ... (more diagnostic scripts)

supabase/migrations/                # Official migrations (90+ files)
└── ... (applied automatically)
```

---

**Last Updated:** November 2025
**Version:** 2.0 (Consolidated from SQL_SCRIPTS_GUIDE.md and COPY_PASTE_SQL_REFERENCE.md)
