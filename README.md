# Authentic Investment System

An Expo-based mobile application for managing authentic intelligence in your life through tasks, goals, reflections, and wellness tracking. Built with React Native, Expo Router, and Supabase.

---

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) and npm
- [Expo CLI](https://docs.expo.dev/get-started/installation/)
- A Supabase project (required for authentication and database)

### Installation

```bash
npm install
```

### Environment Variables

1. Copy `.env.example` to `.env`
2. Fill in your Supabase credentials:

   ```env
   EXPO_PUBLIC_SUPABASE_URL=your-supabase-url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```

   Find these values in your Supabase project's settings.

### Running the App

```bash
npm run dev
```

Or use the default command:

```bash
npm start
```

This will launch the Expo development tools for running the app on a simulator or physical device.

### Building for Web

```bash
npm run build:web
```

Output will be in the `build/` directory.

---

## Documentation

### Quick Links

- **[START_HERE.md](START_HERE.md)** - Quick fix for timeline activation (2 minutes)
- **[COMMON_TASKS.md](COMMON_TASKS.md)** - Quick reference for common development tasks
- **[DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md)** - Master index of all documentation

### Key Documentation

#### Database & SQL
- **[SQL_GUIDE.md](SQL_GUIDE.md)** - Comprehensive SQL scripts guide
- **[sql/](sql/)** - Organized SQL scripts (fixes, updates, checks)
- **[z tests/](z%20tests/)** - Diagnostic and troubleshooting toolkit

#### Features
- **[docs/features/calendar.md](docs/features/calendar.md)** - Calendar implementation guide
- **[docs/features/reflections.md](docs/features/reflections.md)** - Reflections system
- **[docs/features/](docs/features/)** - All feature documentation

#### Architecture
- **[docs/ui-ux-guidelines.md](docs/ui-ux-guidelines.md)** - UI/UX design guidelines
- **[docs/completion-synchronization.md](docs/completion-synchronization.md)** - Task completion sync
- **[docs/global-timeline-activation-system.md](docs/global-timeline-activation-system.md)** - Timeline system

#### Troubleshooting
- **[TROUBLESHOOTING_STEPS.md](TROUBLESHOOTING_STEPS.md)** - General troubleshooting
- **[SUPABASE_FIX_GUIDE.md](SUPABASE_FIX_GUIDE.md)** - Supabase-specific fixes

---

## Project Structure

```
/
├── app/                      # Routes (screens)
│   ├── (tabs)/              # Tab navigation
│   ├── auth/                # Authentication screens
│   ├── calendar.tsx         # Calendar view
│   ├── reflections.tsx      # Reflections view
│   └── settings.tsx         # Settings view
│
├── components/              # Reusable components
│   ├── attachments/         # File attachments
│   ├── calendar/            # Calendar components
│   ├── goals/               # Goal management
│   ├── journal/             # Journal view
│   ├── reflections/         # Reflection components
│   ├── settings/            # Settings components
│   ├── tasks/               # Task management
│   ├── timelines/           # Timeline management
│   └── wellness/            # Wellness charts
│
├── hooks/                   # Custom React hooks
│   ├── useCalendarEvents.ts # Calendar data fetching
│   ├── useGoals.ts          # Goals management
│   └── useRecurrenceCache.ts # Recurrence caching
│
├── lib/                     # Utilities and helpers
│   ├── dateUtils.ts         # Date manipulation
│   ├── recurrenceUtils.ts   # Recurrence calculations
│   ├── reflectionUtils.ts   # Reflection utilities
│   ├── supabase.ts          # Supabase client
│   └── taskUtils.ts         # Task utilities
│
├── contexts/                # React contexts
│   ├── AuthenticScoreContext.tsx
│   ├── TabResetContext.tsx
│   └── ThemeContext.tsx
│
├── docs/                    # Documentation
│   ├── features/            # Feature docs
│   ├── migrations/          # Migration guides
│   └── history/             # Implementation history
│
├── sql/                     # SQL scripts
│   ├── fixes/               # One-time fixes
│   ├── database-updates/    # Schema updates
│   └── checks/              # Diagnostic queries
│
├── z tests/                 # Troubleshooting scripts
│
└── supabase/               # Supabase configuration
    ├── migrations/          # Database migrations
    └── functions/           # Edge functions
```

---

## Key Features

### Authentic Investment System
- Track deposits (completed tasks) and withdrawals
- Calculate your authentic score
- View journal of all investments
- Analytics and balance tracking

### Task & Event Management
- Create tasks and events with rich details
- Recurring tasks with flexible scheduling
- Priority matrix (Eisenhower Matrix)
- Calendar views (daily, weekly, monthly)
- Delegate tasks and set reminders

### Reflections & Journaling
- Daily, weekly, and monthly reflections
- Rich text notes with formatting
- Image and document attachments
- Link reflections to roles, domains, and relationships
- Follow-up date tracking

### Goals & Timelines
- 12-week goal cycles
- Custom and global timelines
- Goal bank for future ideas
- Progress tracking and key results
- Action items for each goal

### Wellness Tracking
- Balance wheel across life domains
- Balance scores and trends
- Visual charts and analytics
- Domain-specific task tracking

### Roles & Relationships
- Define key roles in your life
- Track key relationships
- Link tasks/goals to roles
- Manage role-specific activities

---

## Technology Stack

- **Framework**: React Native with Expo
- **Routing**: Expo Router
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Storage**: Supabase Storage (images, attachments)
- **UI Components**: React Native built-in components
- **Charts**: Victory Native (wellness charts)
- **Calendar**: React Native Calendars
- **Icons**: Lucide React Native

---

## Development

### Available Scripts

```bash
# Development server
npm run dev

# Start (default)
npm start

# Build for web
npm run build:web

# Clean web build
npm run clean:web

# Run tests
npm test

# Lint
npm run lint
```

### Environment Setup

The project uses Expo environment variables. All variables must be prefixed with `EXPO_PUBLIC_` to be available in the app.

Required variables:
- `EXPO_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anonymous key

### Database Setup

1. Create a Supabase project
2. Run migrations from `supabase/migrations/` directory (in order by timestamp)
3. Verify setup with `sql/database-updates/DATABASE_VERIFICATION_TESTS.sql`

For detailed database setup, see [SQL_GUIDE.md](SQL_GUIDE.md).

### Testing

Run tests with:
```bash
npm test
```

Test files are located in `lib/__tests__/`.

---

## Common Tasks

See [COMMON_TASKS.md](COMMON_TASKS.md) for quick links to:
- Fixing database issues
- Running diagnostics
- Understanding features
- Troubleshooting problems
- Building and deploying

---

## Troubleshooting

### Timeline Activation Not Working
See [START_HERE.md](START_HERE.md) for a 2-minute fix.

### Calendar Not Showing Past Dates
Run `sql/database-updates/CALENDAR_FIX_WITH_PAST_DATES.sql` in Supabase SQL Editor.

### General Database Issues
1. Run Section 1 of `sql/database-updates/DATABASE_VERIFICATION_TESTS.sql` to check authentication
2. Run Sections 2-5 to verify database setup
3. Run Section 13 for comprehensive diagnostics

### More Help
- [TROUBLESHOOTING_STEPS.md](TROUBLESHOOTING_STEPS.md) - General troubleshooting
- [SQL_GUIDE.md](SQL_GUIDE.md) - SQL script troubleshooting
- [DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md) - Find all documentation

---

## Deployment

See [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) for pre-deployment checklist.

---

## Legal

- [Privacy Policy](legal-pages/privacy.html)
- [Terms of Service](legal-pages/terms.html)

---

## Contributing

When adding new documentation:
1. Place feature docs in `docs/features/`
2. Place migration docs in `docs/migrations/`
3. Place SQL scripts in appropriate `sql/` subdirectory
4. Update [DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md)
5. Update [COMMON_TASKS.md](COMMON_TASKS.md) if adding common workflows

---

## Support

For issues:
1. Check [COMMON_TASKS.md](COMMON_TASKS.md) for quick solutions
2. Review [TROUBLESHOOTING_STEPS.md](TROUBLESHOOTING_STEPS.md)
3. Run database diagnostics from [SQL_GUIDE.md](SQL_GUIDE.md)
4. Check [DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md) for relevant docs

---

**Last Updated:** November 2025
