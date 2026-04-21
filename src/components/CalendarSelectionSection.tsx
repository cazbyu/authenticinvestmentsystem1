import React, { useEffect, useState } from 'react';
import { useGoogleCalendarSync } from '../hooks/useGoogleCalendarSync';

export function CalendarSelectionSection() {
  const {
    isConnected,
    availableCalendars,
    selectedCalendarIds,
    setSelectedCalendars,
    fetchCalendarList,
  } = useGoogleCalendarSync();

  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isConnected && availableCalendars.length === 0) {
      loadCalendars();
    }
  }, [isConnected]);

  const loadCalendars = async () => {
    setIsLoading(true);
    await fetchCalendarList();
    setIsLoading(false);
  };

  const toggleCalendar = async (calendarId: string) => {
    const isCurrentlySelected = selectedCalendarIds.includes(calendarId);

    let newSelection: string[];
    if (isCurrentlySelected) {
      if (selectedCalendarIds.length === 1) {
        return; // Can't deselect the last one
      }
      newSelection = selectedCalendarIds.filter(id => id !== calendarId);
    } else {
      newSelection = [...selectedCalendarIds, calendarId];
    }

    await setSelectedCalendars(newSelection);
  };

  if (!isConnected) {
    return (
      <div className="mt-4">
        <h4 className="text-sm font-semibold text-gray-500 uppercase mb-2">Calendar Selection</h4>
        <p className="text-sm text-gray-400 italic">
          Connect Google Calendar to select which calendars to sync.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mt-4">
        <h4 className="text-sm font-semibold text-gray-500 uppercase mb-2">Calendar Selection</h4>
        <div className="flex items-center gap-3 py-4">
          <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full" />
          <span className="text-sm text-gray-500">Loading calendars...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <h4 className="text-sm font-semibold text-gray-500 uppercase mb-1">Calendars to Sync</h4>
      <p className="text-sm text-gray-500 mb-3">
        Select which calendars to display in your Calendar View.
      </p>

      {availableCalendars.length === 0 ? (
        <button
          onClick={loadCalendars}
          className="px-4 py-2 bg-blue-500 text-white text-sm font-semibold rounded-lg hover:bg-blue-600 transition-colors"
        >
          Load Calendars
        </button>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {availableCalendars.map(calendar => (
            <button
              key={calendar.id}
              onClick={() => toggleCalendar(calendar.id)}
              className="w-full flex items-center px-4 py-3 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors text-left"
            >
              {/* Color indicator */}
              <span
                className="w-3.5 h-3.5 rounded-full mr-3 flex-shrink-0"
                style={{ backgroundColor: calendar.backgroundColor || '#4285F4' }}
              />

              {/* Calendar info */}
              <div className="flex-1 min-w-0 mr-3">
                <span className="text-sm font-medium text-gray-900">
                  {calendar.summary}
                  {calendar.primary && (
                    <span className="text-xs text-blue-500 font-normal ml-1">(Primary)</span>
                  )}
                </span>
                {calendar.description && (
                  <p className="text-xs text-gray-500 truncate mt-0.5">{calendar.description}</p>
                )}
              </div>

              {/* Toggle */}
              <div
                className={`w-10 h-6 rounded-full relative transition-colors flex-shrink-0 ${
                  selectedCalendarIds.includes(calendar.id) ? 'bg-blue-500' : 'bg-gray-300'
                }`}
              >
                <div
                  className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    selectedCalendarIds.includes(calendar.id) ? 'translate-x-4' : 'translate-x-0.5'
                  }`}
                />
              </div>
            </button>
          ))}
        </div>
      )}

      {availableCalendars.length > 0 && (
        <p className="text-xs text-gray-400 mt-2 text-center">
          {selectedCalendarIds.length} of {availableCalendars.length} calendars selected
        </p>
      )}
    </div>
  );
}
