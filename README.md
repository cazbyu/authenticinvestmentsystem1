# Authentic Investment System

An Expo-based mobile application for goal tracking, timeline management, and personal development. Built with React Native (Expo) and Supabase backend.

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) and npm
- [Expo CLI](https://docs.expo.dev/get-started/installation/)
- Active Supabase project

### Installation

```bash
npm install
```

### Environment Variables

1. Copy [.env.example](.env.example) to `.env`
2. Fill in your Supabase credentials:

   ```env
   EXPO_PUBLIC_SUPABASE_URL=your-supabase-url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```

   Find these values in your Supabase project settings under API.

### Running the App

```bash
npm run dev
```

This launches Expo development tools for running on a simulator or physical device.

## Documentation

### Essential Guides
- **[DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md)** - Production deployment steps
- **[docs/global-timeline-activation-system.md](docs/global-timeline-activation-system.md)** - Timeline activation architecture
- **[docs/completion-synchronization.md](docs/completion-synchronization.md)** - Task completion sync logic
- **[docs/ui-ux-guidelines.md](docs/ui-ux-guidelines.md)** - UI/UX design standards

### Database Documentation
- **[docs/database/](docs/database/)** - Database setup, migrations, and SQL guides
  - Migration guides and troubleshooting
  - SQL reference scripts
  - Database views implementation

### Development History
- **[docs/archive/](docs/archive/)** - Historical fix documentation and implementation summaries
  - Completed fixes and debugging guides
  - Feature implementation summaries
  - Refactoring documentation

## Project Structure

```
/app              # Expo Router pages and navigation
/components       # Reusable React components
/contexts         # React Context providers
/hooks            # Custom React hooks
/lib              # Utility functions and helpers
/supabase         # Database migrations and functions
/docs             # Project documentation
```

## Features

- Goal and timeline management (12-week cycles)
- Role-based organization
- Task and event tracking with recurrence
- Weekly and daily reflections
- Authentic score tracking
- Calendar integration
