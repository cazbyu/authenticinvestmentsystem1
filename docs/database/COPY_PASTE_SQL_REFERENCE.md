# Copy & Paste SQL Scripts - Quick Reference

## What You Asked For

You mentioned: **"I need to be able to copy and paste"**

✓ **Done!** I've created 2 ready-to-use SQL scripts that you can copy and paste directly into your Supabase SQL Editor.

---

## The Scripts

### 1. 📅 CALENDAR_FIX_WITH_PAST_DATES.sql

**Copy this entire file and paste it into Supabase SQL Editor**

**What it fixes:**
- Calendar doesn't show tasks when you navigate to yesterday
- Calendar doesn't show tasks from last week
- Can't see historical task data

**What it does:**
- Adds support for viewing past 90 days in calendar
- Updates the recurrence expansion function
- Removes the date filter blocking past dates

**Size:** ~400 lines of SQL
**Safe to run:** Yes, it's idempotent (safe to run multiple times)

---

### 2. 🔍 DATABASE_VERIFICATION_TESTS.sql

**Copy sections as needed and paste into Supabase SQL Editor**

**What it's for:**
- Diagnosing database issues
- Verifying setup is correct
- Testing specific features
- Finding missing data

**Size:** ~550 lines of SQL (13 sections)
**Safe to run:** Yes, it only reads data (no modifications)

**You can copy:**
- Individual sections (recommended)
- Multiple sections at once
- The entire file

---

## How to Use These Scripts

### Method 1: Copy Entire File

1. Open the SQL file (e.g., `CALENDAR_FIX_WITH_PAST_DATES.sql`)
2. Select All (Ctrl+A or Cmd+A)
3. Copy (Ctrl+C or Cmd+C)
4. Open Supabase Dashboard → SQL Editor → New Query
5. Paste (Ctrl+V or Cmd+V)
6. Click "Run" button
7. Check the output for success/error messages

### Method 2: Copy Specific Section

1. Open `DATABASE_VERIFICATION_TESTS.sql`
2. Find the section you need (e.g., "SECTION 1: AUTHENTICATION CHECK")
3. Select just that section
4. Copy it
5. Paste into Supabase SQL Editor
6. Click "Run"
7. Review the results

---

## Quick Answers to Common Questions

### Q: Which script do I run first?
**A:** Start with `DATABASE_VERIFICATION_TESTS.sql` Section 1 to verify you're logged in.

### Q: Do I need to run all of DATABASE_VERIFICATION_TESTS.sql?
**A:** No! Copy only the sections you need. Start with Sections 1-5 for a basic check.

### Q: When should I run CALENDAR_FIX_WITH_PAST_DATES.sql?
**A:** Run it if your calendar doesn't show tasks when you navigate to past dates.

### Q: Is it safe to run these scripts multiple times?
**A:**
- `CALENDAR_FIX_WITH_PAST_DATES.sql`: Yes, completely safe
- `DATABASE_VERIFICATION_TESTS.sql`: Yes, it only reads data

### Q: What if I get an error?
**A:**
1. Copy the error message
2. Run Section 1 of DATABASE_VERIFICATION_TESTS.sql to check authentication
3. Run Section 13 (Emergency Diagnostic) for detailed debug info
4. Look at the error message - it usually tells you what's missing

### Q: Do these scripts modify my data?
**A:**
- `CALENDAR_FIX_WITH_PAST_DATES.sql`: Only modifies functions and views (not your data)
- `DATABASE_VERIFICATION_TESTS.sql`: No modifications, read-only

### Q: Can I share these scripts with my team?
**A:** Yes! They're safe and designed to be shared.

---

## What's in Your Migrations Folder?

You have **90+ migration files** in `supabase/migrations/`. Here's what I noticed:

### Core Migrations (Base Schema)
- `20251005173501_20250820000000_create_core_tables.sql` - Main tables
- `20251005173530_20250828041242_create_global_cycles_and_goals.sql` - Timeline system
- `20251006053828_seed_wellness_domains.sql` - Wellness domains data
- `20251006232917_create_users_profile_table.sql` - User profiles
- `20251019220255_add_recurring_tasks_system.sql` - Recurring tasks

### Fix Migrations (Patches and Updates)
Many migrations are fixes or updates to previous migrations:
- Multiple migrations for timeline activation fixes
- Multiple migrations for view updates
- Multiple migrations for RLS policy updates
- Multiple migrations for function corrections

### Archived Migrations
- `supabase/migrations/_archived/` contains obsolete versions

### Potential Duplicates
Some migration files appear to be superseded by later versions (same functionality, different dates):
- Multiple "fix_activation" migrations
- Multiple "create_weekly_reflection" migrations
- Multiple "update_theme_color" migrations

---

## Understanding Your Migration Strategy

Your project uses a **sequential migration** approach:

1. **Initial schema** (Aug-Sep 2025)
2. **Feature additions** (Sep-Oct 2025)
3. **Bug fixes and patches** (Oct 2025)
4. **Refinements** (ongoing)

This is normal! As you develop, you add migrations to fix issues and add features.

---

## Do You Need a Complete Database Setup Script?

Based on your migrations, I can create a **single consolidated SQL script** that:

1. Creates all tables in one go
2. Includes all functions and views
3. Seeds initial data (wellness domains)
4. Sets up RLS policies
5. Includes all the latest fixes

**Would you like me to create this?** It would be a single file you could:
- Use to set up a new database from scratch
- Share with team members
- Use for testing environments

Let me know and I'll generate it!

---

## Migration File Naming Convention

Your migrations follow this pattern:
```
YYYYMMDDHHMMSS_descriptive_name.sql
```

Examples:
- `20251019220255_add_recurring_tasks_system.sql`
- `20251013160000_corrected_canonical_functions.sql`

Some have double timestamps:
```
20251005173501_20250820000000_create_core_tables.sql
      ↑              ↑
   Actual date    Original date
```

This indicates the migration was re-created/consolidated from an earlier version.

---

## Files You Now Have

```
project/
├── CALENDAR_FIX_WITH_PAST_DATES.sql     ← 📅 Calendar fix (READY TO PASTE)
├── DATABASE_VERIFICATION_TESTS.sql       ← 🔍 Diagnostics (READY TO PASTE)
├── SQL_SCRIPTS_GUIDE.md                  ← 📖 Detailed guide
└── COPY_PASTE_SQL_REFERENCE.md          ← 📋 This file (quick reference)
```

---

## Next Steps

### Immediate Actions:

1. **Verify your database:**
   ```
   Open: DATABASE_VERIFICATION_TESTS.sql
   Copy: Section 1 (Authentication Check)
   Paste: Into Supabase SQL Editor
   Run: Click the Run button
   ```

2. **Check what's working:**
   ```
   Copy: Sections 2, 3, 4, 5 from DATABASE_VERIFICATION_TESTS.sql
   Paste: Into Supabase SQL Editor
   Run: Click the Run button
   Review: Look for ✓ (working) and ✗ (broken)
   ```

3. **Fix calendar (if needed):**
   ```
   Open: CALENDAR_FIX_WITH_PAST_DATES.sql
   Copy: Everything (Ctrl+A, Ctrl+C)
   Paste: Into Supabase SQL Editor
   Run: Click the Run button
   ```

### Optional Actions:

4. **Run full diagnostics:**
   ```
   Copy: Entire DATABASE_VERIFICATION_TESTS.sql
   Paste: Into Supabase SQL Editor
   Run: Click the Run button
   Review: All output sections
   ```

5. **Share with team:**
   - Send them `SQL_SCRIPTS_GUIDE.md`
   - Share the SQL files
   - Everyone runs the same verification tests

---

## Support

If you encounter issues:

1. **Run Emergency Diagnostic:**
   - Copy Section 13 from `DATABASE_VERIFICATION_TESTS.sql`
   - Paste and run in Supabase SQL Editor
   - Share the output with your team or support

2. **Check Migration Status:**
   ```sql
   SELECT * FROM supabase_migrations.schema_migrations
   ORDER BY version DESC LIMIT 20;
   ```

3. **Verify Supabase Connection:**
   - Check your `.env` file has correct `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   - Verify you're logged into the Supabase dashboard

---

## Summary

✅ You have 2 copy-paste ready SQL scripts
✅ Comprehensive diagnostics available
✅ Calendar fix ready to apply
✅ Step-by-step guides included
✅ Safe to run multiple times
✅ No data loss risk

**Start with:** `DATABASE_VERIFICATION_TESTS.sql` Section 1

**Most useful:** `DATABASE_VERIFICATION_TESTS.sql` Sections 1-6, 13

**If calendar broken:** `CALENDAR_FIX_WITH_PAST_DATES.sql` (entire file)

---

**Ready to paste and run!** 🚀
