import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { Calendar, Clock, AlertTriangle, Check, MoveRight } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { getSupabaseClient } from '@/lib/supabase';
import { calculateTaskPoints } from '@/lib/taskUtils';
import { RescheduleModal } from './RescheduleModal';

interface Event {
  id: string;
  title: string;
  description?: string;
  start_date: string;
  start_time: string;
  end_time?: string;
  priority?: string;
  points?: number;
}

interface ScheduledEventsProps {
  fuelLevel: 1 | 2 | 3;
  userId: string;
  onEventsAccepted: (events: Event[]) => void;
}

type EventZone = 'keep' | 'reschedule' | 'cancel';

interface EventState {
  event: Event;
  zone: EventZone;
  selected: boolean;
}

export function ScheduledEvents({
  fuelLevel,
  userId,
  onEventsAccepted,
}: ScheduledEventsProps) {
  const { colors, isDarkMode } = useTheme();
  const [loading, setLoading] = useState(true);
  const [eventStates, setEventStates] = useState<EventState[]>([]);
  const [rescheduleModalVisible, setRescheduleModalVisible] = useState(false);
  const [selectedEventForReschedule, setSelectedEventForReschedule] = useState<Event | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadTodaysEvents();
  }, [userId]);

  async function loadTodaysEvents() {
    try {
      setLoading(true);
      const supabase = getSupabaseClient();

      const today = new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('0008-ap-tasks')
        .select('*')
        .eq('user_id', userId)
        .eq('type', 'event')
        .eq('start_date', today)
        .eq('status', 'pending')
        .is('deleted_at', null)
        .order('start_time', { ascending: true });

      if (error) {
        throw error;
      }

      const eventsWithPoints: Event[] = (data || []).map((event) => ({
        ...event,
        points: calculateTaskPoints(event),
      }));

      setEventStates(
        eventsWithPoints.map((event) => ({
          event,
          zone: 'keep',
          selected: false,
        }))
      );

      onEventsAccepted(eventsWithPoints);
    } catch (error) {
      console.error('Error loading events:', error);
      Alert.alert('Error', 'Failed to load events. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function getHeaderText(): string {
    switch (fuelLevel) {
      case 1:
        return "Here are your scheduled events. Should we reschedule any of these to protect your energy?";
      case 2:
      case 3:
        return "Let's take care of today's big rocks first. Here is your time-map for the day.";
    }
  }

  function toggleEventSelection(eventId: string) {
    setEventStates((prev) =>
      prev.map((es) =>
        es.event.id === eventId
          ? { ...es, selected: !es.selected }
          : es
      )
    );
  }

  function moveSelectedTo(zone: EventZone) {
    setEventStates((prev) =>
      prev.map((es) =>
        es.selected ? { ...es, zone, selected: false } : es
      )
    );
    setHasChanges(true);
  }

  function moveEventTo(eventId: string, zone: EventZone) {
    if (zone === 'reschedule') {
      const eventState = eventStates.find((es) => es.event.id === eventId);
      if (eventState) {
        setSelectedEventForReschedule(eventState.event);
        setRescheduleModalVisible(true);
      }
      return;
    }

    setEventStates((prev) =>
      prev.map((es) =>
        es.event.id === eventId ? { ...es, zone } : es
      )
    );
    setHasChanges(true);
  }

  async function handleReschedule(
    eventId: string,
    newDate: string,
    newStartTime: string,
    newEndTime: string | null
  ) {
    try {
      const supabase = getSupabaseClient();

      const { error } = await supabase
        .from('0008-ap-tasks')
        .update({
          start_date: newDate,
          start_time: newStartTime,
          end_time: newEndTime,
          times_rescheduled: supabase.rpc('increment', { x: 1 }),
        })
        .eq('id', eventId);

      if (error) {
        throw error;
      }

      setEventStates((prev) => prev.filter((es) => es.event.id !== eventId));
      setHasChanges(true);
      setRescheduleModalVisible(false);
      setSelectedEventForReschedule(null);
    } catch (error) {
      console.error('Error rescheduling event:', error);
      Alert.alert('Error', 'Failed to reschedule event. Please try again.');
    }
  }

  async function handleUpdate() {
    try {
      setSaving(true);
      const supabase = getSupabaseClient();

      const eventsToCancel = eventStates
        .filter((es) => es.zone === 'cancel')
        .map((es) => es.event.id);

      if (eventsToCancel.length > 0) {
        const { error } = await supabase
          .from('0008-ap-tasks')
          .update({
            status: 'cancelled',
            deleted_at: new Date().toISOString(),
          })
          .in('id', eventsToCancel);

        if (error) {
          throw error;
        }
      }

      const keptEvents = eventStates
        .filter((es) => es.zone === 'keep')
        .map((es) => es.event);

      onEventsAccepted(keptEvents);

      setEventStates((prev) => prev.filter((es) => es.zone === 'keep'));
      setHasChanges(false);
    } catch (error) {
      console.error('Error updating events:', error);
      Alert.alert('Error', 'Failed to update events. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function formatTime(time: string): string {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
  }

  function calculateDuration(startTime: string, endTime?: string): string {
    if (!endTime) return '';

    const [startHours, startMinutes] = startTime.split(':').map(Number);
    const [endHours, endMinutes] = endTime.split(':').map(Number);

    const startInMinutes = startHours * 60 + startMinutes;
    const endInMinutes = endHours * 60 + endMinutes;

    const durationMinutes = endInMinutes - startInMinutes;

    if (durationMinutes < 60) {
      return `${durationMinutes}m`;
    }

    const hours = Math.floor(durationMinutes / 60);
    const minutes = durationMinutes % 60;

    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }

  function getPriorityColor(priority?: string): string {
    switch (priority) {
      case 'high':
        return '#EF4444';
      case 'medium':
        return '#F59E0B';
      case 'low':
        return '#10B981';
      default:
        return colors.textSecondary;
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (eventStates.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Calendar size={48} color={colors.textSecondary} />
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          No events scheduled for today
        </Text>
      </View>
    );
  }

  const keptEvents = eventStates.filter((es) => es.zone === 'keep');
  const rescheduledEvents = eventStates.filter((es) => es.zone === 'reschedule');
  const cancelledEvents = eventStates.filter((es) => es.zone === 'cancel');
  const hasSelectedEvents = eventStates.some((es) => es.selected);

  return (
    <View style={styles.container}>
      <Text style={[styles.headerText, { color: colors.text }]}>
        {getHeaderText()}
      </Text>

      {/* Keep Zone */}
      <View style={styles.zoneContainer}>
        <View style={styles.zoneHeader}>
          <Check size={18} color="#10B981" />
          <Text style={[styles.zoneTitle, { color: colors.text }]}>
            Keep ({keptEvents.length})
          </Text>
        </View>

        {keptEvents.map(({ event, selected }) => (
          <TouchableOpacity
            key={event.id}
            style={[
              styles.eventCard,
              {
                backgroundColor: colors.surface,
                borderColor: selected ? colors.primary : colors.border,
                borderWidth: selected ? 2 : 1,
              },
            ]}
            onPress={() => toggleEventSelection(event.id)}
            activeOpacity={0.7}
          >
            <View style={styles.eventContent}>
              <View style={styles.eventTimeSection}>
                <Text style={[styles.eventTime, { color: colors.text }]}>
                  {formatTime(event.start_time)}
                </Text>
                {event.end_time && (
                  <Text style={[styles.eventDuration, { color: colors.textSecondary }]}>
                    {calculateDuration(event.start_time, event.end_time)}
                  </Text>
                )}
              </View>

              <View style={styles.eventDetails}>
                <Text
                  style={[styles.eventTitle, { color: colors.text }]}
                  numberOfLines={2}
                >
                  {event.title}
                </Text>
                {event.priority && (
                  <View
                    style={[
                      styles.priorityBadge,
                      { backgroundColor: getPriorityColor(event.priority) + '20' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.priorityText,
                        { color: getPriorityColor(event.priority) },
                      ]}
                    >
                      {event.priority}
                    </Text>
                  </View>
                )}
              </View>

              <View
                style={[
                  styles.pointsBadge,
                  { backgroundColor: colors.primary + '20' },
                ]}
              >
                <Text style={[styles.pointsText, { color: colors.primary }]}>
                  +{event.points}
                </Text>
              </View>
            </View>

            <View style={styles.eventActions}>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: '#F59E0B20' }]}
                onPress={(e) => {
                  e.stopPropagation();
                  moveEventTo(event.id, 'reschedule');
                }}
              >
                <MoveRight size={16} color="#F59E0B" />
                <Text style={[styles.actionButtonText, { color: '#F59E0B' }]}>
                  Reschedule
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: '#EF444420' }]}
                onPress={(e) => {
                  e.stopPropagation();
                  moveEventTo(event.id, 'cancel');
                }}
              >
                <AlertTriangle size={16} color="#EF4444" />
                <Text style={[styles.actionButtonText, { color: '#EF4444' }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Reschedule Zone */}
      {rescheduledEvents.length > 0 && (
        <View style={[styles.zoneContainer, styles.warningZone]}>
          <View style={styles.zoneHeader}>
            <Clock size={18} color="#F59E0B" />
            <Text style={[styles.zoneTitle, { color: colors.text }]}>
              To Reschedule ({rescheduledEvents.length})
            </Text>
          </View>

          {rescheduledEvents.map(({ event }) => (
            <View
              key={event.id}
              style={[
                styles.eventCard,
                {
                  backgroundColor: '#F59E0B10',
                  borderColor: '#F59E0B',
                },
              ]}
            >
              <Text style={[styles.eventTitle, { color: colors.text }]}>
                {event.title}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Cancel Zone */}
      {cancelledEvents.length > 0 && (
        <View style={[styles.zoneContainer, styles.dangerZone]}>
          <View style={styles.zoneHeader}>
            <AlertTriangle size={18} color="#EF4444" />
            <Text style={[styles.zoneTitle, { color: '#EF4444' }]}>
              ⚠️ Items here will be deleted ({cancelledEvents.length})
            </Text>
          </View>

          {cancelledEvents.map(({ event }) => (
            <View
              key={event.id}
              style={[
                styles.eventCard,
                {
                  backgroundColor: '#EF444410',
                  borderColor: '#EF4444',
                },
              ]}
            >
              <Text style={[styles.eventTitle, { color: colors.text }]}>
                {event.title}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Action Bar */}
      {hasSelectedEvents && (
        <View style={[styles.actionBar, { backgroundColor: colors.surface }]}>
          <Text style={[styles.actionBarText, { color: colors.text }]}>
            Selected: {eventStates.filter((es) => es.selected).length}
          </Text>
          <View style={styles.actionBarButtons}>
            <TouchableOpacity
              style={[styles.moveButton, { backgroundColor: '#F59E0B' }]}
              onPress={() => moveSelectedTo('reschedule')}
            >
              <Text style={styles.moveButtonText}>Reschedule</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.moveButton, { backgroundColor: '#EF4444' }]}
              onPress={() => moveSelectedTo('cancel')}
            >
              <Text style={styles.moveButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Update Button */}
      <TouchableOpacity
        style={[
          styles.updateButton,
          {
            backgroundColor: hasChanges ? colors.primary : colors.border,
          },
        ]}
        onPress={handleUpdate}
        disabled={!hasChanges || saving}
      >
        {saving ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Text style={styles.updateButtonText}>
            {hasChanges ? 'Update' : 'Keep As Is'}
          </Text>
        )}
      </TouchableOpacity>

      <RescheduleModal
        visible={rescheduleModalVisible}
        event={selectedEventForReschedule}
        onClose={() => {
          setRescheduleModalVisible(false);
          setSelectedEventForReschedule(null);
        }}
        onReschedule={handleReschedule}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  loadingContainer: {
    padding: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    padding: 60,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
  },
  headerText: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 24,
    marginBottom: 20,
  },
  zoneContainer: {
    marginBottom: 20,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  warningZone: {
    backgroundColor: '#F59E0B05',
    borderColor: '#F59E0B',
  },
  dangerZone: {
    backgroundColor: '#EF444405',
    borderColor: '#EF4444',
  },
  zoneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  zoneTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  eventCard: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  eventContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  eventTimeSection: {
    minWidth: 80,
  },
  eventTime: {
    fontSize: 14,
    fontWeight: '700',
  },
  eventDuration: {
    fontSize: 12,
    marginTop: 2,
  },
  eventDetails: {
    flex: 1,
    marginLeft: 12,
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  priorityBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  pointsBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  pointsText: {
    fontSize: 14,
    fontWeight: '700',
  },
  eventActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 8,
    borderRadius: 6,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  actionBarText: {
    fontSize: 14,
    fontWeight: '600',
  },
  actionBarButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  moveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  moveButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  updateButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  updateButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
