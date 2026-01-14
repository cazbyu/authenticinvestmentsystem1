/**
 * useGoogleCalendarSync Hook
 * 
 * Provides incremental Google Calendar sync with:
 * - Background sync every 10 minutes
 * - Sync on Calendar tab focus
 * - Sync token support for efficient incremental updates
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

interface SyncState {
  isConnected: boolean;
  isSyncing: boolean;
  lastSyncedAt: Date | null;
  lastSyncError: string | null;
  eventsCount: number;
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
  sync_enabled: boolean;
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
  });

  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastSyncTimeRef = useRef<number>(0);
  const isMountedRef = useRef(true);

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

      setSyncState(prev => ({ 
        ...prev, 
        isConnected: true,
        lastSyncedAt: data.last_synced_at ? new Date(data.last_synced_at) : null
      }));

      return data as GoogleCalendarConnection;
    } catch (error) {
      console.error('[GoogleCalendarSync] Error checking connection:', error);
      return null;
    }
  }, []);

  /**
   * Refresh access token if expired
   */
  const refreshTokenIfNeeded = useCallback(async (connection: GoogleCalendarConnection): Promise<string | null> => {
    const expiresAt = new Date(connection.token_expires_at);
    const now = new Date();
    
    // If token expires in less than 5 minutes, refresh it
    if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
      console.log('[GoogleCalendarSync] Token expired or expiring soon, refreshing...');
      
      try {
        // Use Supabase to refresh the token
        const supabase = getSupabaseClient();
        const { data: session } = await supabase.auth.getSession();
        
        if (session?.session?.provider_token) {
          // Update the stored token
          await supabase
            .from('0008-ap-calendar-connections')
            .update({
              access_token: session.session.provider_token,
              token_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
            })
            .eq('user_id', connection.user_id)
            .eq('provider', 'google');

          return session.session.provider_token;
        }
        
        return null;
      } catch (error) {
        console.error('[GoogleCalendarSync] Error refreshing token:', error);
        return null;
      }
    }

    return connection.access_token;
  }, []);

  /**
   * Perform incremental sync with Google Calendar API
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

      // Build the API URL
      let apiUrl = 'https://www.googleapis.com/calendar/v3/calendars/primary/events?';
      const params = new URLSearchParams({
        maxResults: '250',
        singleEvents: 'true',
        orderBy: 'startTime',
      });

      // Use sync token for incremental sync if available (and not forcing full sync)
      if (connection.sync_token && !forceFullSync) {
        params.set('syncToken', connection.sync_token);
        console.log('[GoogleCalendarSync] Using sync token for incremental sync');
      } else {
        // Full sync: get events from 30 days ago to 90 days in future
        const timeMin = new Date();
        timeMin.setDate(timeMin.getDate() - 30);
        const timeMax = new Date();
        timeMax.setDate(timeMax.getDate() + 90);
        
        params.set('timeMin', timeMin.toISOString());
        params.set('timeMax', timeMax.toISOString());
        console.log('[GoogleCalendarSync] Performing full sync');
      }

      apiUrl += params.toString();

      // Fetch events from Google Calendar
      const response = await fetch(apiUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        // If sync token is invalid (410 Gone), do a full sync
        if (response.status === 410) {
          console.log('[GoogleCalendarSync] Sync token expired, performing full sync');
          // Clear sync token and retry
          await supabase
            .from('0008-ap-calendar-connections')
            .update({ sync_token: null })
            .eq('user_id', user.id)
            .eq('provider', 'google');
          
          return performSync(true); // Retry with full sync
        }
        
        throw new Error(`Google Calendar API error: ${response.status}`);
      }

      const data = await response.json();
      const events = data.items || [];
      const newSyncToken = data.nextSyncToken;

      console.log(`[GoogleCalendarSync] Received ${events.length} events`);

      // Process events - upsert to database
      let processedCount = 0;
      for (const event of events) {
        // Skip cancelled events (delete them from our DB)
        if (event.status === 'cancelled') {
          await supabase
            .from('0008-ap-tasks')
            .delete()
            .eq('google_event_id', event.id)
            .eq('user_id', user.id);
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
            user_id: user.id,
            google_event_id: event.id,
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
            recurrence_rule: null, // Important: use NULL not empty string
            source: 'google_calendar',
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'google_event_id,user_id',
          });

        if (upsertError) {
          console.error('[GoogleCalendarSync] Error upserting event:', upsertError);
        } else {
          processedCount++;
        }
      }

      // Save the new sync token and last sync time
      await supabase
        .from('0008-ap-calendar-connections')
        .update({
          sync_token: newSyncToken || connection.sync_token,
          last_synced_at: new Date().toISOString(),
          last_sync_status: 'success',
        })
        .eq('user_id', user.id)
        .eq('provider', 'google');

      if (isMountedRef.current) {
        setSyncState(prev => ({
          ...prev,
          isSyncing: false,
          lastSyncedAt: new Date(),
          eventsCount: processedCount,
        }));
      }

      // Emit event to refresh UI
      if (processedCount > 0) {
        eventBus.emit(EVENTS.REFRESH_ALL_TASKS);
      }

      console.log(`[GoogleCalendarSync] Sync complete: ${processedCount} events processed`);
      return true;

    } catch (error) {
      console.error('[GoogleCalendarSync] Sync error:', error);
      
      if (isMountedRef.current) {
        setSyncState(prev => ({
          ...prev,
          isSyncing: false,
          lastSyncError: (error as Error).message,
        }));
      }
      
      return false;
    }
  }, [syncState.isSyncing, checkConnection, refreshTokenIfNeeded]);

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
  };
}

export default useGoogleCalendarSync;