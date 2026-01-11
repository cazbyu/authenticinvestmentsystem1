# Common Tasks - Quick Reference

Quick links to documentation for common tasks. Find what you need fast.

---

## Database Tasks

### Fix Timeline Activation
**Quick Fix (2 minutes):**
1. See [START_HERE.md](START_HERE.md) for the fastest fix
2. Run `z tests/FINAL_FIX.sql` in Supabase SQL Editor

**Detailed Troubleshooting:**
- [TIMELINE_ACTIVATION_DEBUG_GUIDE.md](TIMELINE_ACTIVATION_DEBUG_GUIDE.md) - Comprehensive debugging
- [FIX_ACTIVATION_ISSUES.md](FIX_ACTIVATION_ISSUES.md) - Activation troubleshooting
- [ACTIVATION_FAILURE_DEBUG_STEPS.md](ACTIVATION_FAILURE_DEBUG_STEPS.md) - Debug steps

###Fix Calendar Not Showing Past Dates
**Quick Fix:**
1. Open [SQL_GUIDE.md](SQL_GUIDE.md)
2. Follow instructions for `CALENDAR_FIX_WITH_PAST_DATES.sql`
3. Run the script in Supabase SQL Editor

**Learn More:**
- [docs/features/calendar.md](docs/features/calendar.md) - Complete calendar documentation

### Run Database Diagnostics
**Quick Check:**
1. Open [SQL_GUIDE.md](SQL_GUIDE.md)
2. Find `DATABASE_VERIFICATION_TESTS.sql` section
3. Run Section 1 first (authentication check)
4. Run Sections 2-5 for basic verification
5. Run Section 13 for emergency diagnostic

**Location:** `sql/database-updates/DATABASE_VERIFICATION_TESTS.sql`

### Apply a Database Migration
**Quick Start:**
1. See [docs/migrations/QUICK_START_MIGRATION.md](docs/migrations/QUICK_START_MIGRATION.md)
2. Copy migration file contents
3. Paste into Supabase SQL Editor
4. Click Run

**Detailed Guide:**
- [docs/migrations/README_MIGRATION_FIX.md](docs/migrations/README_MIGRATION_FIX.md) - Complete migration guide

### Check RLS Policies
**Quick Check:**
1. Run `sql/checks/CHECK_RLS_POLICIES.sql` in Supabase SQL Editor
2. Review output for policy configuration

### Fix Database View Errors
**Quick Fix:**
1. Run `sql/fixes/FIX_SUPABASE_VIEWS.sql`
2. This fixes column naming conflicts in views

---

## Feature Implementation Tasks

### Understand Reflections System
**Documentation:**
- [docs/features/reflections.md](docs/features/reflections.md) - Full reflections documentation
- Workflow diagram in your original request shows the data flow

**Related Components:**
- `components/journal/JournalView.tsx` - Display journal entries
- `components/reflections/JournalForm.tsx` - Create/edit reflections
- `components/reflections/DailyNotesView.tsx` - Daily notes view
- `components/reflections/WeeklyReflectionView.tsx` - Weekly reflections

### Work with Calendar Features
**Documentation:**
- [docs/features/calendar.md](docs/features/calendar.md) - Complete calendar guide (fixes, refactor, optimization)

**Quick Links:**
- Database fixes for past dates
- Refactor implementation status
- Performance optimization details
- Testing procedures

### Implement Attachments
**Documentation:**
- [docs/features/IMAGE_ATTACHMENT_ENHANCEMENTS.md](docs/features/IMAGE_ATTACHMENT_ENHANCEMENTS.md) - Image attachments
- [docs/features/ATTACHMENT_DISPLAY_IMPLEMENTATION.md](docs/features/ATTACHMENT_DISPLAY_IMPLEMENTATION.md) - Display implementation

### Understand Recurring Tasks
**Documentation:**
- [docs/features/recurrence-input.md](docs/features/recurrence-input.md) - Input improvements
- [docs/features/midnight-tasks.md](docs/features/midnight-tasks.md) - Midnight task display

**Related Files:**
- `lib/recurrenceUtils.ts` - Client-side recurrence logic
- `lib/rruleUtils.ts` - RRule parsing
- `hooks/useRecurrenceCache.ts` - Caching for performance

### Manage Roles and Relationships
**Documentation:**
- [docs/features/manage-roles-refactor.md](docs/features/manage-roles-refactor.md) - Roles management refactor

**Components:**
- `components/settings/ManageRolesContent.tsx`
- `components/settings/ManageRolesModal.tsx`
- `components/settings/EditRoleModal.tsx`
- `components/settings/EditKRModal.tsx`

### Configure Week Start Day
**Documentation:**
- [docs/features/week-start-day.md](docs/features/week-start-day.md) - Week start day implementation

---

## Troubleshooting Tasks

### General Troubleshooting
**Start Here:**
1. [TROUBLESHOOTING_STEPS.md](TROUBLESHOOTING_STEPS.md) - General troubleshooting guide
2. [SQL_GUIDE.md](SQL_GUIDE.md) - SQL script troubleshooting

### Timeline Activation Not Working
**Quick Diagnostic:**
1. Run `z tests/DIAGNOSE_ACTIVATION_FAILURE.sql`
2. Review each section's output
3. Apply fix from `z tests/FINAL_FIX.sql`

**Detailed Guides:**
- [TIMELINE_ACTIVATION_DEBUG_GUIDE.md](TIMELINE_ACTIVATION_DEBUG_GUIDE.md)
- [docs/global-timeline-activation-system.md](docs/global-timeline-activation-system.md)

### Database Connection Issues
**Check:**
1. Verify `.env` file has correct values:
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
2. Run authentication check: Section 1 of `DATABASE_VERIFICATION_TESTS.sql`
3. See [SUPABASE_FIX_GUIDE.md](SUPABASE_FIX_GUIDE.md)

### App Performance Issues
**Check:**
- [docs/features/calendar.md](docs/features/calendar.md) - See optimization section
- Review `lib/logger.ts` for debugging
- Check console for excessive logging

### Reflection Notes Not Showing
**Fix:**
- [docs/features/reflection-notes-badge.md](docs/features/reflection-notes-badge.md) - Badge fix details

---

## Development Tasks

### Set Up the Project
**Quick Start:**
1. Read [README.md](README.md) - Installation and setup
2. Copy `.env.example` to `.env`
3. Fill in Supabase credentials
4. Run `npm install`
5. Run `npm run dev`

### Build the Project
**Command:**
```bash
npm run build:web
```

**Verification:**
- Build completes without errors
- Check `build/` directory for output files

### Run Tests
**Command:**
```bash
npm test
```

**Test Files:**
- `lib/__tests__/dateUtils.test.js`

### Deploy the App
**Checklist:**
- [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) - Pre-deployment checklist

---

## Understanding the Codebase

### Architecture Documentation
- [docs/ui-ux-guidelines.md](docs/ui-ux-guidelines.md) - UI/UX guidelines
- [docs/completion-synchronization.md](docs/completion-synchronization.md) - Task completion sync
- [docs/global-timeline-activation-system.md](docs/global-timeline-activation-system.md) - Timeline system

### Historical Context
**See `docs/history/` for:**
- [FIX_IMPLEMENTATION_COMPLETE.md](docs/history/FIX_IMPLEMENTATION_COMPLETE.md) - Major fix completion
- [IMPLEMENTATION_SUMMARY.md](docs/history/IMPLEMENTATION_SUMMARY.md) - General implementation notes
- [TRIGGER_FIX_SUMMARY.md](docs/history/TRIGGER_FIX_SUMMARY.md) - Database trigger fixes
- [WEEKLY_REFLECTION_OPTIMIZATION_SUMMARY.md](docs/history/WEEKLY_REFLECTION_OPTIMIZATION_SUMMARY.md) - Reflection optimizations
- [MULTIPLE_TIMELINES_UPDATE.md](docs/history/MULTIPLE_TIMELINES_UPDATE.md) - Multiple timelines feature
- [GOAL_BANK_TIMELINE_FIX.md](docs/history/GOAL_BANK_TIMELINE_FIX.md) - Goal bank fixes

### Component Organization
**Key Directories:**
- `app/` - Route screens (main pages)
- `components/` - Reusable components organized by feature
- `hooks/` - Custom React hooks
- `lib/` - Utility functions and helpers
- `contexts/` - React contexts (Theme, Auth, TabReset)

**Component Structure:**
```
components/
├── attachments/     # Image/file attachments
├── calendar/        # Calendar views and grids
├── depositIdeas/    # Deposit idea management
├── goals/           # Goal management
├── journal/         # Journal view and withdrawal form
├── legal/           # Legal content (terms, privacy)
├── northStar/       # North star and 1-year goals
├── reflections/     # All reflection-related components
├── settings/        # Settings and configuration
├── suggestions/     # User suggestions
├── tasks/           # Task management
├── timelines/       # Timeline management
└── wellness/        # Wellness/balance charts
```

---

## Find All Documentation

**Master Index:**
- [DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md) - Complete documentation index with all files organized by category

**Key Documentation Directories:**
- `docs/features/` - Feature-specific documentation
- `docs/migrations/` - Database migration guides
- `docs/history/` - Historical implementation notes
- `sql/` - SQL scripts organized by purpose
- `z tests/` - Diagnostic and troubleshooting scripts

---

## Quick Command Reference

### Git Commands
```bash
# Check status
git status

# View recent changes
git log --oneline -10
```

### NPM Commands
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for web
npm run build:web

# Run tests
npm test

# Clean build
npm run clean:web
```

### Supabase SQL Quick Checks
```sql
-- See your user ID
SELECT auth.uid();

-- Check tasks count
SELECT COUNT(*) FROM "0008-ap-tasks" WHERE user_id = auth.uid();

-- See global cycles
SELECT * FROM "0008-ap-global-cycles" ORDER BY start_date;

-- Check activated timelines
SELECT * FROM "0008-ap-user-global-timelines" WHERE user_id = auth.uid();
```

---

## When You're Stuck

1. **Check the master index**: [DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md)
2. **Run diagnostics**: `sql/database-updates/DATABASE_VERIFICATION_TESTS.sql` Section 13
3. **Search troubleshooting**: [TROUBLESHOOTING_STEPS.md](TROUBLESHOOTING_STEPS.md)
4. **Review SQL guide**: [SQL_GUIDE.md](SQL_GUIDE.md)
5. **Check feature docs**: `docs/features/` directory

---

**Last Updated:** November 2025
**Quick Tip:** Bookmark this file for fast access to common tasks!
