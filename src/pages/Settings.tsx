import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useGoogleCalendarSync } from '../hooks/useGoogleCalendarSync';
import { linkGoogleAccount, disconnectGoogleCalendar, getLinkedProviders } from '../lib/googleAuth';
import { saveGoogleCalendarConnection, getGoogleUserEmail } from '../lib/GoogleCalendarSync';
import { supabase } from '../supabase';
import { CalendarSelectionSection } from '../components/CalendarSelectionSection';
import { CalendarManagementModal } from '../components/settings/CalendarManagementModal';
import { RefreshCw } from 'lucide-react';

export function Settings() {
  const { user } = useAuth();

  const {
    isConnected,
    isSyncing,
    lastSyncedAt,
    lastSyncError,
    eventsCount,
    syncNow,
    checkConnection,
  } = useGoogleCalendarSync();

  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [showCalendarManagement, setShowCalendarManagement] = useState(false);

  // On mount: check for a fresh provider_token (just returned from Google OAuth)
  // and save the connection, then load status
  useEffect(() => {
    if (!user) return;

    const handleOAuthReturn = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const providerToken = sessionData?.session?.provider_token;
        const providerRefreshToken = sessionData?.session?.provider_refresh_token;

        if (providerToken) {
          console.log('[Settings] Detected fresh provider_token from OAuth, saving connection...');

          // Get the Google email
          const email = await getGoogleUserEmail(providerToken);

          // Save to 0008-ap-calendar-connections
          await saveGoogleCalendarConnection(
            user.id,
            providerToken,
            providerRefreshToken || '',
            3600, // Google tokens typically last 1 hour
            email || user.email || ''
          );

          // Refresh hook state
          await checkConnection();
        }
      } catch (err) {
        console.error('[Settings] Error handling OAuth return:', err);
      }

      // Always load status regardless
      await loadGoogleStatus();
    };

    handleOAuthReturn();
  }, [user]);

  const loadGoogleStatus = async () => {
    if (!user) return;

    // Check if Google is linked as a provider
    const providers = await getLinkedProviders();
    const hasGoogle = providers.includes('google');

    if (hasGoogle && isConnected) {
      // Load sync enabled status from connection
      const { data } = await supabase
        .from('0008-ap-calendar-connections')
        .select('sync_enabled, provider_email')
        .eq('user_id', user.id)
        .eq('provider', 'google')
        .maybeSingle();

      if (data) {
        setSyncEnabled(data.sync_enabled ?? false);
        setGoogleEmail(data.provider_email);
      }
    }
  };

  const handleConnectGoogle = async () => {
    try {
      setIsConnectingGoogle(true);
      await linkGoogleAccount();
      // After redirect, the auth callback will handle saving the connection
    } catch (error) {
      console.error('Error connecting Google:', error);
      setIsConnectingGoogle(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    if (!user) return;

    try {
      const result = await disconnectGoogleCalendar(user.id);
      if (!result.success) {
        console.error('Error disconnecting Google:', result.error);
        return;
      }

      // Clear local state immediately so UI updates
      setSyncEnabled(false);
      setGoogleEmail(null);

      // Re-check connection — hook will see the row is gone and set isConnected=false
      await checkConnection();

      console.log('[Settings] Google Calendar disconnected successfully');
    } catch (error) {
      console.error('Error disconnecting Google:', error);
    }
  };

  const handleToggleSync = async () => {
    if (!user) return;

    const newValue = !syncEnabled;
    setSyncEnabled(newValue);

    await supabase
      .from('0008-ap-calendar-connections')
      .update({ sync_enabled: newValue })
      .eq('user_id', user.id)
      .eq('provider', 'google');

    if (newValue) {
      syncNow();
    }
  };

  const handleSyncNow = async () => {
    const result = await syncNow();
    if (result) {
      await checkConnection();
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-3xl font-bold mb-6">Settings</h1>

      {/* Connected Calendars Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Connected Calendars</h2>

        {/* Google Calendar Connection */}
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none">
                <rect x="3" y="4" width="18" height="18" rx="2" stroke="#4285F4" strokeWidth="2"/>
                <path d="M3 10h18" stroke="#4285F4" strokeWidth="2"/>
                <path d="M8 2v4M16 2v4" stroke="#4285F4" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <div>
                <h3 className="font-medium text-gray-800">Google Calendar</h3>
                {isConnected && googleEmail && (
                  <p className="text-xs text-gray-500">{googleEmail}</p>
                )}
              </div>
            </div>

            <span className={`text-xs font-medium px-2 py-1 rounded-full ${
              isConnected
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-500'
            }`}>
              {isConnected ? 'Connected' : 'Not connected'}
            </span>
          </div>

          {/* Connect / Disconnect */}
          {!isConnected ? (
            <button
              onClick={handleConnectGoogle}
              disabled={isConnectingGoogle}
              className="w-full py-2.5 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
            >
              {isConnectingGoogle ? 'Connecting...' : 'Connect Google Calendar'}
            </button>
          ) : (
            <>
              {/* Sync Toggle */}
              <div className="flex items-center justify-between py-3 border-t border-gray-100 mt-2">
                <span className="text-sm text-gray-700">Sync Events</span>
                <button
                  onClick={handleToggleSync}
                  className={`w-10 h-6 rounded-full relative transition-colors ${
                    syncEnabled ? 'bg-blue-500' : 'bg-gray-300'
                  }`}
                >
                  <div
                    className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      syncEnabled ? 'translate-x-4' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              {/* Sync Now */}
              {syncEnabled && (
                <div className="pt-2 border-t border-gray-100">
                  <button
                    onClick={handleSyncNow}
                    disabled={isSyncing}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg disabled:opacity-50 transition-colors"
                  >
                    <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
                    {isSyncing ? 'Syncing...' : 'Sync Now'}
                  </button>

                  {lastSyncedAt && (
                    <p className="text-xs text-gray-400 mt-1 px-1">
                      Last synced: {lastSyncedAt.toLocaleString()}
                      {eventsCount > 0 && ` (${eventsCount} events)`}
                    </p>
                  )}

                  {lastSyncError && (
                    <p className="text-xs text-red-500 mt-1 px-1">
                      Error: {lastSyncError}
                    </p>
                  )}
                </div>
              )}

              {/* Calendar Selection */}
              <CalendarSelectionSection />

              {/* Disconnect */}
              <div className="pt-3 mt-3 border-t border-gray-100">
                <button
                  onClick={handleDisconnectGoogle}
                  className="text-sm text-red-500 hover:text-red-700 transition-colors"
                >
                  Disconnect Google Calendar
                </button>
              </div>
            </>
          )}
        </div>

        {/* Holidays & Special Days */}
        <div className="mt-6 border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-gray-800">Holidays & Special Days</h3>
              <p className="text-sm text-gray-500 mt-0.5">Manage which holidays appear on your calendar</p>
            </div>
            <button
              onClick={() => setShowCalendarManagement(true)}
              className="px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              Manage
            </button>
          </div>
        </div>
      </div>

      {/* Calendar Management Modal */}
      <CalendarManagementModal
        visible={showCalendarManagement}
        onClose={() => setShowCalendarManagement(false)}
      />
    </div>
  );
}
