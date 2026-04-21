import { supabase } from '../supabase';

const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ');

/**
 * Sign in with Google OAuth via Supabase (web browser redirect)
 */
export async function signInWithGoogle() {
  const redirectTo = `${window.location.origin}/auth/callback`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      scopes: GOOGLE_SCOPES,
    },
  });

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Link Google account to existing user (for calendar access).
 * Also used for reconnect — forces a fresh consent screen via
 * queryParams so Google issues a new refresh_token.
 */
export async function linkGoogleAccount() {
  const redirectTo = `${window.location.origin}/settings`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      scopes: GOOGLE_SCOPES,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Disconnect Google Calendar.
 * Deletes the calendar-connections row. Does NOT unlink the Supabase
 * identity — the user may have signed in with Google as their only
 * provider, and unlinkIdentity would fail in that case.
 */
export async function disconnectGoogleCalendar(userId: string) {
  const { error } = await supabase
    .from('0008-ap-calendar-connections')
    .delete()
    .eq('user_id', userId)
    .eq('provider', 'google');

  if (error) {
    console.error('[googleAuth] Error deleting connection row:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Get list of linked OAuth providers for current user
 */
export async function getLinkedProviders() {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return [];
  }

  return user.identities?.map((identity) => identity.provider) || [];
}
