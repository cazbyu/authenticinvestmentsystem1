# Documentation Index

Welcome to the Authentic Intelligence documentation. This index helps you find the right documentation for your needs.

## Quick Start

- **[README.md](README.md)** - Project overview, installation, and getting started
- **[START_HERE.md](START_HERE.md)** - Quick fix for timeline activation issues (2 minutes)
- **[COMMON_TASKS.md](COMMON_TASKS.md)** - Quick reference for common tasks

## Database & SQL

### SQL Scripts

- **[SQL_GUIDE.md](SQL_GUIDE.md)** - Comprehensive guide to running SQL scripts
- **[sql/fixes/](sql/fixes/)** - One-time fix scripts for database issues
  - `fix_notes_join_schema.sql` - Fix schema issues in notes join table
  - `FIX_SUPABASE_VIEWS.sql` - Fix view column naming conflicts
  - `FIX_P_MAX_OCCURRENCES_ERROR.sql` - Fix max occurrences parameter error
- **[sql/database-updates/](sql/database-updates/)** - Schema updates and migrations
  - `CALENDAR_FIX_WITH_PAST_DATES.sql` - Enable calendar to show past dates
  - `DATABASE_VERIFICATION_TESTS.sql` - Comprehensive database tests
- **[sql/checks/](sql/checks/)** - Diagnostic queries
  - `CHECK_RLS_POLICIES.sql` - Verify Row Level Security policies
  - `DEBUG_ACTIVATION_TEST.sql` - Debug timeline activation

### Diagnostic & Testing

- **[z tests/](z%20tests/)** - Troubleshooting toolkit (8 scripts)
  - `DIAGNOSE_ACTIVATION_FAILURE.sql` - Diagnose timeline activation failures
  - `DIAGNOSE_DATABASE.sql` - General database diagnostics
  - `FINAL_FIX.sql` - Comprehensive fix for timeline activation
  - `TEST_ACTIVATION.sql` - Test timeline activation functionality
  - And more...

## Feature Documentation

### Core Features

- **[docs/features/reflections.md](docs/features/reflections.md)** - Reflections and journal system
- **[docs/features/calendar.md](docs/features/calendar.md)** - Calendar implementation, fixes, and optimization
- **[docs/features/timeline-activation.md](docs/features/timeline-activation.md)** - Timeline activation system
- **[docs/features/attachments.md](docs/features/attachments.md)** - Image and document attachments

### Other Features

- **[RECURRENCE_INPUT_FIX_SUMMARY.md](RECURRENCE_INPUT_FIX_SUMMARY.md)** - Recurring task input improvements
- **[MIDNIGHT_TASK_DISPLAY_IMPLEMENTATION.md](MIDNIGHT_TASK_DISPLAY_IMPLEMENTATION.md)** - Midnight task display logic
- **[WEEK_START_DAY_IMPLEMENTATION.md](WEEK_START_DAY_IMPLEMENTATION.md)** - Week start day customization
- **[MANAGE_ROLES_REFACTOR_SUMMARY.md](MANAGE_ROLES_REFACTOR_SUMMARY.md)** - Roles management refactor
- **[REFLECTION_NOTES_BADGE_FIX_SUMMARY.md](REFLECTION_NOTES_BADGE_FIX_SUMMARY.md)** - Reflection notes badge fixes

## Architecture & System Design

- **[docs/completion-synchronization.md](docs/completion-synchronization.md)** - Task completion synchronization
- **[docs/global-timeline-activation-system.md](docs/global-timeline-activation-system.md)** - Global timeline activation architecture
- **[docs/ui-ux-guidelines.md](docs/ui-ux-guidelines.md)** - UI/UX design guidelines

## Database Migrations

- **[docs/migrations/](docs/migrations/)** - Migration documentation organized by date
  - `README_MIGRATION_FIX.md` - Complete migration fix implementation
  - `MIGRATION_FIX_SUMMARY.md` - Migration fix summary (Oct 13, 2025)
  - `QUICK_START_MIGRATION.md` - Quick start guide for applying migrations
  - `MIGRATION_CLEANUP_SUMMARY.md` - Migration cleanup notes

## Implementation History

- **[docs/history/](docs/history/)** - Completed implementation summaries
  - `FIX_IMPLEMENTATION_COMPLETE.md` - Comprehensive fix completion report
  - `IMPLEMENTATION_SUMMARY.md` - General implementation summary
  - `TRIGGER_FIX_SUMMARY.md` - Database trigger fixes
  - `WEEKLY_REFLECTION_OPTIMIZATION_SUMMARY.md` - Weekly reflection optimizations
  - `MULTIPLE_TIMELINES_UPDATE.md` - Multiple timelines feature update
  - `GOAL_BANK_TIMELINE_FIX.md` - Goal bank timeline fixes

## Troubleshooting

- **[TROUBLESHOOTING_STEPS.md](TROUBLESHOOTING_STEPS.md)** - General troubleshooting guide
- **[SUPABASE_FIX_GUIDE.md](SUPABASE_FIX_GUIDE.md)** - Supabase-specific fixes
- **[FINAL_FIX_GUIDE.md](FINAL_FIX_GUIDE.md)** - Timeline activation fix guide
- **[FIX_ACTIVATION_ISSUES.md](FIX_ACTIVATION_ISSUES.md)** - Activation issue troubleshooting
- **[ACTIVATION_FAILURE_DEBUG_STEPS.md](ACTIVATION_FAILURE_DEBUG_STEPS.md)** - Debug steps for activation failures
- **[TIMELINE_ACTIVATION_DEBUG_GUIDE.md](TIMELINE_ACTIVATION_DEBUG_GUIDE.md)** - Detailed timeline activation debugging
- **[TIMELINE_ACTIVATION_DATE_FIX.md](TIMELINE_ACTIVATION_DATE_FIX.md)** - Timeline activation date fixes

## Deployment

- **[DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md)** - Pre-deployment checklist

## Legal

- **[legal-pages/](legal-pages/)** - Legal documents
  - `privacy.html` - Privacy policy
  - `terms.html` - Terms of service
  - `README.md` - Legal pages documentation

## File Organization

```
/
├── docs/
│   ├── features/          # Feature-specific documentation
│   ├── migrations/        # Database migration documentation
│   ├── history/          # Historical implementation notes
│   ├── completion-synchronization.md
│   ├── global-timeline-activation-system.md
│   └── ui-ux-guidelines.md
├── sql/
│   ├── fixes/            # One-time fix scripts
│   ├── database-updates/ # Schema updates
│   └── checks/           # Diagnostic queries
├── z tests/              # Troubleshooting toolkit
├── supabase/
│   ├── migrations/       # Official database migrations
│   └── functions/        # Edge functions
└── [root documentation files]
```

## Finding What You Need

### I need to...

- **Fix a database issue** → See [SQL_GUIDE.md](SQL_GUIDE.md) or [sql/fixes/](sql/fixes/)
- **Debug timeline activation** → See [START_HERE.md](START_HERE.md) or [z tests/FINAL_FIX.sql](z%20tests/FINAL_FIX.sql)
- **Understand a feature** → See [docs/features/](docs/features/)
- **Run a migration** → See [docs/migrations/](docs/migrations/)
- **Troubleshoot an error** → See [TROUBLESHOOTING_STEPS.md](TROUBLESHOOTING_STEPS.md)
- **Deploy the app** → See [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md)
- **Understand the codebase** → See [docs/ui-ux-guidelines.md](docs/ui-ux-guidelines.md)

## Contributing

When adding new documentation:
1. Place feature docs in `docs/features/`
2. Place migration docs in `docs/migrations/`
3. Place historical summaries in `docs/history/`
4. Place SQL scripts in appropriate `sql/` subdirectory
5. Update this index with the new file
