import { supabase } from '../supabase';
import { formatLocalDate } from './dateUtils';

interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  status?: string;
  htmlLink?: string;
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus?: string;
  }>;
  conferenceData?: {
    entryPoints?: Array<{
      uri?: string;
      entryPointType?: string;
    }>;
  };
}

interface SyncResult {
  success: boolean;
  eventsFetched: number;
  eventsCreated: number;
  eventsUpdated: number;
  eventsSkipped: number;
  error?: string;
}

/**
 * Get the active Google Calendar connection for a user
 */
export async function getGoogleCalendarConnection(userId: string) {
  const { data, error } = await supabase
    .from('0008-ap-calendar-connections')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', 'google')
    .eq('sync_enabled', true)
    .maybeSingle();

  if (error) {
    console.error('[GoogleSync] Error fetching connection:', error);
    return null;
  }

  return data;
}

/**
 * Save or update Google Calendar connection
 */
export const saveGoogleCalendarConnection = async (
  userId: string,
  accessToken: string,
  refreshToken: string,
  expiresInSeconds: number,
  userEmail: string
) => {
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();

  const { error } = await supabase
    .from('0008-ap-calendar-connections')
    .upsert({
      user_id: userId,
      provider: 'google',
      access_token: accessToken,
      refresh_token: refreshToken,
      token_expires_at: expiresAt,
      provider_email: userEmail,
      provider_user_id: userEmail,
      sync_enabled: true,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'user_id,provider'
    });

  if (error) {
    console.error('Error saving Google connection:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
};

/**
 * Check if access token is expired and refresh if needed.
 * Uses the Netlify server-side function for token refresh to keep
 * client_secret secure (never exposed to the browser).
 */
async function ensureValidToken(connection: any) {
  const now = new Date();
  const expiresAt = new Date(connection.token_expires_at);

  // If token expires in less than 5 minutes, refresh it
  const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

  if (expiresAt > fiveMinutesFromNow) {
    // Token is still valid
    return { accessToken: connection.access_token, success: true };
  }

  // Token is expired or about to expire, refresh via Netlify function
  if (!connection.refresh_token) {
    return {
      success: false,
      error: 'No refresh token available. User needs to reconnect.'
    };
  }

  try {
    const response = await fetch('/.netlify/functions/refresh-google-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: connection.user_id }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (errorData.needsReconnect) {
        throw new Error('Refresh token expired or revoked. User needs to reconnect.');
      }
      throw new Error('Failed to refresh token');
    }

    const data = await response.json();

    return { accessToken: data.access_token, success: true };
  } catch (error) {
    console.error('[GoogleSync] Error refreshing token:', error);
    return {
      success: false,
      error: 'Failed to refresh access token. User needs to reconnect.'
    };
  }
}

/**
 * Fetch events from Google Calendar API
 */
async function fetchGoogleCalendarEvents(
  accessToken: string,
  calendarId: string,
  timeMin: string,
  timeMax: string
): Promise<GoogleCalendarEvent[]> {
  const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`);
  url.searchParams.append('timeMin', timeMin);
  url.searchParams.append('timeMax', timeMax);
  url.searchParams.append('singleEvents', 'true');
  url.searchParams.append('orderBy', 'startTime');
  url.searchParams.append('maxResults', '250');

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Calendar API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.items || [];
}

/**
 * Convert Google Calendar event to a commitment record
 */
function convertGoogleEventToCommitment(
  googleEvent: GoogleCalendarEvent,
  userId: string,
  calendarId: string
): any {
  const isAllDay = !!googleEvent.start.date;

  let date: string;
  let startTime: string | null = null;
  let endTime: string | null = null;

  if (isAllDay) {
    date = googleEvent.start.date!;
  } else {
    const startDateTime = new Date(googleEvent.start.dateTime!);
    const endDateTime = googleEvent.end.dateTime
      ? new Date(googleEvent.end.dateTime)
      : startDateTime;

    date = formatLocalDate(startDateTime);
    startTime = startDateTime.toTimeString().split(' ')[0]; // HH:MM:SS
    endTime = endDateTime.toTimeString().split(' ')[0];
  }

  return {
    user_id: userId,
    title: googleEvent.summary || '(No title)',
    description: googleEvent.description || null,
    date,
    start_time: startTime,
    end_time: endTime,
    is_all_day: isAllDay,
    status: googleEvent.status === 'cancelled' ? 'missed' : 'pending',
    external_source: 'google',
    external_event_id: googleEvent.id,
    external_calendar_id: calendarId,
    location: null,
    synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

/**
 * Main sync function: Pull events from Google Calendar
 */
export async function syncGoogleCalendarEvents(
  userId: string,
  daysBack: number = 30,
  daysForward: number = 90
): Promise<SyncResult> {
  try {
    console.log('[GoogleSync] Starting sync for user:', userId);

    const connection = await getGoogleCalendarConnection(userId);
    if (!connection) {
      return {
        success: false,
        eventsFetched: 0,
        eventsCreated: 0,
        eventsUpdated: 0,
        eventsSkipped: 0,
        error: 'No active Google Calendar connection found',
      };
    }

    const tokenResult = await ensureValidToken(connection);
    if (!tokenResult.success) {
      return {
        success: false,
        eventsFetched: 0,
        eventsCreated: 0,
        eventsUpdated: 0,
        eventsSkipped: 0,
        error: tokenResult.error,
      };
    }

    const now = new Date();
    const timeMin = new Date(now);
    timeMin.setDate(timeMin.getDate() - daysBack);
    const timeMax = new Date(now);
    timeMax.setDate(timeMax.getDate() + daysForward);

    console.log('[GoogleSync] Fetching events from', timeMin, 'to', timeMax);

    const selectedCalendars: string[] = connection.selected_calendars || ['primary'];
    console.log('[GoogleSync] Syncing calendars:', selectedCalendars);

    let allGoogleEvents: { event: GoogleCalendarEvent; calendarId: string }[] = [];

    for (const calendarId of selectedCalendars) {
      try {
        console.log('[GoogleSync] Fetching from calendar:', calendarId);
        const events = await fetchGoogleCalendarEvents(
          tokenResult.accessToken!,
          calendarId,
          timeMin.toISOString(),
          timeMax.toISOString()
        );

        const taggedEvents = events.map(event => ({ event, calendarId }));
        allGoogleEvents = [...allGoogleEvents, ...taggedEvents];

        console.log(`[GoogleSync] Fetched ${events.length} events from ${calendarId}`);
      } catch (calendarError) {
        console.error(`[GoogleSync] Error fetching calendar ${calendarId}:`, calendarError);
      }
    }

    console.log('[GoogleSync] Fetched', allGoogleEvents.length, 'total events from Google');

    let eventsCreated = 0;
    let eventsUpdated = 0;
    let eventsSkipped = 0;

    for (const { event: googleEvent, calendarId } of allGoogleEvents) {
      try {
        const commitmentData = convertGoogleEventToCommitment(googleEvent, userId, calendarId);

        // Check if this commitment already exists
        const { data: existing } = await supabase
          .from('0008-ap-commitments')
          .select('id')
          .eq('user_id', userId)
          .eq('external_event_id', googleEvent.id)
          .maybeSingle();

        if (existing) {
          // Update existing commitment (preserve user-set status/reviewed_at)
          const { error: updateError } = await supabase
            .from('0008-ap-commitments')
            .update({
              title: commitmentData.title,
              description: commitmentData.description,
              date: commitmentData.date,
              start_time: commitmentData.start_time,
              end_time: commitmentData.end_time,
              is_all_day: commitmentData.is_all_day,
              external_calendar_id: commitmentData.external_calendar_id,
              location: commitmentData.location,
              synced_at: commitmentData.synced_at,
              updated_at: commitmentData.updated_at,
            })
            .eq('id', existing.id);

          if (updateError) {
            console.error('[GoogleSync] Error updating commitment:', updateError);
            eventsSkipped++;
          } else {
            eventsUpdated++;
          }
        } else {
          // Insert new commitment
          const { error: insertError } = await supabase
            .from('0008-ap-commitments')
            .insert(commitmentData);

          if (insertError) {
            console.error('[GoogleSync] Error creating commitment:', insertError);
            eventsSkipped++;
          } else {
            eventsCreated++;
          }
        }
      } catch (eventError) {
        console.error('[GoogleSync] Error processing event:', eventError);
        eventsSkipped++;
      }
    }

    await supabase
      .from('0008-ap-calendar-connections')
      .update({
        last_synced_at: new Date().toISOString(),
        last_sync_status: 'success',
        last_sync_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', connection.id);

    console.log('[GoogleSync] Sync complete:', {
      fetched: allGoogleEvents.length,
      created: eventsCreated,
      updated: eventsUpdated,
      skipped: eventsSkipped,
    });

    return {
      success: true,
      eventsFetched: allGoogleEvents.length,
      eventsCreated,
      eventsUpdated,
      eventsSkipped,
    };
  } catch (error) {
    console.error('[GoogleSync] Sync failed:', error);

    const connection = await getGoogleCalendarConnection(userId);
    if (connection) {
      await supabase
        .from('0008-ap-calendar-connections')
        .update({
          last_sync_status: 'error',
          last_sync_error: (error as Error).message,
          updated_at: new Date().toISOString(),
        })
        .eq('id', connection.id);
    }

    return {
      success: false,
      eventsFetched: 0,
      eventsCreated: 0,
      eventsUpdated: 0,
      eventsSkipped: 0,
      error: (error as Error).message,
    };
  }
}

/**
 * Get user's email from Google
 */
export async function getGoogleUserEmail(accessToken: string): Promise<string | null> {
  try {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch user info');
    }

    const data = await response.json();
    return data.email;
  } catch (error) {
    console.error('[GoogleSync] Error fetching user email:', error);
    return null;
  }
}
