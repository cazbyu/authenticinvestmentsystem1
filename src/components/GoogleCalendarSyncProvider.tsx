import { useGoogleCalendarSync } from '../hooks/useGoogleCalendarSync';
import { useAuth } from '../contexts/AuthContext';

/**
 * Invisible component that starts Google Calendar background sync
 * when the user is logged in. Mount once at the app root.
 * Renders nothing — just activates the hook's side effects
 * (connection check, 10-minute interval, visibility listener).
 */
export function GoogleCalendarSyncProvider() {
  const { user } = useAuth();

  // Only activate the hook when logged in
  if (!user) return null;

  return <SyncRunner />;
}

function SyncRunner() {
  // Calling the hook starts:
  //  - initial connection check
  //  - background sync every 10 minutes
  //  - sync on tab focus (visibilitychange)
  useGoogleCalendarSync();

  return null;
}
