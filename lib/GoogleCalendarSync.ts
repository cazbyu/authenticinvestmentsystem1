import { getSupabaseClient } from './supabase';
import { formatLocalDate, toLocalISOString } from './dateUtils';

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
  const supabase = getSupabaseClient();
  
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
// UPDATED: Writes to the existing "0008-ap-calendar-connections" table
export const saveGoogleCalendarConnection = async (
  userId: string,
  accessToken: string,
  refreshToken: string,
  expiresInSeconds: number,
  userEmail: string
) => {
  const supabase = getSupabaseClient();

  // Calculate the actual timestamp when the token expires
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();

  const { error } = await supabase
    .from('0008-ap-calendar-connections') // <--- The CORRECT table
    .upsert({
      user_id: userId,
      provider: 'google',               // <--- Explicitly set the provider
      access_token: accessToken,
      refresh_token: refreshToken,
      token_expires_at: expiresAt,      // <--- Mapped to your schema
      provider_email: userEmail,
      provider_user_id: userEmail,      // Using email as ID for simple Google auth
      sync_enabled: true,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'user_id,provider'    // <--- Uses your unique constraint
    });

  if (error) {
    console.error('Error saving Google connection:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
};

/**
 * Disconnect Google Calendar
 */
export async function disconnectGoogleCalendar(userId: string) {
  const supabase = getSupabaseClient();
  
  const { error } = await supabase
    .from('0008-ap-calendar-connections')
    .delete()
    .eq('user_id', userId)
    .eq('provider', 'google');

  if (error) {
    console.error('[GoogleSync] Error disconnecting:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Check if access token is expired and refresh if needed
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

  // Token is expired or about to expire, refresh it
  if (!connection.refresh_token) {
    return { 
      success: false, 
      error: 'No refresh token available. User needs to reconnect.' 
    };
  }

  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID!,
        client_secret: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_SECRET!,
        refresh_token: connection.refresh_token,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to refresh token');
    }

    const data = await response.json();
    
    // Update the connection with new token
    const supabase = getSupabaseClient();
    const newExpiresAt = new Date();
    newExpiresAt.setSeconds(newExpiresAt.getSeconds() + data.expires_in);

    await supabase
      .from('0008-ap-calendar-connections')
      .update({
        access_token: data.access_token,
        token_expires_at: newExpiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', connection.id);

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
  timeMin: string,
  timeMax: string
): Promise<GoogleCalendarEvent[]> {
  const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
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
 * Convert Google Calendar event to our task format
 */
function convertGoogleEventToTask(
  googleEvent: GoogleCalendarEvent,
  userId: string
): any {
  const isAllDay = !!googleEvent.start.date; // date field means all-day event
  
  let startDate: string;
  let endDate: string | null = null;
  let startTime: string | null = null;
  let endTime: string | null = null;

  if (isAllDay) {
    // All-day event
    startDate = googleEvent.start.date!;
    endDate = googleEvent.end.date || startDate;
  } else {
    // Timed event
    const startDateTime = new Date(googleEvent.start.dateTime!);
    const endDateTime = googleEvent.end.dateTime 
      ? new Date(googleEvent.end.dateTime) 
      : startDateTime;

    startDate = formatLocalDate(startDateTime);
    endDate = formatLocalDate(endDateTime);
    
    // Extract time portions
    startTime = startDateTime.toTimeString().split(' ')[0]; // HH:MM:SS
    endTime = endDateTime.toTimeString().split(' ')[0];
  }

  // Store additional metadata
  const metadata = {
    google_html_link: googleEvent.htmlLink,
    google_description: googleEvent.description,
    google_attendees: googleEvent.attendees?.map(a => ({
      email: a.email,
      name: a.displayName,
      status: a.responseStatus,
    })),
    google_conference_link: googleEvent.conferenceData?.entryPoints?.find(
      e => e.entryPointType === 'video'
    )?.uri,
  };

  return {
    user_id: userId,
    title: googleEvent.summary || '(No title)',
    description: googleEvent.description || null,
    type: 'event',
    start_date: startDate,
    end_date: endDate,
    start_time: startTime,
    end_time: endTime,
    is_all_day: isAllDay,
    is_anytime: false,
    status: googleEvent.status === 'cancelled' ? 'cancelled' : 'pending',
    external_source: 'google',
    external_event_id: googleEvent.id,
    external_calendar_id: 'primary',
    external_sync_direction: 'pull',
    external_metadata: metadata,
    last_external_sync_at: new Date().toISOString(),
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
  const supabase = getSupabaseClient();
  
  try {
    console.log('[GoogleSync] Starting sync for user:', userId);

    // 1. Get the connection
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

    // 2. Ensure we have a valid access token
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

    // 3. Calculate date range
    const now = new Date();
    const timeMin = new Date(now);
    timeMin.setDate(timeMin.getDate() - daysBack);
    const timeMax = new Date(now);
    timeMax.setDate(timeMax.getDate() + daysForward);

    console.log('[GoogleSync] Fetching events from', timeMin, 'to', timeMax);

    // 4. Fetch events from Google Calendar
    const googleEvents = await fetchGoogleCalendarEvents(
      tokenResult.accessToken!,
      timeMin.toISOString(),
      timeMax.toISOString()
    );

    console.log('[GoogleSync] Fetched', googleEvents.length, 'events from Google');

    let eventsCreated = 0;
    let eventsUpdated = 0;
    let eventsSkipped = 0;

    // 5. Process each event
    for (const googleEvent of googleEvents) {
      try {
        // Check if we already have this event
        const { data: existingTask } = await supabase
          .from('0008-ap-tasks')
          .select('id, updated_at')
          .eq('user_id', userId)
          .eq('external_source', 'google')
          .eq('external_event_id', googleEvent.id)
          .is('deleted_at', null)
          .maybeSingle();

        const taskData = convertGoogleEventToTask(googleEvent, userId);

        if (existingTask) {
          // Update existing event
          const { error: updateError } = await supabase
            .from('0008-ap-tasks')
            .update({
              ...taskData,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingTask.id);

          if (updateError) {
            console.error('[GoogleSync] Error updating event:', updateError);
            eventsSkipped++;
          } else {
            eventsUpdated++;
          }
        } else {
          // Create new event
          const { error: insertError } = await supabase
            .from('0008-ap-tasks')
            .insert(taskData);

          if (insertError) {
            console.error('[GoogleSync] Error creating event:', insertError);
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

    // 6. Update connection's last sync time
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
      fetched: googleEvents.length,
      created: eventsCreated,
      updated: eventsUpdated,
      skipped: eventsSkipped,
    });

    return {
      success: true,
      eventsFetched: googleEvents.length,
      eventsCreated,
      eventsUpdated,
      eventsSkipped,
    };
  } catch (error) {
    console.error('[GoogleSync] Sync failed:', error);
    
    // Update connection with error status
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