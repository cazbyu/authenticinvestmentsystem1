# Database Documentation

This folder contains all database-related documentation including migrations, SQL scripts, and database architecture guides.

## Quick Reference

### Getting Started
- **[QUICK_START_MIGRATION.md](QUICK_START_MIGRATION.md)** - Quick start guide for database setup
- **[README_MIGRATION_FIX.md](README_MIGRATION_FIX.md)** - Migration troubleshooting guide

### SQL Scripts
- **[SQL_SCRIPTS_GUIDE.md](SQL_SCRIPTS_GUIDE.md)** - Comprehensive SQL scripts guide
- **[README_SQL_SCRIPTS.md](README_SQL_SCRIPTS.md)** - SQL scripts reference
- **[COPY_PASTE_SQL_REFERENCE.md](COPY_PASTE_SQL_REFERENCE.md)** - Copy-paste SQL snippets

### Database Architecture
- **[DATABASE_VIEWS_IMPLEMENTATION_PLAN.md](DATABASE_VIEWS_IMPLEMENTATION_PLAN.md)** - Database views architecture

## Database Structure

The Authentic Investment System uses Supabase (PostgreSQL) with the following key components:

### Core Tables
- User profiles and authentication
- Roles and timelines
- Goals and actions
- Tasks and events
- Reflections and notes

### Views
- `v_unified_goals` - Unified goal data across timeline types
- `v_global_cycles` - Global timeline cycles with metadata
- `v_unified_timeline_weeks` - Combined timeline week data
- Weekly and daily reflection views

### Functions
- Timeline activation and deactivation
- Task completion synchronization
- Recurrence pattern generation
- Week start day management

## Migration Files

All migration files are located in `/supabase/migrations/` and follow the naming convention:
```
YYYYMMDDHHMMSS_descriptive_name.sql
```

### Running Migrations

Migrations are automatically applied in order when deploying to Supabase. For local development:

1. Ensure Supabase CLI is installed
2. Run `supabase db reset` to reset local database
3. Run `supabase db push` to apply migrations

## Best Practices

1. **Always use migrations** - Never modify database schema directly
2. **Test locally first** - Use local Supabase instance for testing
3. **Document changes** - Add clear comments in migration files
4. **Backup before major changes** - Create database backups
5. **Follow RLS policies** - Always implement Row Level Security

## Troubleshooting

For common issues, see:
- [README_MIGRATION_FIX.md](README_MIGRATION_FIX.md) - Migration-specific issues
- [SQL_SCRIPTS_GUIDE.md](SQL_SCRIPTS_GUIDE.md) - Script-related problems
- Root directory SQL files - Diagnostic and verification scripts

## Related Documentation

- [Global Timeline Activation System](../global-timeline-activation-system.md)
- [Completion Synchronization](../completion-synchronization.md)
- [Development History Archive](../archive/) - Historical fixes and implementations
