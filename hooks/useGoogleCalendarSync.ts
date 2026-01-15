/**
 * useGoogleCalendarSync Hook
 * 
 * Provides incremental Google Calendar sync with:
 * - Background sync every 10 minutes
 * - Sync on Calendar tab focus
 * - Sync token support for efficient incremental updates
 * - Multiple calendar support
 * - Manual sync trigger
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { getSupabaseClient } from '@/lib/supabase';
import { eventBus, EVENTS } from '@/lib/eventBus';

// Sync interval: 10 minutes in milliseconds
const SYNC_INTERVAL_MS = 10 * 60 * 1000;

// Minimum time between syncs to prevent spam (30 seconds)
const MIN_SYNC_INTERVAL_MS = 30 * 1000;

interface CalendarInfo {
  id: string;
  summary: string;
  description?: string;
  primary?: boolean;
  backgroundColor?: string;
  selected?: boolean;
}

interface SyncState {
  isConnected: boolean;
  isSyncing: boolean;
  lastSyncedAt: Date | null;
  lastSyncError: string | null;
  eventsCount: number;
  availableCalendars: CalendarInfo[];
  selectedCalendarIds: string[];
}

interface GoogleCalendarConnection {
  id: string;
  user_id: string;
  provider: string;
  access_token: string;
  refresh_token: string | null;
  token_expires_at: string | null;
  provider_user_id: string | null;
  provider_email: string | null;
  provider_calendar_list: CalendarInfo[] | null;
  sync_enabled: boolean;
  selected_calendars: string[] | null;
  sync_token: string | null;
  last_synced_at: string | null;
  last_sync_status: string | null;
  last_sync_error: string | null;
}

export function useGoogleCalendarSync(isCalendarTabActive: boolean = false) {
  const [syncState, setSyncState] = useState<SyncState>({
    isConnected: false,
    isSyncing: false,
    lastSyncedAt: null,
    lastSyncError: null,
    eventsCount: 0,
    availableCalendars: [],
    selectedCalendarIds: [],
  });

  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastSyncTimeRef = useRef<number>(0);
  const isMountedRef = useRef(true);
  const connectionRef = useRef<GoogleCalendarConnection | null>(null);

  /**
   * Check if user has Google Calendar connected
   */
  const checkConnection = useCallback(async (): Promise<GoogleCalendarConnection | null> => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return null;

      const { data, error } = await supabase
        .from('0008-ap-calendar-connections')
        .select('*')
        .eq('user_id', user.id)
        .eq('provider', 'google')
        .single();

      if (error || !data) {
        setSyncState(prev => ({ ...prev, isConnected: false }));
        return null;
      }

      // Check if sync is enabled for this connection
      if (!data.sync_enabled) {
        console.log('[GoogleCalendarSync] Sync is disabled for this connection');
        setSyncState(prev => ({ ...prev, isConnected: true }));
        return null;
      }

      connectionRef.current = data as GoogleCalendarConnection;

      setSyncState(prev => ({ 
        ...prev, 
        isConnected: true,
        lastSyncedAt: data.last_synced_at ? new Date(data.last_synced_at) : null,
        availableCalendars: data.provider_calendar_list || [],
        selectedCalendarIds: data.selected_calendars || ['primary'],
      }));

      return data as GoogleCalendarConnection;
    } catch (error) {
      console.error('[GoogleCalendarSync] Error checking connection:', error);
      return null;
    }
  }, []);

  /**
   * Refresh the Google access token if expired or expiring soon
   */
  const refreshTokenIfNeeded = useCallback(async (connection: GoogleCalendarConnection): Promise<string | null> => {
    const supabase = getSupabaseClient();

    // PRIORITY 1: Always try to get fresh provider_token from current Supabase session first
    // This is the most reliable source when user has recently authenticated
    try {
      const { data: sessionData } = await supabase.auth.getSession();

      if (sessionData?.session?.provider_token) {
        console.log('[GoogleCalendarSync] Using fresh provider_token from Supabase session');

        // Update our stored token in database for future use
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase
            .from('0008-ap-calendar-connections')
            .update({
              access_token: sessionData.session.provider_token,
              token_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
            })
            .eq('user_id', user.id)
            .eq('provider', 'google');
        }

        return sessionData.session.provider_token;
      }
    } catch (sessionError) {
      console.warn('[GoogleCalendarSync] Error getting session:', sessionError);
    }

    // PRIORITY 2: Try refreshing the Supabase session to get a new provider_token
    try {
      console.log('[GoogleCalendarSync] No provider_token in session, attempting session refresh...');
      const { data, error: refreshError } = await supabase.auth.refreshSession();

      if (refreshError) {
        console.warn('[GoogleCalendarSync] Supabase session refresh error:', refreshError);
      }

      if (data?.session?.provider_token) {
        console.log('[GoogleCalendarSync] Got fresh token from Supabase session refresh');

        // Update our stored token in calendar connections table
        await supabase
          .from('0008-ap-calendar-connections')
          .update({
            access_token: data.session.provider_token,
            token_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
          })
          .eq('user_id', connection.user_id)
          .eq('provider', 'google');

        return data.session.provider_token;
      }
    } catch (refreshError) {
      console.warn('[GoogleCalendarSync] Session refresh failed:', refreshError);
    }

    // PRIORITY 3: Check if stored token is still valid (has 5+ minutes remaining)
    if (connection.access_token && connection.token_expires_at) {
      const expiresAt = new Date(connection.token_expires_at);
      const now = new Date();

      if (expiresAt.getTime() - now.getTime() > 5 * 60 * 1000) {
        console.log('[GoogleCalendarSync] Using stored token (still valid)');
        return connection.access_token;
      }
    }

    // PRIORITY 4: Try Netlify function with refresh_token
    if (connection.refresh_token) {
      console.log('[GoogleCalendarSync] Trying Netlify function for token refresh...');

      try {
        const response = await fetch('/.netlify/functions/refresh-google-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: connection.user_id }),
        });

        if (response.ok) {
          const tokenData = await response.json();

          if (tokenData.access_token) {
            console.log('[GoogleCalendarSync] Got fresh token from Netlify function');
            return tokenData.access_token;
          }
        } else {
          const errorData = await response.json();
          console.error('[GoogleCalendarSync] Netlify function error:', response.status, errorData);

          if (errorData.needsReconnect) {
            console.warn('[GoogleCalendarSync] Refresh token expired - user needs to reconnect');
          }
        }
      } catch (netlifyError) {
        console.error('[GoogleCalendarSync] Netlify function failed:', netlifyError);
      }
    }

    // FALLBACK: Try existing stored token - might still work briefly
    if (connection.access_token) {
      console.warn('[GoogleCalendarSync] No fresh token available, trying stored token as last resort');
      return connection.access_token;
    }

    console.error('[GoogleCalendarSync] No valid access token available');
    return null;
  }, []);

  /**
   * Fetch list of available calendars from Google
   */
  const fetchCalendarList = useCallback(async (): Promise<CalendarInfo[]> => {
    const connection = connectionRef.current || await checkConnection();
    if (!connection) return [];

    try {
      const accessToken = await refreshTokenIfNeeded(connection);
      if (!accessToken) {
        console.error('[GoogleCalendarSync] Cannot fetch calendars - no access token');
        return [];
      }

      const response = await fetch(
        'https://www.googleapis.com/calendar/v3/users/me/calendarList',
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        console.error('[GoogleCalendarSync] Failed to fetch calendar list:', response.status);
        return [];
      }

      const data = await response.json();
      const calendars: CalendarInfo[] = (data.items || []).map((cal: any) => ({
        id: cal.id,
        summary: cal.summary || cal.id,
        description: cal.description,
        primary: cal.primary || false,
        backgroundColor: cal.backgroundColor,
        selected: connection.selected_calendars?.includes(cal.id) || cal.primary,
      }));

      console.log(`[GoogleCalendarSync] Found ${calendars.length} calendars`);

      // Save calendar list to database
      const supabase = getSupabaseClient();
      await supabase
        .from('0008-ap-calendar-connections')
        .update({
          provider_calendar_list: calendars,
        })
        .eq('user_id', connection.user_id)
        .eq('provider', 'google');

      setSyncState(prev => ({
        ...prev,
        availableCalendars: calendars,
      }));

      return calendars;
    } catch (error) {
      console.error('[GoogleCalendarSync] Error fetching calendar list:', error);
      return [];
    }
  }, [checkConnection, refreshTokenIfNeeded]);

  /**
   * Update selected calendars
   */
  const setSelectedCalendars = useCallback(async (calendarIds: string[]): Promise<boolean> => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return false;

      const { error } = await supabase
        .from('0008-ap-calendar-connections')
        .update({
          selected_calendars: calendarIds,
        })
        .eq('user_id', user.id)
        .eq('provider', 'google');

      if (error) {
        console.error('[GoogleCalendarSync] Error updating selected calendars:', error);
        return false;
      }

      setSyncState(prev => ({
        ...prev,
        selectedCalendarIds: calendarIds,
        availableCalendars: prev.availableCalendars.map(cal => ({
          ...cal,
          selected: calendarIds.includes(cal.id),
        })),
      }));

      console.log('[GoogleCalendarSync] Selected calendars updated:', calendarIds);
      
      // Trigger a full sync to get events from newly selected calendars
      performSync(true);
      
      return true;
    } catch (error) {
      console.error('[GoogleCalendarSync] Error setting selected calendars:', error);
      return false;
    }
  }, []);

  /**
   * Sync events from a single calendar
   */
  const syncCalendar = useCallback(async (
    calendarId: string,
    accessToken: string,
    userId: string,
    forceFullSync: boolean,
    syncToken: string | null
  ): Promise<{ events: number; newSyncToken: string | null }> => {
    const supabase = getSupabaseClient();
    
    // Build the API URL
    const encodedCalendarId = encodeURIComponent(calendarId);
    let apiUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodedCalendarId}/events?`;
    const params = new URLSearchParams({
      maxResults: '250',
      singleEvents: 'true',
      orderBy: 'startTime',
    });

    // Use sync token for incremental sync if available
    if (syncToken && !forceFullSync) {
      params.set('syncToken', syncToken);
      console.log(`[GoogleCalendarSync] Using sync token for calendar: ${calendarId}`);
    } else {
      // Full sync: get events from 30 days ago to 90 days in future
      const timeMin = new Date();
      timeMin.setDate(timeMin.getDate() - 30);
      const timeMax = new Date();
      timeMax.setDate(timeMax.getDate() + 90);
      
      params.set('timeMin', timeMin.toISOString());
      params.set('timeMax', timeMax.toISOString());
    }

    apiUrl += params.toString();

    const response = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      if (response.status === 410) {
        // Sync token expired, need full sync
        console.log(`[GoogleCalendarSync] Sync token expired for calendar: ${calendarId}`);
        return syncCalendar(calendarId, accessToken, userId, true, null);
      }
      throw new Error(`Google Calendar API error: ${response.status}`);
    }

    const data = await response.json();
    const events = data.items || [];
    const newSyncToken = data.nextSyncToken;

    console.log(`[GoogleCalendarSync] Calendar ${calendarId}: ${events.length} events`);

    // Process events
    let processedCount = 0;
    for (const event of events) {
      // Skip cancelled events (delete them from our DB)
      if (event.status === 'cancelled') {
        await supabase
          .from('0008-ap-tasks')
          .delete()
          .eq('external_event_id', event.id)
          .eq('user_id', userId);
        continue;
      }

      // Parse event data
      const startDate = event.start?.date || event.start?.dateTime?.split('T')[0];
      const endDate = event.end?.date || event.end?.dateTime?.split('T')[0];
      const startTime = event.start?.dateTime ? event.start.dateTime.split('T')[1]?.substring(0, 5) : null;
      const endTime = event.end?.dateTime ? event.end.dateTime.split('T')[1]?.substring(0, 5) : null;
      const isAllDay = !event.start?.dateTime;

      // Upsert the event
      const { error: upsertError } = await supabase
  .from('0008-ap-tasks')
  .upsert({
    user_id: userId,
    external_event_id: event.id,
    external_calendar_id: calendarId,
    title: event.summary || 'Untitled Event',
    description: event.description || null,
    type: 'event',
    status: 'pending',
    start_date: startDate,
    end_date: endDate !== startDate ? endDate : null,
    start_time: startTime,
    end_time: endTime,
    is_all_day: isAllDay,
    location: event.location || null,
    recurrence_rule: null,
    external_source: 'google',
    external_sync_direction: 'pull',
    last_external_sync_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, {
    onConflict: 'external_event_id,user_id',
  });

      if (upsertError) {
        console.error('[GoogleCalendarSync] Error upserting event:', upsertError);
      } else {
        processedCount++;
      }
    }

    return { events: processedCount, newSyncToken };
  }, []);

  /**
   * Perform incremental sync with Google Calendar API (all selected calendars)
   */
  const performSync = useCallback(async (forceFullSync: boolean = false): Promise<boolean> => {
    // Prevent sync spam
    const now = Date.now();
    if (now - lastSyncTimeRef.current < MIN_SYNC_INTERVAL_MS && !forceFullSync) {
      console.log('[GoogleCalendarSync] Skipping sync - too soon since last sync');
      return false;
    }

    const connection = await checkConnection();
    if (!connection) {
      console.log('[GoogleCalendarSync] No connection found, skipping sync');
      return false;
    }

    // Check if already syncing
    if (syncState.isSyncing) {
      console.log('[GoogleCalendarSync] Already syncing, skipping');
      return false;
    }

    setSyncState(prev => ({ ...prev, isSyncing: true, lastSyncError: null }));
    lastSyncTimeRef.current = now;

    try {
      const accessToken = await refreshTokenIfNeeded(connection);
      if (!accessToken) {
        throw new Error('Unable to get valid access token');
      }

      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      // Get selected calendars (default to primary if none selected)
      const selectedCalendars = connection.selected_calendars?.length 
        ? connection.selected_calendars 
        : ['primary'];

      console.log(`[GoogleCalendarSync] Syncing ${selectedCalendars.length} calendar(s)`);

      let totalProcessed = 0;

      // Sync each selected calendar
      for (const calendarId of selectedCalendars) {
        try {
          const result = await syncCalendar(
            calendarId,
            accessToken,
            user.id,
            forceFullSync,
            connection.sync_token // For now, using one sync token - could be per-calendar
          );
          totalProcessed += result.events;

          // Update sync token (using the last one - could improve this)
          if (result.newSyncToken) {
            await supabase
              .from('0008-ap-calendar-connections')
              .update({ sync_token: result.newSyncToken })
              .eq('user_id', user.id)
              .eq('provider', 'google');
          }
        } catch (calError) {
          console.error(`[GoogleCalendarSync] Error syncing calendar ${calendarId}:`, calError);
          // Continue with other calendars
        }
      }

      // Update last sync time
      await supabase
        .from('0008-ap-calendar-connections')
        .update({
          last_synced_at: new Date().toISOString(),
          last_sync_status: 'success',
          last_sync_error: null,
        })
        .eq('user_id', user.id)
        .eq('provider', 'google');

      if (isMountedRef.current) {
        setSyncState(prev => ({
          ...prev,
          isSyncing: false,
          lastSyncedAt: new Date(),
          eventsCount: totalProcessed,
        }));
      }

      // Emit event to refresh UI
      if (totalProcessed > 0) {
        eventBus.emit(EVENTS.REFRESH_ALL_TASKS);
      }

      console.log(`[GoogleCalendarSync] Sync complete: ${totalProcessed} events processed`);
      return true;

    } catch (error) {
      console.error('[GoogleCalendarSync] Sync error:', error);
      
      // Save error to database
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('0008-ap-calendar-connections')
          .update({
            last_sync_status: 'error',
            last_sync_error: (error as Error).message,
          })
          .eq('user_id', user.id)
          .eq('provider', 'google');
      }
      
      if (isMountedRef.current) {
        setSyncState(prev => ({
          ...prev,
          isSyncing: false,
          lastSyncError: (error as Error).message,
        }));
      }
      
      return false;
    }
  }, [syncState.isSyncing, checkConnection, refreshTokenIfNeeded, syncCalendar]);

  /**
   * Manual sync trigger (exposed to components)
   */
  const syncNow = useCallback(async () => {
    return performSync(false);
  }, [performSync]);

  /**
   * Force full sync (clears sync token and does complete refresh)
   */
  const forceFullSync = useCallback(async () => {
    return performSync(true);
  }, [performSync]);

  /**
   * Start background sync interval
   */
  const startBackgroundSync = useCallback(() => {
    // Clear any existing interval
    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
    }

    console.log('[GoogleCalendarSync] Starting background sync (every 10 minutes)');
    
    syncIntervalRef.current = setInterval(() => {
      console.log('[GoogleCalendarSync] Background sync triggered');
      performSync(false);
    }, SYNC_INTERVAL_MS);
  }, [performSync]);

  /**
   * Stop background sync
   */
  const stopBackgroundSync = useCallback(() => {
    if (syncIntervalRef.current) {
      console.log('[GoogleCalendarSync] Stopping background sync');
      clearInterval(syncIntervalRef.current);
      syncIntervalRef.current = null;
    }
  }, []);

  // Initial setup and connection check
  useEffect(() => {
    isMountedRef.current = true;
    checkConnection();

    return () => {
      isMountedRef.current = false;
      stopBackgroundSync();
    };
  }, [checkConnection, stopBackgroundSync]);

  // Start/stop background sync based on app state
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        startBackgroundSync();
        // Also sync immediately when app becomes active
        performSync(false);
      } else {
        stopBackgroundSync();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    // Start sync when hook mounts (app is active)
    if (syncState.isConnected) {
      startBackgroundSync();
    }

    return () => {
      subscription?.remove();
    };
  }, [syncState.isConnected, startBackgroundSync, stopBackgroundSync, performSync]);

  // Sync when Calendar tab becomes active
  useEffect(() => {
    if (isCalendarTabActive && syncState.isConnected) {
      console.log('[GoogleCalendarSync] Calendar tab active, triggering sync');
      performSync(false);
    }
  }, [isCalendarTabActive, syncState.isConnected, performSync]);

  return {
    ...syncState,
    syncNow,
    forceFullSync,
    checkConnection,
    fetchCalendarList,
    setSelectedCalendars,
  };
}

export default useGoogleCalendarSync;