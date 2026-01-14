import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useGoogleCalendarSync } from '@/hooks/useGoogleCalendarSync';

export function CalendarSelectionSection() {
  const {
    isConnected,
    availableCalendars,
    selectedCalendarIds,
    setSelectedCalendars,
    fetchCalendarList,
  } = useGoogleCalendarSync();

  const [isLoading, setIsLoading] = useState(false);

  // Load calendar list when section becomes visible
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
      // Don't allow deselecting all calendars - keep at least one
      if (selectedCalendarIds.length === 1) {
        return; // Can't deselect the last one
      }
      newSelection = selectedCalendarIds.filter(id => id !== calendarId);
    } else {
      newSelection = [...selectedCalendarIds, calendarId];
    }

    await setSelectedCalendars(newSelection);
  };

  // Not connected - show message
  if (!isConnected) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Calendar Selection</Text>
        <Text style={styles.notConnectedText}>
          Connect Google Calendar to select which calendars to sync.
        </Text>
      </View>
    );
  }

  // Loading calendars
  if (isLoading) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Calendar Selection</Text>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#4285F4" />
          <Text style={styles.loadingText}>Loading calendars...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Calendars to Sync</Text>
      <Text style={styles.sectionDescription}>
        Select which calendars to display in your Calendar View.
      </Text>

      {availableCalendars.length === 0 ? (
        <TouchableOpacity style={styles.refreshButton} onPress={loadCalendars}>
          <Text style={styles.refreshButtonText}>Load Calendars</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.calendarList}>
          {availableCalendars.map(calendar => (
            <TouchableOpacity
              key={calendar.id}
              style={styles.calendarRow}
              onPress={() => toggleCalendar(calendar.id)}
              activeOpacity={0.7}
            >
              {/* Color indicator */}
              <View
                style={[
                  styles.colorDot,
                  { backgroundColor: calendar.backgroundColor || '#4285F4' },
                ]}
              />

              {/* Calendar info */}
              <View style={styles.calendarInfo}>
                <Text style={styles.calendarName}>
                  {calendar.summary}
                  {calendar.primary && (
                    <Text style={styles.primaryBadge}> (Primary)</Text>
                  )}
                </Text>
                {calendar.description && (
                  <Text style={styles.calendarDescription} numberOfLines={1}>
                    {calendar.description}
                  </Text>
                )}
              </View>

              {/* Toggle switch */}
              <Switch
                value={selectedCalendarIds.includes(calendar.id)}
                onValueChange={() => toggleCalendar(calendar.id)}
                trackColor={{ false: '#E0E0E0', true: '#81b0ff' }}
                thumbColor={
                  selectedCalendarIds.includes(calendar.id) ? '#4285F4' : '#f4f3f4'
                }
              />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Selection summary */}
      {availableCalendars.length > 0 && (
        <Text style={styles.selectionSummary}>
          {selectedCalendarIds.length} of {availableCalendars.length} calendars selected
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginVertical: 16,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  notConnectedText: {
    fontSize: 14,
    color: '#888',
    fontStyle: 'italic',
    marginTop: 8,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    marginLeft: 12,
    fontSize: 14,
    color: '#666',
  },
  refreshButton: {
    backgroundColor: '#4285F4',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  refreshButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  calendarList: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  calendarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  colorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 12,
  },
  calendarInfo: {
    flex: 1,
    marginRight: 12,
  },
  calendarName: {
    fontSize: 16,
    color: '#1a1a1a',
    fontWeight: '500',
  },
  primaryBadge: {
    fontSize: 12,
    color: '#4285F4',
    fontWeight: '400',
  },
  calendarDescription: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  selectionSummary: {
    fontSize: 12,
    color: '#888',
    marginTop: 12,
    textAlign: 'center',
  },
});
